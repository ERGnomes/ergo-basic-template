/**
 * Pure game-logic helpers for the tic-tac-toe UI.
 *
 * None of these are trusted for on-chain safety — the ErgoScript
 * contract is the source of truth. These are here so the UI can show
 * turn prompts, disable illegal moves, and render the win state
 * without having to wait for the transaction to confirm.
 */

export const CELL_EMPTY = 0 as const;
export const CELL_X = 1 as const;
export const CELL_O = 2 as const;

export type Cell = typeof CELL_EMPTY | typeof CELL_X | typeof CELL_O;
export type Board = readonly [Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell];

export const EMPTY_BOARD: Board = [0, 0, 0, 0, 0, 0, 0, 0, 0] as const;

const LINES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export const nonEmptyCount = (board: Board): number =>
  board.reduce<number>((acc, c) => (c !== CELL_EMPTY ? acc + 1 : acc), 0);

export const isXTurn = (board: Board): boolean => nonEmptyCount(board) % 2 === 0;

export const currentSymbol = (board: Board): Cell =>
  isXTurn(board) ? CELL_X : CELL_O;

export const winnerOf = (board: Board): Cell | null => {
  for (const [a, b, c] of LINES) {
    const v = board[a];
    if (v !== CELL_EMPTY && v === board[b] && v === board[c]) {
      return v;
    }
  }
  return null;
};

export type GameStatus =
  | { kind: "open" }
  | { kind: "ongoing"; turn: "X" | "O" }
  | { kind: "won"; winner: "X" | "O" }
  | { kind: "drawn" };

export const statusOf = (board: Board, open: boolean): GameStatus => {
  if (open) return { kind: "open" };
  const w = winnerOf(board);
  if (w === CELL_X) return { kind: "won", winner: "X" };
  if (w === CELL_O) return { kind: "won", winner: "O" };
  if (nonEmptyCount(board) === 9) return { kind: "drawn" };
  return { kind: "ongoing", turn: isXTurn(board) ? "X" : "O" };
};

export const applyMove = (board: Board, cell: number): Board => {
  if (cell < 0 || cell > 8) throw new Error("cell index out of range");
  if (board[cell] !== CELL_EMPTY) throw new Error("cell already occupied");
  const next = board.slice() as Cell[];
  next[cell] = currentSymbol(board);
  return next as unknown as Board;
};

export const isLegalMove = (board: Board, cell: number): boolean =>
  cell >= 0 && cell <= 8 && board[cell] === CELL_EMPTY && winnerOf(board) === null;

export const boardToString = (board: Board): string => {
  const glyph = (c: Cell): string => (c === CELL_X ? "X" : c === CELL_O ? "O" : "·");
  return [0, 3, 6]
    .map((i) => [board[i], board[i + 1], board[i + 2]].map(glyph).join(" "))
    .join("\n");
};
