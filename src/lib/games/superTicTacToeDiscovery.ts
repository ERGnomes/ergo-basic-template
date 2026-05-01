/**
 * Explorer-backed discovery for Ultimate (Super) tic-tac-toe boxes.
 *
 * Uses GraphQL POST (ergoTree in JSON body) instead of REST GET byErgoTree,
 * because the super contract ErgoTree hex is ~7.6k characters — GET URLs hit
 * browser/proxy limits and fail with NetworkError.
 */

import {
  getSuperGameErgoTreeHex,
  parseSuperGameBox,
  type SuperChainGameState,
} from "./superTicTacToeContract";
import { superMetaFull, superWinner } from "./superTicTacToeLogic";
import {
  fetchBoxesByErgoTreeGql,
  gqlBoxToExplorerLike,
  type GqlExplorerBoxLike,
} from "./explorerGql";

export type ExplorerBoxLike = GqlExplorerBoxLike;

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

const treeHex = (): string => getSuperGameErgoTreeHex();

export const fetchAllSuperGames = async (): Promise<DiscoveredSuperGame[]> => {
  const rows = await fetchBoxesByErgoTreeGql(treeHex(), { spent: false, take: 100 });
  const games: DiscoveredSuperGame[] = [];
  for (const row of rows) {
    const box = gqlBoxToExplorerLike(row);
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
  const rows = await fetchBoxesByErgoTreeGql(treeHex(), { spent: true, take: limit });
  const out: SuperGameHistorySnapshot[] = [];
  for (const row of rows) {
    const box = gqlBoxToExplorerLike(row);
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
  out.sort((a, b) => b.settlementHeight - a.settlementHeight);
  return out.slice(0, limit);
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

const EXPLORER_REST = "https://api.ergoplatform.com/api/v1";

export const fetchSuperBoxById = async (
  boxId: string
): Promise<ExplorerBoxLike | null> => {
  const res = await fetch(`${EXPLORER_REST}/boxes/${encodeURIComponent(boxId)}`);
  if (!res.ok) return null;
  return (await res.json()) as ExplorerBoxLike;
};
