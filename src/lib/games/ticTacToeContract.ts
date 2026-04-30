/**
 * Tic-tac-toe contract compilation and box encode/decode.
 *
 * The contract source lives in `src/ergoscript/ticTacToe.es` and is
 * compiled in-browser via `@fleet-sdk/compiler`. Compilation is
 * deterministic for a given source, so the resulting ErgoTree /
 * contract address is the same for every user.
 *
 * See the `.es` file for the full game-state / branch documentation.
 */

import { compile } from "@fleet-sdk/compiler";
import { ErgoAddress, Network } from "@fleet-sdk/core";
import {
  SByte,
  SColl,
  SGroupElement,
  SLong,
  decode,
} from "@fleet-sdk/serializer";
import { Board, CELL_EMPTY, Cell } from "./ticTacToeLogic";

type CompiledTree = ReturnType<typeof compile>;

// Raw contract source, kept in sync with src/ergoscript/ticTacToe.es.
// We inline it rather than fetching at runtime so the bundle is
// self-contained and the contract address is derivable offline.
const TIC_TAC_TOE_ERGOSCRIPT = String.raw`{
  val board  = SELF.R4[Coll[Byte]].get
  val p1     = SELF.R5[GroupElement].get
  val p2     = SELF.R6[GroupElement].get
  val wager  = SELF.R7[Long].get

  val empty: Byte = 0
  val X: Byte     = 1
  val O: Byte     = 2

  val count = board.fold(0, { (acc: Int, c: Byte) =>
    if (c != empty) acc + 1 else acc
  })

  val open = p1 == p2

  val xWon =
    (board(0) == X && board(1) == X && board(2) == X) ||
    (board(3) == X && board(4) == X && board(5) == X) ||
    (board(6) == X && board(7) == X && board(8) == X) ||
    (board(0) == X && board(3) == X && board(6) == X) ||
    (board(1) == X && board(4) == X && board(7) == X) ||
    (board(2) == X && board(5) == X && board(8) == X) ||
    (board(0) == X && board(4) == X && board(8) == X) ||
    (board(2) == X && board(4) == X && board(6) == X)

  val oWon =
    (board(0) == O && board(1) == O && board(2) == O) ||
    (board(3) == O && board(4) == O && board(5) == O) ||
    (board(6) == O && board(7) == O && board(8) == O) ||
    (board(0) == O && board(3) == O && board(6) == O) ||
    (board(1) == O && board(4) == O && board(7) == O) ||
    (board(2) == O && board(5) == O && board(8) == O) ||
    (board(0) == O && board(4) == O && board(8) == O) ||
    (board(2) == O && board(4) == O && board(6) == O)

  val drawn   = count == 9 && !xWon && !oWon
  val ongoing = !open && !xWon && !oWon && !drawn

  val p1Turn    = count % 2 == 0
  val mover     = if (p1Turn) p1 else p2
  val moverSym  = if (p1Turn) X else O

  val cancelBranch = open

  val joinBranch = open && {
    val out = OUTPUTS(0)
    out.propositionBytes == SELF.propositionBytes &&
    out.R4[Coll[Byte]].get == board &&
    out.R5[GroupElement].get == p1 &&
    out.R6[GroupElement].get != p1 &&
    out.R7[Long].get == wager &&
    out.value >= SELF.value + wager
  }

  val moveBranch = ongoing && {
    val out       = OUTPUTS(0)
    val newBoard  = out.R4[Coll[Byte]].get
    val pairs     = board.zip(newBoard)

    val allCellsValid = pairs.forall { (pr: (Byte, Byte)) =>
      pr._1 == pr._2 || (pr._1 == empty && pr._2 == moverSym)
    }

    val changeCount = pairs.fold(0, { (acc: Int, pr: (Byte, Byte)) =>
      if (pr._1 != pr._2) acc + 1 else acc
    })

    newBoard.size == 9 &&
    changeCount == 1 &&
    allCellsValid &&
    out.propositionBytes == SELF.propositionBytes &&
    out.R5[GroupElement].get == p1 &&
    out.R6[GroupElement].get == p2 &&
    out.R7[Long].get == wager &&
    out.value >= SELF.value
  }

  (cancelBranch && proveDlog(p1))             ||
  joinBranch                                   ||
  (moveBranch   && proveDlog(mover))          ||
  (xWon         && proveDlog(p1))             ||
  (oWon         && proveDlog(p2))             ||
  (drawn        && proveDlog(p1) && proveDlog(p2))
}`;

let cachedTree: CompiledTree | null = null;

/**
 * Compile the contract once and cache the result. Safe to call from
 * render paths — subsequent calls are O(1).
 */
export const getGameErgoTree = (): CompiledTree => {
  if (cachedTree) return cachedTree;
  cachedTree = compile(TIC_TAC_TOE_ERGOSCRIPT, {
    network: "mainnet",
    version: 1,
  });
  return cachedTree;
};

export const getGameErgoTreeHex = (): string => getGameErgoTree().toHex();

export const getGameP2SAddress = (): string =>
  ErgoAddress.fromErgoTree(getGameErgoTree().toHex(), Network.Mainnet).encode(
    Network.Mainnet
  );

// ------------------------------------------------------------------
// Register encoders (for building transactions) and decoders (for
// reading state from the Explorer).
// ------------------------------------------------------------------

export interface GameState {
  board: Board;
  p1PubKeyHex: string; // SEC1 compressed, 33 bytes hex
  p2PubKeyHex: string; // same; equal to p1 while game is "open"
  wagerNanoErg: bigint;
}

export const boardToBytes = (board: Board): Uint8Array => {
  const u = new Uint8Array(9);
  for (let i = 0; i < 9; i++) u[i] = board[i];
  return u;
};

export const encodeR4Board = (board: Board): string =>
  SColl(SByte, boardToBytes(board)).toHex();

export const encodeR5_6Pubkey = (pubkeyHex: string): string =>
  SGroupElement(hexToBytes(pubkeyHex)).toHex();

export const encodeR7Wager = (wager: bigint): string =>
  SLong(wager).toHex();

export const encodeAllRegisters = (state: GameState) => ({
  R4: encodeR4Board(state.board),
  R5: encodeR5_6Pubkey(state.p1PubKeyHex),
  R6: encodeR5_6Pubkey(state.p2PubKeyHex),
  R7: encodeR7Wager(state.wagerNanoErg),
});

const hexToBytes = (hex: string): Uint8Array => {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error("odd-length hex");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
};

const bytesToHex = (bytes: Uint8Array): string => {
  let s = "";
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i].toString(16).padStart(2, "0");
  }
  return s;
};

/**
 * Decode a register value from the Explorer v1 response shape:
 *   { serializedValue: "0e09...", sigmaType: "Coll[SByte]", renderedValue: "..." }
 * We pass serializedValue through Fleet's `decode` to get back the
 * structured SConstant, then unwrap it.
 */
const decodeRegister = (
  reg: any
): { data: any; sigmaType: string } | null => {
  if (!reg) return null;
  const serialized: string | undefined =
    typeof reg === "string" ? reg : reg.serializedValue;
  const sigmaType: string = typeof reg === "string" ? "" : reg.sigmaType || "";
  if (!serialized) return null;
  try {
    const constant = decode(serialized);
    return constant ? { data: constant.data, sigmaType } : null;
  } catch {
    return null;
  }
};

export interface ExplorerBoxLike {
  boxId: string;
  value: number | string;
  ergoTree?: string;
  additionalRegisters?: Record<string, any>;
  /** Present once the box has been spent (Explorer `boxes/byErgoTree`). */
  spentTransactionId?: string | null;
  settlementHeight?: number;
  transactionId?: string;
}

/**
 * Turn an Explorer box into a decoded game state, or null if the
 * registers don't match our expected shape.
 */
export const parseGameBox = (box: ExplorerBoxLike): GameState | null => {
  const regs = box.additionalRegisters || {};
  const r4 = decodeRegister(regs.R4);
  const r5 = decodeRegister(regs.R5);
  const r6 = decodeRegister(regs.R6);
  const r7 = decodeRegister(regs.R7);
  if (!r4 || !r5 || !r6 || !r7) return null;

  // R4: Coll[Byte] — Fleet's decode returns Uint8Array for byte collections.
  const boardBytes: Uint8Array = r4.data as Uint8Array;
  if (!(boardBytes instanceof Uint8Array) || boardBytes.length !== 9) {
    return null;
  }
  const board = Array.from(boardBytes).map((b): Cell => {
    if (b === 0) return CELL_EMPTY;
    if (b === 1) return 1;
    if (b === 2) return 2;
    // Reject malformed cells; caller will skip the box.
    throw new Error(`invalid cell byte: ${b}`);
  }) as unknown as Board;

  // R5/R6: GroupElement — Uint8Array (33 compressed bytes).
  const p1 = r5.data as Uint8Array;
  const p2 = r6.data as Uint8Array;
  if (!(p1 instanceof Uint8Array) || p1.length !== 33) return null;
  if (!(p2 instanceof Uint8Array) || p2.length !== 33) return null;

  // R7: Long — either bigint or number depending on Fleet version.
  const rawWager = r7.data as bigint | number;
  const wagerNanoErg =
    typeof rawWager === "bigint" ? rawWager : BigInt(rawWager);

  try {
    return {
      board,
      p1PubKeyHex: bytesToHex(p1),
      p2PubKeyHex: bytesToHex(p2),
      wagerNanoErg,
    };
  } catch {
    return null;
  }
};

export const pubkeyToMainnetAddress = (pubkeyHex: string): string =>
  ErgoAddress.fromPublicKey(hexToBytes(pubkeyHex), Network.Mainnet).encode(
    Network.Mainnet
  );

export const isOpenGame = (state: GameState): boolean =>
  state.p1PubKeyHex === state.p2PubKeyHex;
