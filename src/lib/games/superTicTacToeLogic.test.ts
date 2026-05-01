import {
  EMPTY_SUPER_BOARD,
  applySuperMove,
  initialSuperGame,
  isLegalSuperMove,
  type SuperBoard,
  superMetaFull,
  superStatusOf,
  superWinner,
} from "./superTicTacToeLogic";
import {
  CELL_EMPTY,
  CELL_O,
  CELL_X,
  EMPTY_BOARD,
  type Board,
  type Cell,
} from "./ticTacToeLogic";

describe("superTicTacToeLogic", () => {
  it("alternates X and O globally across mini-boards (not per-sub-board)", () => {
    let g = initialSuperGame();
    g = applySuperMove(g, 0, 0); // X
    expect(g.boards[0][0]).toBe(CELL_X);
    g = applySuperMove(g, 0, 1); // O (same mini-board, next global move)
    expect(g.boards[0][1]).toBe(CELL_O);
    g = applySuperMove(g, 1, 0); // X — sent to sub 1
    expect(g.boards[1][0]).toBe(CELL_X);
    g = applySuperMove(g, 0, 2); // O
    expect(g.boards[0][2]).toBe(CELL_O);
  });

  it("starts with X to move and no constraint after first move sends to sub", () => {
    const g0 = initialSuperGame();
    expect(superStatusOf(g0)).toEqual({ kind: "ongoing", turn: "X" });
    expect(g0.constraintSub).toBeNull();

    const g1 = applySuperMove(g0, 4, 4); // center of center board -> next must play board 4
    expect(superStatusOf(g1)).toEqual({ kind: "ongoing", turn: "O" });
    expect(g1.constraintSub).toBe(4);
    expect(isLegalSuperMove(g1, 3, 0)).toBe(false);
    expect(isLegalSuperMove(g1, 4, 0)).toBe(true);
  });

  it("allows any open mini-board when constraint is null", () => {
    const g = initialSuperGame();
    expect(isLegalSuperMove(g, 0, 0)).toBe(true);
    expect(isLegalSuperMove(g, 8, 8)).toBe(true);
  });

  it("clears constraint when the indicated mini-board is already decided", () => {
    const drawSub = [
      CELL_X,
      CELL_O,
      CELL_X,
      CELL_O,
      CELL_O,
      CELL_X,
      CELL_X,
      CELL_X,
      CELL_O,
    ] as unknown as (typeof EMPTY_BOARD)[number];
    const boards = EMPTY_SUPER_BOARD.map((b, i) => (i === 0 ? drawSub : b)) as unknown as typeof EMPTY_SUPER_BOARD;
    // X to move, must play in sub 1 only (not 0 — finished)
    const game = { boards, constraintSub: 1 as number | null };
    expect(isLegalSuperMove(game, 0, 0)).toBe(false);
    expect(isLegalSuperMove(game, 1, 0)).toBe(true);
    // If sent to board 0 (full), constraint would be null — simulate that state
    const free = { boards, constraintSub: null as number | null };
    expect(isLegalSuperMove(free, 2, 0)).toBe(true);
  });

  it("detects super win on meta line", () => {
    // Simplified: manually impossible without many moves — use three subs each won by X in a row
    const boards = [...EMPTY_SUPER_BOARD] as unknown as Board[];
    // Win sub 0 for X: 0,1,2 top row
    const winLine = (cells: [number, number, number]): Board => {
      const next = [...EMPTY_BOARD] as unknown as Cell[];
      next[cells[0]] = CELL_X;
      next[cells[1]] = CELL_X;
      next[cells[2]] = CELL_X;
      return next as unknown as Board;
    };
    boards[0] = winLine([0, 1, 2]);
    boards[1] = winLine([3, 4, 5]);
    boards[2] = winLine([6, 7, 8]);
    const boardsTuple = boards as unknown as SuperBoard;
    const game = {
      boards: boardsTuple,
      constraintSub: null as number | null,
    };
    expect(superWinner(boardsTuple)).toBe(CELL_X);
    expect(superStatusOf(game)).toEqual({ kind: "won", winner: "X" });
  });

  it("declares draw when meta is full without winner", () => {
    // Same classic draw on every mini-board → meta cells are all "draw", no X/O meta line.
    const drawSub: (typeof EMPTY_BOARD)[number] = [
      CELL_X,
      CELL_O,
      CELL_X,
      CELL_O,
      CELL_O,
      CELL_X,
      CELL_X,
      CELL_X,
      CELL_O,
    ] as unknown as (typeof EMPTY_BOARD)[number];
    const boards = EMPTY_SUPER_BOARD.map(() => drawSub) as unknown as SuperBoard;
    expect(superMetaFull(boards)).toBe(true);
    expect(superWinner(boards)).toBeNull();
    expect(superStatusOf({ boards, constraintSub: null })).toEqual({ kind: "drawn" });
  });
});
