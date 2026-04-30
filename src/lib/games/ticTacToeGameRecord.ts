/**
 * Versioned, JSON-serializable snapshot format for tic-tac-toe games.
 *
 * Standard record (v1) — stable keys for tools and future replay storage:
 *   - schemaVersion: 1
 *   - gameId: "{contractAddress}:{boxId}" (this template’s stable id)
 *   - contractAddress, boxId, creationTxId?, closingTxId?, settlementHeight?
 *   - board: 9 cells, 0 | 1 | 2 (empty, X, O)
 *   - p1PubKeyHex, p2PubKeyHex, wagerNanoErg, potNanoErg (strings for JSON)
 *   - phase, isJoined, outcome (normalized enum for analytics)
 *   - exportedAt: ISO-8601 when serialized
 *
 * Use this when:
 *   - exporting a finished (or live) game for tools, analytics, or
 *     another app;
 *   - persisting replays once you store move lists elsewhere;
 *   - documenting the on-chain ↔ off-chain contract for this template.
 *
 * v1 fields are stable; bump `schemaVersion` if you add required keys.
 */

import type { Board } from "./ticTacToeLogic";
import type { DiscoveredGame, GameHistorySnapshot } from "./ticTacToeDiscovery";

export const TIC_TAC_TOE_GAME_RECORD_SCHEMA = 1 as const;

/** Outcome inferred from registers + join state (not the closing tx kind). */
export type GameRecordOutcome =
  | "open_unjoined"
  | "ongoing"
  | "won_x"
  | "won_o"
  | "drawn";

export interface TicTacToeGameRecordV1 {
  schemaVersion: typeof TIC_TAC_TOE_GAME_RECORD_SCHEMA;
  /** Logical game id for this template: contract P2S + box id. */
  gameId: string;
  contractAddress: string;
  boxId: string;
  creationTxId?: string;
  /** Present when the box is already spent (history / archive). */
  closingTxId?: string | null;
  settlementHeight?: number | null;
  board: Board;
  p1PubKeyHex: string;
  p2PubKeyHex: string;
  wagerNanoErg: string;
  potNanoErg: string;
  phase: "open" | "ongoing" | "won" | "drawn";
  isJoined: boolean;
  outcome: GameRecordOutcome;
  /** ISO-8601 when the record was produced (client clock). */
  exportedAt: string;
}

const outcomeFromSnapshot = (
  phase: DiscoveredGame["phase"],
  isJoined: boolean,
  board: Board
): GameRecordOutcome => {
  if (!isJoined || phase === "open") return "open_unjoined";
  if (phase === "ongoing") return "ongoing";
  if (phase === "drawn") return "drawn";
  if (phase === "won") {
    const xs = board.filter((c) => c === 1).length;
    const os = board.filter((c) => c === 2).length;
    return xs > os ? "won_x" : "won_o";
  }
  return "ongoing";
};

export const gameIdForBox = (contractAddress: string, boxId: string): string =>
  `${contractAddress}:${boxId}`;

export const gameRecordFromDiscovered = (
  game: DiscoveredGame,
  contractAddress: string,
  opts?: { closingTxId?: string | null; settlementHeight?: number | null }
): TicTacToeGameRecordV1 => {
  const exportedAt = new Date().toISOString();
  return {
    schemaVersion: TIC_TAC_TOE_GAME_RECORD_SCHEMA,
    gameId: gameIdForBox(contractAddress, game.box.boxId),
    contractAddress,
    boxId: game.box.boxId,
    creationTxId: game.box.transactionId,
    closingTxId: opts?.closingTxId ?? null,
    settlementHeight: opts?.settlementHeight ?? null,
    board: [...game.state.board] as Board,
    p1PubKeyHex: game.state.p1PubKeyHex,
    p2PubKeyHex: game.state.p2PubKeyHex,
    wagerNanoErg: game.state.wagerNanoErg.toString(),
    potNanoErg: String(game.box.value),
    phase: game.phase,
    isJoined: game.isJoined,
    outcome: outcomeFromSnapshot(game.phase, game.isJoined, game.state.board),
    exportedAt,
  };
};

export const gameRecordFromHistory = (
  h: GameHistorySnapshot,
  contractAddress: string
): TicTacToeGameRecordV1 =>
  gameRecordFromDiscovered(
    {
      box: h.box,
      state: h.state,
      phase: h.phase,
      isJoined: h.isJoined,
    },
    contractAddress,
    { closingTxId: h.spentTransactionId, settlementHeight: h.settlementHeight }
  );

export const parseGameRecord = (raw: string): TicTacToeGameRecordV1 => {
  const j = JSON.parse(raw) as Partial<TicTacToeGameRecordV1>;
  if (j.schemaVersion !== 1) {
    throw new Error(`Unsupported schemaVersion: ${j.schemaVersion}`);
  }
  if (
    typeof j.gameId !== "string" ||
    typeof j.contractAddress !== "string" ||
    typeof j.boxId !== "string" ||
    !Array.isArray(j.board) ||
    j.board.length !== 9
  ) {
    throw new Error("Invalid game record: missing required fields");
  }
  return j as TicTacToeGameRecordV1;
};

export const stringifyGameRecord = (rec: TicTacToeGameRecordV1): string =>
  JSON.stringify(rec, null, 2);
