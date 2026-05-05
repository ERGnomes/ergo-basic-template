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
export const TIC_TAC_TOE_TREE_HEX = "19ae0a6e0400040204020402040404020406040204080402040a0402040c0402040e04020410040204060402040c04020402040204080402040e040204040402040a04020410040204080402041004020404040204080402040c0402040404020404040404040406040404080404040a0404040c0404040e04040410040404060404040c04040402040404080404040e040404040404040a04040410040404080404041004040404040404080404040c040404000400040204120404040004000400041204000402040204000402040405e04e040404000580ade20404020580ade20404000402d80fd601e4c6a70507d602e4c6a70607d6039372017202d604e4c6a7040ed605e4c6a70705d606e4c6a70805d6077eb2720473000004d6089372077301d609ecececececececeded7208937eb27204730200047303937eb27204730400047305eded937eb27204730600047307937eb27204730800047309937eb27204730a0004730beded937eb27204730c0004730d937eb27204730e0004730f937eb27204731000047311eded7208937eb27204731200047313937eb27204731400047315eded937eb27204731600047317937eb27204731800047319937eb27204731a0004731beded937eb27204731c0004731d937eb27204731e0004731f937eb27204732000047321eded7208937eb27204732200047323937eb27204732400047325eded937eb27204732600047327937eb27204732800047329937eb27204732a0004732bd60a937207732cd60becececececececeded720a937eb27204732d0004732e937eb27204732f00047330eded937eb27204733100047332937eb27204733300047334937eb27204733500047336eded937eb27204733700047338937eb2720473390004733a937eb27204733b0004733ceded720a937eb27204733d0004733e937eb27204733f00047340eded937eb27204734100047342937eb27204734300047344937eb27204734500047346eded937eb27204734700047348937eb2720473490004734a937eb27204734b0004734ceded720a937eb27204734d0004734e937eb27204734f00047350eded937eb27204735100047352937eb27204735300047354937eb27204735500047356d60cb072047357d9010c4002d801d60e8c720c0195947e8c720c020473589a720e7359720ed60deded93720c735aef7209ef720bd60eedededef7203ef7209ef720bef720dd60f939e720c735b735ceb02eb02eb02eb02eb02eb02ea02d17203cd7201d1ed7203d802d610b2a5735d00d611e4c672100805ededededededed93c27210c2a793e4c67210040e720493e4c672100507720194e4c672100607720193e4c672100705720592721172069072117ea30592c172109ac1a77205ea02d1ed720ed804d610b2a5735e00d611e4c67210040ed612dc0c1d7204017211d613e4c672100805ededededededededed93b17211735f93b072127360d901144056d802d6168c721402d6178c72140195948c7216018c7216029a7217736172177362af7212d9011456d802d6168c721401d6178c721402ec9372167217ed937e7216047363937e72170495720f7364736593c27210c2a793e4c672100507720193e4c672100607720293e4c672100705720592721372069072137ea30592c17210c1a7cd95720f72017202ea02d1edededededed720e917ea3059a7206736692b1a5736792c1b2a5736800997205736992c1b2a5736a00997205736b93cbd0cd7201cbc2b2a5736c0093cbd0cd7202cbc2b2a5736d00cd95720f72027201ea02d17209cd7201ea02d1720bcd7202ea02ea02d1720dcd7201cd7202";

const TIC_TAC_TOE_ERGOSCRIPT = "{\n  // ============================================================\n  // Tic-tac-toe game contract for the ergo-dapp-starter template.\n  //\n  // Registers:\n  //   R4: Coll[Byte], length 9   — board (0 empty, 1 X, 2 O)\n  //   R5: GroupElement           — player 1 (X)\n  //   R6: GroupElement           — player 2 (O); equals R5 while open\n  //   R7: Long                   — wager per player (nanoErgs)\n  //   R8: Long                   — block height of last on-chain activity\n  //                                  (set at create/join; updated each MOVE;\n  //                                   must satisfy lastActive <= R8 <= HEIGHT)\n  //\n  // Branches: CANCEL, JOIN, MOVE, CLAIM_X, CLAIM_O, DRAW,\n  //           IDLE_REFUND (waiting player refunds both after inactivity)\n  // ============================================================\n\n  val board  = SELF.R4[Coll[Byte]].get\n  val p1     = SELF.R5[GroupElement].get\n  val p2     = SELF.R6[GroupElement].get\n  val wager  = SELF.R7[Long].get\n  val lastActive = SELF.R8[Long].get\n\n  val empty: Byte = 0\n  val X: Byte     = 1\n  val O: Byte     = 2\n\n  val idleBlocks = 5040L\n  val feeAllow = 5000000L\n\n  val count = board.fold(0, { (acc: Int, c: Byte) =>\n    if (c != empty) acc + 1 else acc\n  })\n\n  val open = p1 == p2\n\n  val xWon =\n    (board(0) == X && board(1) == X && board(2) == X) ||\n    (board(3) == X && board(4) == X && board(5) == X) ||\n    (board(6) == X && board(7) == X && board(8) == X) ||\n    (board(0) == X && board(3) == X && board(6) == X) ||\n    (board(1) == X && board(4) == X && board(7) == X) ||\n    (board(2) == X && board(5) == X && board(8) == X) ||\n    (board(0) == X && board(4) == X && board(8) == X) ||\n    (board(2) == X && board(4) == X && board(6) == X)\n\n  val oWon =\n    (board(0) == O && board(1) == O && board(2) == O) ||\n    (board(3) == O && board(4) == O && board(5) == O) ||\n    (board(6) == O && board(7) == O && board(8) == O) ||\n    (board(0) == O && board(3) == O && board(6) == O) ||\n    (board(1) == O && board(4) == O && board(7) == O) ||\n    (board(2) == O && board(5) == O && board(8) == O) ||\n    (board(0) == O && board(4) == O && board(8) == O) ||\n    (board(2) == O && board(4) == O && board(6) == O)\n\n  val drawn   = count == 9 && !xWon && !oWon\n  val ongoing = !open && !xWon && !oWon && !drawn\n\n  val p1Turn    = count % 2 == 0\n  val mover     = if (p1Turn) p1 else p2\n  val moverSym  = if (p1Turn) X else O\n  val waiter    = if (p1Turn) p2 else p1\n\n  val cancelBranch = open\n\n  // R8 = last activity height. Require monotonic update and \"not in the future\"\n  // so mempool validation still passes when HEIGHT advances past the tip the\n  // client used when building the tx (Explorer vs block-attachment skew).\n  val joinBranch = open && {\n    val out = OUTPUTS(0)\n    val newLA = out.R8[Long].get\n    out.propositionBytes == SELF.propositionBytes &&\n    out.R4[Coll[Byte]].get == board &&\n    out.R5[GroupElement].get == p1 &&\n    out.R6[GroupElement].get != p1 &&\n    out.R7[Long].get == wager &&\n    newLA >= lastActive &&\n    newLA <= HEIGHT &&\n    out.value >= SELF.value + wager\n  }\n\n  val moveBranch = ongoing && {\n    val out       = OUTPUTS(0)\n    val newBoard  = out.R4[Coll[Byte]].get\n    val newLA     = out.R8[Long].get\n    val pairs     = board.zip(newBoard)\n\n    val allCellsValid = pairs.forall { (pr: (Byte, Byte)) =>\n      pr._1 == pr._2 || (pr._1 == empty && pr._2 == moverSym)\n    }\n\n    val changeCount = pairs.fold(0, { (acc: Int, pr: (Byte, Byte)) =>\n      if (pr._1 != pr._2) acc + 1 else acc\n    })\n\n    newBoard.size == 9 &&\n    changeCount == 1 &&\n    allCellsValid &&\n    out.propositionBytes == SELF.propositionBytes &&\n    out.R5[GroupElement].get == p1 &&\n    out.R6[GroupElement].get == p2 &&\n    out.R7[Long].get == wager &&\n    newLA >= lastActive &&\n    newLA <= HEIGHT &&\n    out.value >= SELF.value\n  }\n\n  val idleRefundBranch = ongoing &&\n    HEIGHT > lastActive + idleBlocks &&\n    OUTPUTS.size >= 2 &&\n    OUTPUTS(0).value >= wager - feeAllow &&\n    OUTPUTS(1).value >= wager - feeAllow &&\n    blake2b256(proveDlog(p1).propBytes) == blake2b256(OUTPUTS(0).propositionBytes) &&\n    blake2b256(proveDlog(p2).propBytes) == blake2b256(OUTPUTS(1).propositionBytes)\n\n  (cancelBranch && proveDlog(p1))             ||\n  joinBranch                                   ||\n  (moveBranch   && proveDlog(mover))          ||\n  (idleRefundBranch && proveDlog(waiter))    ||\n  (xWon         && proveDlog(p1))             ||\n  (oWon         && proveDlog(p2))             ||\n  (drawn        && proveDlog(p1) && proveDlog(p2))\n}\n";

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
  /** Block height of last create/join/move; used for idle refund. */
  lastActiveHeight: number;
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

export const encodeR8LastActive = (height: number): string =>
  SLong(BigInt(height)).toHex();

export const encodeAllRegisters = (state: GameState) => ({
  R4: encodeR4Board(state.board),
  R5: encodeR5_6Pubkey(state.p1PubKeyHex),
  R6: encodeR5_6Pubkey(state.p2PubKeyHex),
  R7: encodeR7Wager(state.wagerNanoErg),
  R8: encodeR8LastActive(state.lastActiveHeight),
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
  const r8 = decodeRegister(regs.R8);
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

  const rawH = r8
    ? (r8.data as bigint | number)
    : 0;
  const lastActiveHeight =
    r8 === null
      ? 0
      : Number(typeof rawH === "bigint" ? rawH : BigInt(rawH as number));

  try {
    return {
      board,
      p1PubKeyHex: bytesToHex(p1),
      p2PubKeyHex: bytesToHex(p2),
      wagerNanoErg,
      lastActiveHeight,
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
