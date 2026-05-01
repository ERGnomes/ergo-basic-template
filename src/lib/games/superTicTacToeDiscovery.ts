/**
 * Explorer-backed discovery for Ultimate (Super) tic-tac-toe boxes.
 */

import {
  ExplorerBoxLike,
  getSuperGameErgoTreeHex,
  parseSuperGameBox,
  type SuperChainGameState,
} from "./superTicTacToeContract";
import { superMetaFull, superWinner } from "./superTicTacToeLogic";

const EXPLORER_API = "https://api.ergoplatform.com/api/v1";

export interface DiscoveredSuperGame {
  box: ExplorerBoxLike;
  state: SuperChainGameState;
  phase: "open" | "ongoing" | "won" | "drawn";
  isJoined: boolean;
}

export interface SuperGameHistorySnapshot {
  box: ExplorerBoxLike;
  state: SuperChainGameState;
  phase: DiscoveredSuperGame["phase"];
  isJoined: boolean;
  settlementHeight: number;
  spentTransactionId: string;
}

const boxToDiscovered = (box: ExplorerBoxLike): DiscoveredSuperGame | null => {
  let state: SuperChainGameState | null = null;
  try {
    state = parseSuperGameBox(box);
  } catch {
    return null;
  }
  if (!state) return null;
  const isJoined = state.p1PubKeyHex !== state.p2PubKeyHex;
  let phase: DiscoveredSuperGame["phase"];
  if (!isJoined) {
    phase = "open";
  } else {
    const w = superWinner(state.boards);
    if (w !== null) {
      phase = "won";
    } else if (superMetaFull(state.boards)) {
      phase = "drawn";
    } else {
      phase = "ongoing";
    }
  }
  return { box, state, phase, isJoined };
};

export const fetchAllSuperGames = async (): Promise<DiscoveredSuperGame[]> => {
  const treeHex = getSuperGameErgoTreeHex();
  const url = `${EXPLORER_API}/boxes/unspent/byErgoTree/${treeHex}?limit=100`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Explorer HTTP ${res.status}`);
  }
  const body = await res.json();
  const items: ExplorerBoxLike[] = body.items || [];
  const games: DiscoveredSuperGame[] = [];
  for (const box of items) {
    const g = boxToDiscovered(box);
    if (g) games.push(g);
  }
  return games;
};

export const fetchOpenSuperGames = async (): Promise<DiscoveredSuperGame[]> => {
  const all = await fetchAllSuperGames();
  return all.filter((g) => g.phase === "open");
};

export const fetchRecentSuperGameHistory = async (
  limit = 30
): Promise<SuperGameHistorySnapshot[]> => {
  const treeHex = getSuperGameErgoTreeHex();
  const url = `${EXPLORER_API}/boxes/byErgoTree/${treeHex}?limit=${limit}&offset=0&sortDirection=desc`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Explorer HTTP ${res.status}`);
  }
  const body = await res.json();
  const items: ExplorerBoxLike[] = body.items || [];
  const out: SuperGameHistorySnapshot[] = [];
  for (const box of items) {
    const g = boxToDiscovered(box);
    if (!g) continue;
    const spent = box.spentTransactionId;
    if (!spent || typeof spent !== "string") continue;
    const h = box.settlementHeight;
    if (typeof h !== "number") continue;
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

export const findCurrentSuperBoxForGame = async (
  p1PubKeyHex: string,
  p2PubKeyHex: string,
  wagerNanoErg: bigint
): Promise<DiscoveredSuperGame | null> => {
  const all = await fetchAllSuperGames();
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

export const fetchSuperBoxById = async (
  boxId: string
): Promise<ExplorerBoxLike | null> => {
  const res = await fetch(`${EXPLORER_API}/boxes/${encodeURIComponent(boxId)}`);
  if (!res.ok) return null;
  return (await res.json()) as ExplorerBoxLike;
};
