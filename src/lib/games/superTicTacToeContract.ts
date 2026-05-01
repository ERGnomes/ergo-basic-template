/**
 * Super (Ultimate) Tic Tac Toe contract — compile + encode/decode.
 * Source: src/ergoscript/superTicTacToe.es (keep in sync).
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
import {
  EMPTY_SUPER_BOARD,
  type SuperBoard,
  type SuperGame,
  initialSuperGame,
} from "./superTicTacToeLogic";

type CompiledTree = ReturnType<typeof compile>;

export const SUPER_TIC_TAC_TOE_TREE_HEX = "19e11df3020412040204020402040404020406040204080402040a0402040c0402040e04020410040204060402040c04020402040204080402040e040204040402040a04020410040204080402041004020404040204080402040c040204000402040404060408040a040c040e04100406040c04020408040e0404040a04100408041004040408040c0412040404020404040404040406040404080404040a0404040c0404040e04040410040404060404040c04040402040404080404040e040404040404040a04040410040404080404041004040404040404080404040c040404000402040404060408040a040c040e04100406040c04020408040e0404040a04100408041004040408040c0412040004020400040404000406040004080400040a0400040c0400040e04000410040004000402040404060408040a040c040e0410040004000402040404000400040004000402040404060408040a040c040e04100412041404160418041a041c041e04200422042404260428042a042c042e04300432043404360438043a043c043e04400442044404460448044a044c044e04500452045404560458045a045c045e04600462046404660468046a046c046e04700472047404760478047a047c047e048001048201048401048601048801048a01048c01048e01049001049201049401049601049801049a01049c01049e0104a00104010400040104120412041204a20104000402040204000400040204040501050005100400040004020400040404000406040004080400040a0400040c0400040e040004100400040204020402040404020406040204080402040a0402040c0402040e04020410040204060402040c04020402040204080402040e040204040402040a04020410040204080402041004020404040204080402040c0402040404020404040404040406040404080404040a0404040c0404040e040404100404040404060404040c04040402040404080404040e040404040404040a040404100404040404080404041004040404040404080404040c04040501d80fd601e4c6a70507d602e4c6a70607d6039372017202d604e4c6a7040ed605e4c6a70705d606e4c6a70805d607d9010704d802d6099c72077300d60a937eb27204720900047301ecececececececeded720a937eb272049a7209730200047303937eb272049a7209730400047305eded937eb272049a7209730600047307937eb272049a7209730800047309937eb272049a7209730a0004730beded937eb272049a7209730c0004730d937eb272049a7209730e0004730f937eb272049a7209731000047311eded720a937eb272049a7209731200047313937eb272049a7209731400047315eded937eb272049a7209731600047317937eb272049a7209731800047319937eb272049a7209731a0004731beded937eb272049a7209731c0004731d937eb272049a7209731e0004731f937eb272049a7209732000047321eded720a937eb272049a7209732200047323937eb272049a7209732400047325eded937eb272049a7209732600047327937eb272049a7209732800047329937eb272049a7209732a0004732bd608da720701732cd609ecececececececeded7208da720701732dda720701732eededda720701732fda7207017330da7207017331ededda7207017332da7207017333da7207017334eded7208da7207017335da7207017336ededda7207017337da7207017338da7207017339ededda720701733ada720701733bda720701733ceded7208da720701733dda720701733eededda720701733fda7207017340da7207017341d60ad9010a04d802d60c9c720a7342d60d937eb27204720c00047343ecececececececeded720d937eb272049a720c734400047345937eb272049a720c734600047347eded937eb272049a720c734800047349937eb272049a720c734a0004734b937eb272049a720c734c0004734deded937eb272049a720c734e0004734f937eb272049a720c735000047351937eb272049a720c735200047353eded720d937eb272049a720c735400047355937eb272049a720c735600047357eded937eb272049a720c735800047359937eb272049a720c735a0004735b937eb272049a720c735c0004735deded937eb272049a720c735e0004735f937eb272049a720c736000047361937eb272049a720c736200047363eded720d937eb272049a720c736400047365937eb272049a720c736600047367eded937eb272049a720c736800047369937eb272049a720c736a0004736b937eb272049a720c736c0004736dd60bda720a01736ed60cecececececececeded720bda720a01736fda720a017370ededda720a017371da720a017372da720a017373ededda720a017374da720a017375da720a017376eded720bda720a017377da720a017378ededda720a017379da720a01737ada720a01737bededda720a01737cda720a01737dda720a01737eeded720bda720a01737fda720a01738001ededda720a01738101da720a01738201da720a01738301d60dd9010d04d801d60fda720701720decec720fda720a01720dededdad9011004d801d6129c7210738401edededededededed947eb2720472120004738501947eb272049a72127386010004738701947eb272049a72127388010004738901947eb272049a7212738a010004738b01947eb272049a7212738c010004738d01947eb272049a7212738e010004738f01947eb272049a72127390010004739101947eb272049a72127392010004739301947eb272049a7212739401000473950101720def720fefda720a01720dd60eededededededededededda720d01739601da720d01739701da720d01739801da720d01739901da720d01739a01da720d01739b01da720d01739c01da720d01739d01da720d01739e01ef7209ef720cd60f939eb07204739f01d9010f4002d801d6118c720f0195947e8c720f020473a0019a721173a101721173a20173a301eb02eb02eb02eb02eb02ea02d17203cd7201d1ed7203d801d610b2a573a40100edededededed93c27210c2a793e4c67210040e720493e4c672100507720194e4c672100607720193e4c672100705720593e4c672100805720692c172109ac1a77205ea02d1ededededef7203ef7209ef720cef720ed808d610b2a573a50100d611e4c67210040ed612dc0c1d7204017211d613b083510473a60173a70173a80173a90173aa0173ab0173ac0173ad0173ae0173af0173b00173b10173b20173b30173b40173b50173b60173b70173b80173b90173ba0173bb0173bc0173bd0173be0173bf0173c00173c10173c20173c30173c40173c50173c60173c70173c80173c90173ca0173cb0173cc0173cd0173ce0173cf0173d00173d10173d20173d30173d40173d50173d60173d70173d80173d90173da0173db0173dc0173dd0173de0173df0173e00173e10173e20173e30173e40173e50173e60173e70173e80173e90173ea0173eb0173ec0173ed0173ee0173ef0173f00173f10173f20173f30173f40173f50173f60173f701d9011358d802d6158c721301d6168c7213029592721573f80172159594b27204721600b27211721600721673f901d6149d721373fa01d6159e721373fb01d6169c721573fc01d6177eb2721172160004edededededededededededed93b1721173fd0193b0721273fe01d901184056d802d61a8c721802d61b8c72180195948c721a018c721a029a721b73ff01721b738002927213738102af7212d9011856d802d61a8c721801d61b8c721802ec93721a721bed937e721a04738202937e721b0495720f738302738402ec937206738502eded9272067386029072067387029372147d720604efda720d017214937eb272047213000473880293e4c67210080595ededededededededed947217738902947eb272119a7216738a020004738b02947eb272119a7216738c020004738d02947eb272119a7216738e020004738f02947eb272119a72167390020004739102947eb272119a72167392020004739302947eb272119a72167394020004739502947eb272119a72167396020004739702947eb272119a72167398020004739902d801d618937217739a02efecececececececececececececececeded7218937eb272119a7216739b020004739c02937eb272119a7216739d020004739e02eded937eb272119a7216739f02000473a002937eb272119a721673a102000473a202937eb272119a721673a302000473a402eded937eb272119a721673a502000473a602937eb272119a721673a702000473a802937eb272119a721673a902000473aa02eded7218937eb272119a721673ab02000473ac02937eb272119a721673ad02000473ae02eded937eb272119a721673af02000473b002937eb272119a721673b102000473b202937eb272119a721673b302000473b402eded937eb272119a721673b502000473b602937eb272119a721673b702000473b802937eb272119a721673b902000473ba02eded7218937eb272119a721673bb02000473bc02937eb272119a721673bd02000473be02eded937eb272119a721673bf02000473c002937eb272119a721673c102000473c202937eb272119a721673c302000473c402eded93721773c502937eb272119a721673c602000473c702937eb272119a721673c802000473c902eded937eb272119a721673ca02000473cb02937eb272119a721673cc02000473cd02937eb272119a721673ce02000473cf02eded937eb272119a721673d002000473d102937eb272119a721673d202000473d302937eb272119a721673d402000473d502eded93721773d602937eb272119a721673d702000473d802937eb272119a721673d902000473da02eded937eb272119a721673db02000473dc02937eb272119a721673dd02000473de02937eb272119a721673df02000473e002eded937eb272119a721673e102000473e202937eb272119a721673e302000473e402937eb272119a721673e502000473e602eded93721773e702937eb272119a721673e802000473e902937eb272119a721673ea02000473eb02eded937eb272119a721673ec02000473ed02937eb272119a721673ee02000473ef02937eb272119a721673f002000473f10273f2027e72150593c27210c2a793e4c672100507720193e4c672100607720293e4c672100705720592c17210c1a7cd95720f72017202ea02d17209cd7201ea02d1720ccd7202ea02ea02d1720ecd7201cd7202";

const SUPER_TIC_TAC_TOE_ERGOSCRIPT = "{\n  // Ultimate (Super) Tic Tac Toe — same economic model as ticTacToe.es:\n  // R4: Coll[Byte] length 81 — nine 3×3 boards flattened (sub0 cells 0..8, sub1, …)\n  // R5: GroupElement — player 1 (X)\n  // R6: GroupElement — player 2 (O); equals R5 while open\n  // R7: Long — wager per player (nanoErgs)\n  // R8: Long — next sub-board: -1 = play anywhere legal; 0..8 = must play in that sub\n  //\n  // Branches: CANCEL, JOIN, MOVE, CLAIM_X (meta), CLAIM_O (meta), DRAW (meta full, co-sign)\n\n  val board      = SELF.R4[Coll[Byte]].get\n  val p1         = SELF.R5[GroupElement].get\n  val p2         = SELF.R6[GroupElement].get\n  val wager      = SELF.R7[Long].get\n  val constraint = SELF.R8[Long].get\n\n  val empty: Byte = 0\n  val X: Byte     = 1\n  val O: Byte     = 2\n  val FREE: Long  = -1L\n\n  val count = board.fold(0, { (acc: Int, c: Byte) =>\n    if (c != empty) acc + 1 else acc\n  })\n\n  val open = p1 == p2\n\n  // ---------- helpers: board index i for sub s, cell c: i = s*9 + c ----------\n  val subXWon = { (s: Int) =>\n    val b = s * 9\n    (board(b+0) == X && board(b+1) == X && board(b+2) == X) ||\n    (board(b+3) == X && board(b+4) == X && board(b+5) == X) ||\n    (board(b+6) == X && board(b+7) == X && board(b+8) == X) ||\n    (board(b+0) == X && board(b+3) == X && board(b+6) == X) ||\n    (board(b+1) == X && board(b+4) == X && board(b+7) == X) ||\n    (board(b+2) == X && board(b+5) == X && board(b+8) == X) ||\n    (board(b+0) == X && board(b+4) == X && board(b+8) == X) ||\n    (board(b+2) == X && board(b+4) == X && board(b+6) == X)\n  }\n\n  val subOWon = { (s: Int) =>\n    val b = s * 9\n    (board(b+0) == O && board(b+1) == O && board(b+2) == O) ||\n    (board(b+3) == O && board(b+4) == O && board(b+5) == O) ||\n    (board(b+6) == O && board(b+7) == O && board(b+8) == O) ||\n    (board(b+0) == O && board(b+3) == O && board(b+6) == O) ||\n    (board(b+1) == O && board(b+4) == O && board(b+7) == O) ||\n    (board(b+2) == O && board(b+5) == O && board(b+8) == O) ||\n    (board(b+0) == O && board(b+4) == O && board(b+8) == O) ||\n    (board(b+2) == O && board(b+4) == O && board(b+6) == O)\n  }\n\n  val subFull = { (s: Int) =>\n    val b = s * 9\n    board(b+0) != empty && board(b+1) != empty && board(b+2) != empty &&\n    board(b+3) != empty && board(b+4) != empty && board(b+5) != empty &&\n    board(b+6) != empty && board(b+7) != empty && board(b+8) != empty\n  }\n\n  val subDecided = { (s: Int) =>\n    subXWon(s) || subOWon(s) || (subFull(s) && !(subXWon(s)) && !(subOWon(s)))\n  }\n\n  val metaXWon =\n    (subXWon(0) && subXWon(1) && subXWon(2)) ||\n    (subXWon(3) && subXWon(4) && subXWon(5)) ||\n    (subXWon(6) && subXWon(7) && subXWon(8)) ||\n    (subXWon(0) && subXWon(3) && subXWon(6)) ||\n    (subXWon(1) && subXWon(4) && subXWon(7)) ||\n    (subXWon(2) && subXWon(5) && subXWon(8)) ||\n    (subXWon(0) && subXWon(4) && subXWon(8)) ||\n    (subXWon(2) && subXWon(4) && subXWon(6))\n\n  val metaOWon =\n    (subOWon(0) && subOWon(1) && subOWon(2)) ||\n    (subOWon(3) && subOWon(4) && subOWon(5)) ||\n    (subOWon(6) && subOWon(7) && subOWon(8)) ||\n    (subOWon(0) && subOWon(3) && subOWon(6)) ||\n    (subOWon(1) && subOWon(4) && subOWon(7)) ||\n    (subOWon(2) && subOWon(5) && subOWon(8)) ||\n    (subOWon(0) && subOWon(4) && subOWon(8)) ||\n    (subOWon(2) && subOWon(4) && subOWon(6))\n\n  val metaDrawn =\n    subDecided(0) && subDecided(1) && subDecided(2) &&\n    subDecided(3) && subDecided(4) && subDecided(5) &&\n    subDecided(6) && subDecided(7) && subDecided(8) &&\n    !metaXWon && !metaOWon\n\n  val ongoing = !open && !metaXWon && !metaOWon && !metaDrawn\n\n  val p1Turn    = count % 2 == 0\n  val mover     = if (p1Turn) p1 else p2\n  val moverSym  = if (p1Turn) X else O\n\n  val cancelBranch = open\n\n  val joinBranch = open && {\n    val out = OUTPUTS(0)\n    out.propositionBytes == SELF.propositionBytes &&\n    out.R4[Coll[Byte]].get == board &&\n    out.R5[GroupElement].get == p1 &&\n    out.R6[GroupElement].get != p1 &&\n    out.R7[Long].get == wager &&\n    out.R8[Long].get == constraint &&\n    out.value >= SELF.value + wager\n  }\n\n  // MOVE: one empty -> moverSym; legal sub-board; R8' from Ultimate rule\n  val moveBranch = ongoing && {\n    val out          = OUTPUTS(0)\n    val newBoard     = out.R4[Coll[Byte]].get\n    val newConstr    = out.R8[Long].get\n    val pairs        = board.zip(newBoard)\n    val changeCount = pairs.fold(0, { (acc: Int, pr: (Byte, Byte)) =>\n      if (pr._1 != pr._2) acc + 1 else acc\n    })\n    val allCellsValid = pairs.forall { (pr: (Byte, Byte)) =>\n      pr._1 == pr._2 || (pr._1 == empty && pr._2 == moverSym)\n    }\n\n    // Single changed cell index (0..80) — exactly one diff required\n    val IDX = Coll(0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80)\n    val changedIdx = IDX.fold(-1, { (acc: Int, i: Int) =>\n      if (acc >= 0) acc\n      else if (board(i) != newBoard(i)) i\n      else -1\n    })\n\n    val playSub = changedIdx / 9\n    val playCell = changedIdx % 9\n\n    val subLegal =\n      (constraint == FREE) ||\n      (constraint >= 0L && constraint <= 8L && playSub == constraint.toInt)\n\n    val targetNext = playCell\n    val tBase = targetNext * 9\n    val nextTargetDecided =\n      (newBoard(tBase+0) != empty && newBoard(tBase+1) != empty && newBoard(tBase+2) != empty &&\n       newBoard(tBase+3) != empty && newBoard(tBase+4) != empty && newBoard(tBase+5) != empty &&\n       newBoard(tBase+6) != empty && newBoard(tBase+7) != empty && newBoard(tBase+8) != empty) &&\n      !(\n        (newBoard(tBase+0) == X && newBoard(tBase+1) == X && newBoard(tBase+2) == X) ||\n        (newBoard(tBase+3) == X && newBoard(tBase+4) == X && newBoard(tBase+5) == X) ||\n        (newBoard(tBase+6) == X && newBoard(tBase+7) == X && newBoard(tBase+8) == X) ||\n        (newBoard(tBase+0) == X && newBoard(tBase+3) == X && newBoard(tBase+6) == X) ||\n        (newBoard(tBase+1) == X && newBoard(tBase+4) == X && newBoard(tBase+7) == X) ||\n        (newBoard(tBase+2) == X && newBoard(tBase+5) == X && newBoard(tBase+8) == X) ||\n        (newBoard(tBase+0) == X && newBoard(tBase+4) == X && newBoard(tBase+8) == X) ||\n        (newBoard(tBase+2) == X && newBoard(tBase+4) == X && newBoard(tBase+6) == X) ||\n        (newBoard(tBase+0) == O && newBoard(tBase+1) == O && newBoard(tBase+2) == O) ||\n        (newBoard(tBase+3) == O && newBoard(tBase+4) == O && newBoard(tBase+5) == O) ||\n        (newBoard(tBase+6) == O && newBoard(tBase+7) == O && newBoard(tBase+8) == O) ||\n        (newBoard(tBase+0) == O && newBoard(tBase+3) == O && newBoard(tBase+6) == O) ||\n        (newBoard(tBase+1) == O && newBoard(tBase+4) == O && newBoard(tBase+7) == O) ||\n        (newBoard(tBase+2) == O && newBoard(tBase+5) == O && newBoard(tBase+8) == O) ||\n        (newBoard(tBase+0) == O && newBoard(tBase+4) == O && newBoard(tBase+8) == O) ||\n        (newBoard(tBase+2) == O && newBoard(tBase+4) == O && newBoard(tBase+6) == O)\n      )\n\n    val expectConstr = if (nextTargetDecided) FREE else targetNext.toLong\n\n    newBoard.size == 81 &&\n    changeCount == 1 &&\n    changedIdx >= 0 &&\n    allCellsValid &&\n    subLegal &&\n    !(subDecided(playSub)) &&\n    board(changedIdx) == empty &&\n    newConstr == expectConstr &&\n    out.propositionBytes == SELF.propositionBytes &&\n    out.R5[GroupElement].get == p1 &&\n    out.R6[GroupElement].get == p2 &&\n    out.R7[Long].get == wager &&\n    out.value >= SELF.value\n  }\n\n  (cancelBranch && proveDlog(p1))             ||\n  joinBranch                                   ||\n  (moveBranch   && proveDlog(mover))          ||\n  (metaXWon     && proveDlog(p1))             ||\n  (metaOWon     && proveDlog(p2))             ||\n  (metaDrawn    && proveDlog(p1) && proveDlog(p2))\n}\n";

let cachedTree: CompiledTree | null = null;

export const getSuperGameErgoTree = (): CompiledTree => {
  if (cachedTree) return cachedTree;
  cachedTree = compile(SUPER_TIC_TAC_TOE_ERGOSCRIPT, {
    network: "mainnet",
    version: 1,
  });
  return cachedTree;
};

export const getSuperGameErgoTreeHex = (): string => getSuperGameErgoTree().toHex();

export const getSuperGameP2SAddress = (): string =>
  ErgoAddress.fromErgoTree(getSuperGameErgoTree().toHex(), Network.Mainnet).encode(
    Network.Mainnet
  );

export interface SuperChainGameState {
  boards: SuperBoard;
  constraintSub: number | null;
  p1PubKeyHex: string;
  p2PubKeyHex: string;
  wagerNanoErg: bigint;
}

export const superBoardToBytes = (boards: SuperBoard): Uint8Array => {
  const u = new Uint8Array(81);
  let o = 0;
  for (let s = 0; s < 9; s++) {
    const sub = boards[s];
    for (let c = 0; c < 9; c++) u[o++] = sub[c];
  }
  return u;
};

export const encodeSuperR4Board = (boards: SuperBoard): string =>
  SColl(SByte, superBoardToBytes(boards)).toHex();

export const encodeSuperR8Constraint = (constraintSub: number | null): string => {
  const v = constraintSub === null ? BigInt(-1) : BigInt(constraintSub);
  return SLong(v).toHex();
};

export const encodeSuperAllRegisters = (state: SuperChainGameState) => ({
  R4: encodeSuperR4Board(state.boards),
  R5: encodeR5_6Pubkey(state.p1PubKeyHex),
  R6: encodeR5_6Pubkey(state.p2PubKeyHex),
  R7: encodeR7Wager(state.wagerNanoErg),
  R8: encodeSuperR8Constraint(state.constraintSub),
});

const encodeR5_6Pubkey = (pubkeyHex: string): string =>
  SGroupElement(hexToBytes(pubkeyHex)).toHex();

const encodeR7Wager = (wager: bigint): string => SLong(wager).toHex();

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
  spentTransactionId?: string | null;
  settlementHeight?: number;
  transactionId?: string;
}

export const parseSuperGameBox = (box: ExplorerBoxLike): SuperChainGameState | null => {
  const regs = box.additionalRegisters || {};
  const r4 = decodeRegister(regs.R4);
  const r5 = decodeRegister(regs.R5);
  const r6 = decodeRegister(regs.R6);
  const r7 = decodeRegister(regs.R7);
  const r8 = decodeRegister(regs.R8);
  if (!r4 || !r5 || !r6 || !r7 || !r8) return null;

  const boardBytes: Uint8Array = r4.data as Uint8Array;
  if (!(boardBytes instanceof Uint8Array) || boardBytes.length !== 81) {
    return null;
  }
  const subs: SuperBoard = EMPTY_SUPER_BOARD.map((_, si) => {
    const o = si * 9;
    return [
      boardBytes[o],
      boardBytes[o + 1],
      boardBytes[o + 2],
      boardBytes[o + 3],
      boardBytes[o + 4],
      boardBytes[o + 5],
      boardBytes[o + 6],
      boardBytes[o + 7],
      boardBytes[o + 8],
    ] as unknown as SuperBoard[number];
  }) as unknown as SuperBoard;

  const p1 = r5.data as Uint8Array;
  const p2 = r6.data as Uint8Array;
  if (!(p1 instanceof Uint8Array) || p1.length !== 33) return null;
  if (!(p2 instanceof Uint8Array) || p2.length !== 33) return null;

  const rawWager = r7.data as bigint | number;
  const wagerNanoErg =
    typeof rawWager === "bigint" ? rawWager : BigInt(rawWager);

  const rawC = r8.data as bigint | number;
  const cBig = typeof rawC === "bigint" ? rawC : BigInt(rawC);
  const constraintSub = cBig === BigInt(-1) ? null : Number(cBig);

  try {
    return {
      boards: subs,
      constraintSub,
      p1PubKeyHex: bytesToHex(p1),
      p2PubKeyHex: bytesToHex(p2),
      wagerNanoErg,
    };
  } catch {
    return null;
  }
};

export const superChainStateToGame = (s: SuperChainGameState): SuperGame => ({
  boards: s.boards,
  constraintSub: s.constraintSub,
});

export const initialSuperChainOpenState = (
  p1PubKeyHex: string,
  wagerNanoErg: bigint
): SuperChainGameState => ({
  ...initialSuperGame(),
  p1PubKeyHex,
  p2PubKeyHex: p1PubKeyHex,
  wagerNanoErg,
});

export const pubkeyToMainnetAddress = (pubkeyHex: string): string =>
  ErgoAddress.fromPublicKey(hexToBytes(pubkeyHex), Network.Mainnet).encode(
    Network.Mainnet
  );

export const isSuperOpenGame = (state: SuperChainGameState): boolean =>
  state.p1PubKeyHex === state.p2PubKeyHex;
