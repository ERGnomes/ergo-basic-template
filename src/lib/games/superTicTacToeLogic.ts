/**
 * Pure game logic for Ultimate (Super) Tic Tac Toe — 9 nested 3×3 boards,
 * forced sub-board by the previous cell, free move when sent to a finished mini-board.
 *
 * Local / UI only (no on-chain contract).
 */

import {
  CELL_EMPTY,
  CELL_O,
  CELL_X,
  type Board,
  type Cell,
  type GameStatus,
  isLegalMove,
  nonEmptyCount,
  winnerOf,
} from "./ticTacToeLogic";

/** Super games are never in the contract-style "open" state. */
export type SuperGameStatus = Exclude<GameStatus, { kind: "open" }>;

/** Meta cell filled but no winner (mini-board full). */
export const META_DRAW = 3 as const;

export type MetaCell = typeof CELL_EMPTY | typeof CELL_X | typeof CELL_O | typeof META_DRAW;

/** Nine mini-boards, index 0..8 in row-major order (same as a tic-tac-toe grid). */
export type SuperBoard = readonly [
  Board,
  Board,
  Board,
  Board,
  Board,
  Board,
  Board,
  Board,
  Board,
];

const emptySub = (): Board =>
  [CELL_EMPTY, CELL_EMPTY, CELL_EMPTY, CELL_EMPTY, CELL_EMPTY, CELL_EMPTY, CELL_EMPTY, CELL_EMPTY, CELL_EMPTY] as unknown as Board;

export const EMPTY_SUPER_BOARD: SuperBoard = [
  emptySub(),
  emptySub(),
  emptySub(),
  emptySub(),
  emptySub(),
  emptySub(),
  emptySub(),
  emptySub(),
  emptySub(),
];

export type SuperGame = {
  boards: SuperBoard;
  /** If set, the active player may only play inside this mini-board (0..8). */
  constraintSub: number | null;
};

export const initialSuperGame = (): SuperGame => ({
  boards: EMPTY_SUPER_BOARD,
  constraintSub: null,
});

export const totalMoves = (boards: SuperBoard): number =>
  boards.reduce((acc, b) => acc + nonEmptyCount(b), 0);

/** X plays first, same alternation as classic tic-tac-toe. */
export const currentSuperSymbol = (game: SuperGame): Cell =>
  totalMoves(game.boards) % 2 === 0 ? CELL_X : CELL_O;

/** Outcome of a mini-board for meta-line purposes. */
export const metaOutcomeOfSub = (sub: Board): MetaCell => {
  const w = winnerOf(sub);
  if (w === CELL_X || w === CELL_O) return w;
  if (nonEmptyCount(sub) === 9) return META_DRAW;
  return CELL_EMPTY;
};

const META_LINES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/** Meta winner: only three X or three O in a line count; META_DRAW does not complete a line. */
export const superWinner = (boards: SuperBoard): typeof CELL_X | typeof CELL_O | null => {
  const meta = boards.map((b) => metaOutcomeOfSub(b));
  for (const [a, b, c] of META_LINES) {
    const v = meta[a];
    if (v === CELL_X || v === CELL_O) {
      if (v === meta[b] && v === meta[c]) return v;
    }
  }
  return null;
};

export const superMetaFull = (boards: SuperBoard): boolean =>
  boards.every((b) => metaOutcomeOfSub(b) !== CELL_EMPTY);

export const superStatusOf = (game: SuperGame): SuperGameStatus => {
  const w = superWinner(game.boards);
  if (w === CELL_X) return { kind: "won", winner: "X" };
  if (w === CELL_O) return { kind: "won", winner: "O" };
  if (superMetaFull(game.boards)) return { kind: "drawn" };
  const sym = currentSuperSymbol(game);
  return {
    kind: "ongoing",
    turn: sym === CELL_X ? "X" : "O",
  };
};

export const isLegalSuperMove = (
  game: SuperGame,
  subIndex: number,
  cellIndex: number
): boolean => {
  if (subIndex < 0 || subIndex > 8 || cellIndex < 0 || cellIndex > 8) return false;
  const status = superStatusOf(game);
  if (status.kind === "won" || status.kind === "drawn") return false;
  if (game.constraintSub !== null && subIndex !== game.constraintSub) return false;
  const sub = game.boards[subIndex];
  if (metaOutcomeOfSub(sub) !== CELL_EMPTY) return false;
  return isLegalMove(sub, cellIndex);
};

export const applySuperMove = (
  game: SuperGame,
  subIndex: number,
  cellIndex: number
): SuperGame => {
  if (!isLegalSuperMove(game, subIndex, cellIndex)) {
    throw new Error("illegal super tic-tac-toe move");
  }
  const sub = game.boards[subIndex];
  /** Global alternation: same move index as classic 9×9, not per-mini-board `applyMove`. */
  const sym = currentSuperSymbol(game);
  const nextCells = [...sub] as unknown as Cell[];
  if (nextCells[cellIndex] !== CELL_EMPTY) {
    throw new Error("illegal super tic-tac-toe move");
  }
  nextCells[cellIndex] = sym;
  const newSub = nextCells as unknown as Board;
  const boards = game.boards.map((b, i) => (i === subIndex ? newSub : b)) as unknown as SuperBoard;

  const targetNext = cellIndex;
  const targetBoard = boards[targetNext];
  const targetMeta = metaOutcomeOfSub(targetBoard);
  const constraintSub = targetMeta === CELL_EMPTY ? targetNext : null;

  return { boards, constraintSub };
};
