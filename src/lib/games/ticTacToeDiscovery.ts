/**
 * Explorer-backed open-game discovery for the tic-tac-toe game.
 *
 * Every live game is a single unspent box at the contract's ErgoTree.
 * We fetch all unspent boxes at that tree and decode them. The UI
 * polls this on a cadence; there's no push mechanism on Ergo.
 */

import {
  ExplorerBoxLike,
  GameState,
  getGameErgoTreeHex,
  parseGameBox,
} from "./ticTacToeContract";
import { nonEmptyCount, winnerOf, CELL_EMPTY } from "./ticTacToeLogic";

const EXPLORER_API = "https://api.ergoplatform.com/api/v1";

export interface DiscoveredGame {
  box: ExplorerBoxLike;
  state: GameState;
  phase: "open" | "ongoing" | "won" | "drawn";
  /** true iff both players' positions are filled and game still playable */
  isJoined: boolean;
}

/** Latest known on-chain snapshot for a spent game box (Explorer `byErgoTree`). */
export interface GameHistorySnapshot {
  box: ExplorerBoxLike;
  state: GameState;
  phase: DiscoveredGame["phase"];
  isJoined: boolean;
  settlementHeight: number;
  spentTransactionId: string;
}

const boxToDiscovered = (box: ExplorerBoxLike): DiscoveredGame | null => {
  let state: GameState | null = null;
  try {
    state = parseGameBox(box);
  } catch {
    return null;
  }
  if (!state) return null;
  const isJoined = state.p1PubKeyHex !== state.p2PubKeyHex;
  let phase: DiscoveredGame["phase"];
  if (!isJoined) {
    phase = "open";
  } else {
    const w = winnerOf(state.board);
    if (w !== CELL_EMPTY && w !== null) {
      phase = "won";
    } else if (nonEmptyCount(state.board) === 9) {
      phase = "drawn";
    } else {
      phase = "ongoing";
    }
  }
  return { box, state, phase, isJoined };
};

/**
 * Fetch every unspent box at the tic-tac-toe contract and decode it
 * into a `DiscoveredGame`. Boxes with malformed / missing registers
 * are silently skipped — they're either unrelated boxes or bugs we
 * don't want crashing the lobby.
 */
export const fetchAllGames = async (): Promise<DiscoveredGame[]> => {
  const treeHex = getGameErgoTreeHex();
  const url = `${EXPLORER_API}/boxes/unspent/byErgoTree/${treeHex}?limit=100`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Explorer HTTP ${res.status}`);
  }
  const body = await res.json();
  const items: ExplorerBoxLike[] = body.items || [];
  const games: DiscoveredGame[] = [];
  for (const box of items) {
    const g = boxToDiscovered(box);
    if (g) games.push(g);
  }
  return games;
};

export const fetchOpenGames = async (): Promise<DiscoveredGame[]> => {
  const all = await fetchAllGames();
  return all.filter((g) => g.phase === "open");
};

/**
 * Recent boxes that ever used this contract ErgoTree, including **spent**
 * outputs (claim / cancel / replaced by next move). Sorted newest-first
 * by settlement height when the API supports `sortDirection=desc`.
 *
 * Use this for a "game history" rail: finished games no longer appear in
 * the unspent lobby but their last on-chain snapshot is still visible here.
 */
export const fetchRecentGameHistory = async (
  limit = 30
): Promise<GameHistorySnapshot[]> => {
  const treeHex = getGameErgoTreeHex();
  const url = `${EXPLORER_API}/boxes/byErgoTree/${treeHex}?limit=${limit}&offset=0&sortDirection=desc`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Explorer HTTP ${res.status}`);
  }
  const body = await res.json();
  const items: ExplorerBoxLike[] = body.items || [];
  const out: GameHistorySnapshot[] = [];
  for (const box of items) {
    const g = boxToDiscovered(box);
    if (!g) continue;
    const spent = box.spentTransactionId;
    if (!spent || typeof spent !== "string") continue;
    const h = box.settlementHeight;
    if (typeof h !== "number") continue;
    // Mid-game moves spend an "ongoing" box to create the next one; those
    // are not finished matches — skip so the list reads as "archived games".
    if (g.phase === "ongoing") continue;
    out.push({
      box: g.box,
      state: g.state,
      phase: g.phase,
      isJoined: g.isJoined,
      settlementHeight: h,
      spentTransactionId: spent,
    });
  }
  return out;
};

/**
 * Fetch the single up-to-date box for a specific game, tracked by
 * some stable identifier. Since each move spends the old box and
 * creates a new one, we need a way to follow the chain of boxes.
 *
 * Phase-1 convention: we follow by `(p1, p2, wager)` triple — unique
 * enough that collisions are implausible. Returns the newest matching
 * box or null if the game has been fully resolved (no unspent box).
 */
export const findCurrentBoxForGame = async (
  p1PubKeyHex: string,
  p2PubKeyHex: string,
  wagerNanoErg: bigint
): Promise<DiscoveredGame | null> => {
  const all = await fetchAllGames();
  for (const g of all) {
    if (
      g.state.p1PubKeyHex === p1PubKeyHex &&
      g.state.p2PubKeyHex === p2PubKeyHex &&
      g.state.wagerNanoErg === wagerNanoErg
    ) {
      return g;
    }
  }
  return null;
};

/**
 * Fetch the raw box by boxId — used when we know the exact input we
 * want to spend (e.g. immediately after we've observed it on the
 * lobby refresh).
 */
export const fetchBoxById = async (
  boxId: string
): Promise<ExplorerBoxLike | null> => {
  const res = await fetch(`${EXPLORER_API}/boxes/${encodeURIComponent(boxId)}`);
  if (!res.ok) return null;
  return (await res.json()) as ExplorerBoxLike;
};
