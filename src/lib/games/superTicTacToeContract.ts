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

export const SUPER_TIC_TAC_TOE_TREE_HEX = "19f71ef9020412040204020402040404020406040204080402040a0402040c0402040e04020410040204060402040c04020402040204080402040e040204040402040a04020410040204080402041004020404040204080402040c040204000402040404060408040a040c040e04100406040c04020408040e0404040a04100408041004040408040c0412040404020404040404040406040404080404040a0404040c0404040e04040410040404060404040c04040402040404080404040e040404040404040a04040410040404080404041004040404040404080404040c040404000402040404060408040a040c040e04100406040c04020408040e0404040a04100408041004040408040c0412040004020400040404000406040004080400040a0400040c0400040e04000410040004000402040404060408040a040c040e0410040004000402040404000400040004000402040404060408040a040c040e04100412041404160418041a041c041e04200422042404260428042a042c042e04300432043404360438043a043c043e04400442044404460448044a044c044e04500452045404560458045a045c045e04600462046404660468046a046c046e04700472047404760478047a047c047e048001048201048401048601048801048a01048c01048e01049001049201049401049601049801049a01049c01049e0104a001040104000401041204120412040204020402040404020406040204080402040a0402040c0402040e04020410040204060402040c04020402040204080402040e040204040402040a04020410040204080402041004020404040204080402040c0402040404020404040404040406040404080404040a0404040c0404040e04040410040404060404040c04040402040404080404040e040404040404040a04040410040404080404041004040404040404080404040c040404a20104000402040204000400040204040501050005100400040004020400040404000406040004080400040a0400040c0400040e040004100400050105e04e040404000580ade20404020580ade20404000402d810d601e4c6a70507d602e4c6a70607d6039372017202d604e4c6a7040ed605e4c6a70705d606e4c6a70905d607d9010704d802d6099c72077300d60a937eb27204720900047301ecececececececeded720a937eb272049a7209730200047303937eb272049a7209730400047305eded937eb272049a7209730600047307937eb272049a7209730800047309937eb272049a7209730a0004730beded937eb272049a7209730c0004730d937eb272049a7209730e0004730f937eb272049a7209731000047311eded720a937eb272049a7209731200047313937eb272049a7209731400047315eded937eb272049a7209731600047317937eb272049a7209731800047319937eb272049a7209731a0004731beded937eb272049a7209731c0004731d937eb272049a7209731e0004731f937eb272049a7209732000047321eded720a937eb272049a7209732200047323937eb272049a7209732400047325eded937eb272049a7209732600047327937eb272049a7209732800047329937eb272049a7209732a0004732bd608da720701732cd609ecececececececeded7208da720701732dda720701732eededda720701732fda7207017330da7207017331ededda7207017332da7207017333da7207017334eded7208da7207017335da7207017336ededda7207017337da7207017338da7207017339ededda720701733ada720701733bda720701733ceded7208da720701733dda720701733eededda720701733fda7207017340da7207017341d60ad9010a04d802d60c9c720a7342d60d937eb27204720c00047343ecececececececeded720d937eb272049a720c734400047345937eb272049a720c734600047347eded937eb272049a720c734800047349937eb272049a720c734a0004734b937eb272049a720c734c0004734deded937eb272049a720c734e0004734f937eb272049a720c735000047351937eb272049a720c735200047353eded720d937eb272049a720c735400047355937eb272049a720c735600047357eded937eb272049a720c735800047359937eb272049a720c735a0004735b937eb272049a720c735c0004735deded937eb272049a720c735e0004735f937eb272049a720c736000047361937eb272049a720c736200047363eded720d937eb272049a720c736400047365937eb272049a720c736600047367eded937eb272049a720c736800047369937eb272049a720c736a0004736b937eb272049a720c736c0004736dd60bda720a01736ed60cecececececececeded720bda720a01736fda720a017370ededda720a017371da720a017372da720a017373ededda720a017374da720a017375da720a017376eded720bda720a017377da720a017378ededda720a017379da720a01737ada720a01737bededda720a01737cda720a01737dda720a01737eeded720bda720a01737fda720a01738001ededda720a01738101da720a01738201da720a01738301d60dd9010d04d801d60fda720701720decec720fda720a01720dededdad9011004d801d6129c7210738401edededededededed947eb2720472120004738501947eb272049a72127386010004738701947eb272049a72127388010004738901947eb272049a7212738a010004738b01947eb272049a7212738c010004738d01947eb272049a7212738e010004738f01947eb272049a72127390010004739101947eb272049a72127392010004739301947eb272049a7212739401000473950101720def720fefda720a01720dd60eededededededededededda720d01739601da720d01739701da720d01739801da720d01739901da720d01739a01da720d01739b01da720d01739c01da720d01739d01da720d01739e01ef7209ef720cd60fedededef7203ef7209ef720cef720ed610939eb07204739f01d901104002d801d6128c72100195947e8c7210020473a0019a721273a101721273a20173a301eb02eb02eb02eb02eb02eb02ea02d17203cd7201d1ed7203d801d611b2a573a40100ededededededed93c27211c2a793e4c67211040e720493e4c672110507720194e4c672110607720193e4c672110705720593e4c6721108057ea30593e4c672110905720692c172119ac1a77205ea02d1ed720fd80cd611b2a573a50100d612e4c67211040ed613dc0c1d7204017212d614b083510473a60173a70173a80173a90173aa0173ab0173ac0173ad0173ae0173af0173b00173b10173b20173b30173b40173b50173b60173b70173b80173b90173ba0173bb0173bc0173bd0173be0173bf0173c00173c10173c20173c30173c40173c50173c60173c70173c80173c90173ca0173cb0173cc0173cd0173ce0173cf0173d00173d10173d20173d30173d40173d50173d60173d70173d80173d90173da0173db0173dc0173dd0173de0173df0173e00173e10173e20173e30173e40173e50173e60173e70173e80173e90173ea0173eb0173ec0173ed0173ee0173ef0173f00173f10173f20173f30173f40173f50173f60173f701d9011458d802d6168c721401d6178c7214029592721673f80172169594b27204721700b27212721700721773f901d6159d721473fa01d6169e721473fb01d6179c721673fc01d6187eb2721272170004d61993721873fd01d61aecececececececeded7219937eb272129a721773fe01000473ff01937eb272129a72177380020004738102eded937eb272129a72177382020004738302937eb272129a72177384020004738502937eb272129a72177386020004738702eded937eb272129a72177388020004738902937eb272129a7217738a020004738b02937eb272129a7217738c020004738d02eded7219937eb272129a7217738e020004738f02937eb272129a72177390020004739102eded937eb272129a72177392020004739302937eb272129a72177394020004739502937eb272129a72177396020004739702eded937eb272129a72177398020004739902937eb272129a7217739a020004739b02937eb272129a7217739c020004739d02eded7219937eb272129a7217739e020004739f02937eb272129a721773a002000473a102eded937eb272129a721773a202000473a302937eb272129a721773a402000473a502937eb272129a721773a602000473a702d61b93721873a802d61cecececececececeded721b937eb272129a721773a902000473aa02937eb272129a721773ab02000473ac02eded937eb272129a721773ad02000473ae02937eb272129a721773af02000473b002937eb272129a721773b102000473b202eded937eb272129a721773b302000473b402937eb272129a721773b502000473b602937eb272129a721773b702000473b802eded721b937eb272129a721773b902000473ba02937eb272129a721773bb02000473bc02eded937eb272129a721773bd02000473be02937eb272129a721773bf02000473c002937eb272129a721773c102000473c202eded937eb272129a721773c302000473c402937eb272129a721773c502000473c602937eb272129a721773c702000473c802eded721b937eb272129a721773c902000473ca02937eb272129a721773cb02000473cc02eded937eb272129a721773cd02000473ce02937eb272129a721773cf02000473d002937eb272129a721773d102000473d202ededededededededededededed93b1721273d30293b0721373d402d9011d4056d802d61f8c721d02d6208c721d0195948c721f018c721f029a722073d502722073d60292721473d702af7213d9011d56d802d61f8c721d01d6208c721d02ec93721f7220ed937e721f0473d802937e72200495721073d90273da02ec93720673db02eded92720673dc0290720673dd029372157d720604efda720d017215937eb272047214000473de0293e4c67211090595ecec721a721cedededededededededed94721873df02947eb272129a721773e002000473e102947eb272129a721773e202000473e302947eb272129a721773e402000473e502947eb272129a721773e602000473e702947eb272129a721773e802000473e902947eb272129a721773ea02000473eb02947eb272129a721773ec02000473ed02947eb272129a721773ee02000473ef02ef721aef721c73f0027e72160593c27211c2a793e4c672110507720193e4c672110607720293e4c672110705720593e4c6721108057ea30592c17211c1a7cd95721072017202ea02d1edededededed720f917ea3059ae4c6a7080573f10292b1a573f20292c1b2a573f3020099720573f40292c1b2a573f5020099720573f60293cbd0cd7201cbc2b2a573f7020093cbd0cd7202cbc2b2a573f80200cd95721072027201ea02d17209cd7201ea02d1720ccd7202ea02ea02d1720ecd7201cd7202";

const SUPER_TIC_TAC_TOE_ERGOSCRIPT = "{\n  // Ultimate (Super) Tic Tac Toe — same economic model as ticTacToe.es:\n  // R4: Coll[Byte] length 81 — nine 3×3 boards flattened\n  // R5: GroupElement — player 1 (X)\n  // R6: GroupElement — player 2 (O); equals R5 while open\n  // R7: Long — wager per player (nanoErgs)\n  // R8: Long — block height of last on-chain activity (create / join / move)\n  // R9: Long — next sub-board: -1 = play anywhere; 0..8 = forced sub\n  //\n  // Branches: CANCEL, JOIN, MOVE, IDLE_REFUND, CLAIM_X, CLAIM_O, DRAW\n\n  val board      = SELF.R4[Coll[Byte]].get\n  val p1         = SELF.R5[GroupElement].get\n  val p2         = SELF.R6[GroupElement].get\n  val wager      = SELF.R7[Long].get\n  val lastActive = SELF.R8[Long].get\n  val constraint = SELF.R9[Long].get\n\n  val empty: Byte = 0\n  val X: Byte     = 1\n  val O: Byte     = 2\n  val FREE: Long  = -1L\n\n  val idleBlocks = 5040L\n  val feeAllow = 5000000L\n\n  val count = board.fold(0, { (acc: Int, c: Byte) =>\n    if (c != empty) acc + 1 else acc\n  })\n\n  val open = p1 == p2\n\n  val subXWon = { (s: Int) =>\n    val b = s * 9\n    (board(b+0) == X && board(b+1) == X && board(b+2) == X) ||\n    (board(b+3) == X && board(b+4) == X && board(b+5) == X) ||\n    (board(b+6) == X && board(b+7) == X && board(b+8) == X) ||\n    (board(b+0) == X && board(b+3) == X && board(b+6) == X) ||\n    (board(b+1) == X && board(b+4) == X && board(b+7) == X) ||\n    (board(b+2) == X && board(b+5) == X && board(b+8) == X) ||\n    (board(b+0) == X && board(b+4) == X && board(b+8) == X) ||\n    (board(b+2) == X && board(b+4) == X && board(b+6) == X)\n  }\n\n  val subOWon = { (s: Int) =>\n    val b = s * 9\n    (board(b+0) == O && board(b+1) == O && board(b+2) == O) ||\n    (board(b+3) == O && board(b+4) == O && board(b+5) == O) ||\n    (board(b+6) == O && board(b+7) == O && board(b+8) == O) ||\n    (board(b+0) == O && board(b+3) == O && board(b+6) == O) ||\n    (board(b+1) == O && board(b+4) == O && board(b+7) == O) ||\n    (board(b+2) == O && board(b+5) == O && board(b+8) == O) ||\n    (board(b+0) == O && board(b+4) == O && board(b+8) == O) ||\n    (board(b+2) == O && board(b+4) == O && board(b+6) == O)\n  }\n\n  val subFull = { (s: Int) =>\n    val b = s * 9\n    board(b+0) != empty && board(b+1) != empty && board(b+2) != empty &&\n    board(b+3) != empty && board(b+4) != empty && board(b+5) != empty &&\n    board(b+6) != empty && board(b+7) != empty && board(b+8) != empty\n  }\n\n  val subDecided = { (s: Int) =>\n    subXWon(s) || subOWon(s) || (subFull(s) && !(subXWon(s)) && !(subOWon(s)))\n  }\n\n  val metaXWon =\n    (subXWon(0) && subXWon(1) && subXWon(2)) ||\n    (subXWon(3) && subXWon(4) && subXWon(5)) ||\n    (subXWon(6) && subXWon(7) && subXWon(8)) ||\n    (subXWon(0) && subXWon(3) && subXWon(6)) ||\n    (subXWon(1) && subXWon(4) && subXWon(7)) ||\n    (subXWon(2) && subXWon(5) && subXWon(8)) ||\n    (subXWon(0) && subXWon(4) && subXWon(8)) ||\n    (subXWon(2) && subXWon(4) && subXWon(6))\n\n  val metaOWon =\n    (subOWon(0) && subOWon(1) && subOWon(2)) ||\n    (subOWon(3) && subOWon(4) && subOWon(5)) ||\n    (subOWon(6) && subOWon(7) && subOWon(8)) ||\n    (subOWon(0) && subOWon(3) && subOWon(6)) ||\n    (subOWon(1) && subOWon(4) && subOWon(7)) ||\n    (subOWon(2) && subOWon(5) && subOWon(8)) ||\n    (subOWon(0) && subOWon(4) && subOWon(8)) ||\n    (subOWon(2) && subOWon(4) && subOWon(6))\n\n  val metaDrawn =\n    subDecided(0) && subDecided(1) && subDecided(2) &&\n    subDecided(3) && subDecided(4) && subDecided(5) &&\n    subDecided(6) && subDecided(7) && subDecided(8) &&\n    !metaXWon && !metaOWon\n\n  val ongoing = !open && !metaXWon && !metaOWon && !metaDrawn\n\n  val p1Turn    = count % 2 == 0\n  val mover     = if (p1Turn) p1 else p2\n  val moverSym  = if (p1Turn) X else O\n  val waiter    = if (p1Turn) p2 else p1\n\n  val cancelBranch = open\n\n  val joinBranch = open && {\n    val out = OUTPUTS(0)\n    out.propositionBytes == SELF.propositionBytes &&\n    out.R4[Coll[Byte]].get == board &&\n    out.R5[GroupElement].get == p1 &&\n    out.R6[GroupElement].get != p1 &&\n    out.R7[Long].get == wager &&\n    out.R8[Long].get == HEIGHT &&\n    out.R9[Long].get == constraint &&\n    out.value >= SELF.value + wager\n  }\n\n  val moveBranch = ongoing && {\n    val out          = OUTPUTS(0)\n    val newBoard     = out.R4[Coll[Byte]].get\n    val newConstr    = out.R9[Long].get\n    val pairs        = board.zip(newBoard)\n    val changeCount = pairs.fold(0, { (acc: Int, pr: (Byte, Byte)) =>\n      if (pr._1 != pr._2) acc + 1 else acc\n    })\n    val allCellsValid = pairs.forall { (pr: (Byte, Byte)) =>\n      pr._1 == pr._2 || (pr._1 == empty && pr._2 == moverSym)\n    }\n\n    val IDX = Coll(0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80)\n    val changedIdx = IDX.fold(-1, { (acc: Int, i: Int) =>\n      if (acc >= 0) acc\n      else if (board(i) != newBoard(i)) i\n      else -1\n    })\n\n    val playSub = changedIdx / 9\n    val playCell = changedIdx % 9\n\n    val subLegal =\n      (constraint == FREE) ||\n      (constraint >= 0L && constraint <= 8L && playSub == constraint.toInt)\n\n    val targetNext = playCell\n    val tBase = targetNext * 9\n    val nbXWon =\n      (newBoard(tBase+0) == X && newBoard(tBase+1) == X && newBoard(tBase+2) == X) ||\n      (newBoard(tBase+3) == X && newBoard(tBase+4) == X && newBoard(tBase+5) == X) ||\n      (newBoard(tBase+6) == X && newBoard(tBase+7) == X && newBoard(tBase+8) == X) ||\n      (newBoard(tBase+0) == X && newBoard(tBase+3) == X && newBoard(tBase+6) == X) ||\n      (newBoard(tBase+1) == X && newBoard(tBase+4) == X && newBoard(tBase+7) == X) ||\n      (newBoard(tBase+2) == X && newBoard(tBase+5) == X && newBoard(tBase+8) == X) ||\n      (newBoard(tBase+0) == X && newBoard(tBase+4) == X && newBoard(tBase+8) == X) ||\n      (newBoard(tBase+2) == X && newBoard(tBase+4) == X && newBoard(tBase+6) == X)\n    val nbOWon =\n      (newBoard(tBase+0) == O && newBoard(tBase+1) == O && newBoard(tBase+2) == O) ||\n      (newBoard(tBase+3) == O && newBoard(tBase+4) == O && newBoard(tBase+5) == O) ||\n      (newBoard(tBase+6) == O && newBoard(tBase+7) == O && newBoard(tBase+8) == O) ||\n      (newBoard(tBase+0) == O && newBoard(tBase+3) == O && newBoard(tBase+6) == O) ||\n      (newBoard(tBase+1) == O && newBoard(tBase+4) == O && newBoard(tBase+7) == O) ||\n      (newBoard(tBase+2) == O && newBoard(tBase+5) == O && newBoard(tBase+8) == O) ||\n      (newBoard(tBase+0) == O && newBoard(tBase+4) == O && newBoard(tBase+8) == O) ||\n      (newBoard(tBase+2) == O && newBoard(tBase+4) == O && newBoard(tBase+6) == O)\n    val nbFull =\n      newBoard(tBase+0) != empty && newBoard(tBase+1) != empty && newBoard(tBase+2) != empty &&\n      newBoard(tBase+3) != empty && newBoard(tBase+4) != empty && newBoard(tBase+5) != empty &&\n      newBoard(tBase+6) != empty && newBoard(tBase+7) != empty && newBoard(tBase+8) != empty\n    val nextTargetDecided =\n      nbXWon || nbOWon || (nbFull && !(nbXWon) && !(nbOWon))\n\n    val expectConstr = if (nextTargetDecided) FREE else targetNext.toLong\n\n    newBoard.size == 81 &&\n    changeCount == 1 &&\n    changedIdx >= 0 &&\n    allCellsValid &&\n    subLegal &&\n    !(subDecided(playSub)) &&\n    board(changedIdx) == empty &&\n    newConstr == expectConstr &&\n    out.propositionBytes == SELF.propositionBytes &&\n    out.R5[GroupElement].get == p1 &&\n    out.R6[GroupElement].get == p2 &&\n    out.R7[Long].get == wager &&\n    out.R8[Long].get == HEIGHT &&\n    out.value >= SELF.value\n  }\n\n  val idleRefundBranch = ongoing &&\n    HEIGHT > lastActive + idleBlocks &&\n    OUTPUTS.size >= 2 &&\n    OUTPUTS(0).value >= wager - feeAllow &&\n    OUTPUTS(1).value >= wager - feeAllow &&\n    blake2b256(proveDlog(p1).propBytes) == blake2b256(OUTPUTS(0).propositionBytes) &&\n    blake2b256(proveDlog(p2).propBytes) == blake2b256(OUTPUTS(1).propositionBytes)\n\n  (cancelBranch && proveDlog(p1))             ||\n  joinBranch                                   ||\n  (moveBranch   && proveDlog(mover))          ||\n  (idleRefundBranch && proveDlog(waiter))     ||\n  (metaXWon     && proveDlog(p1))             ||\n  (metaOWon     && proveDlog(p2))             ||\n  (metaDrawn    && proveDlog(p1) && proveDlog(p2))\n}\n";

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
  /** Block height of last create/join/move; idle refund if opponent stalls. */
  lastActiveHeight: number;
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

export const encodeSuperR8LastActive = (height: number): string =>
  SLong(BigInt(height)).toHex();

export const encodeSuperR9Constraint = (constraintSub: number | null): string => {
  const v = constraintSub === null ? BigInt(-1) : BigInt(constraintSub);
  return SLong(v).toHex();
};

export const encodeSuperAllRegisters = (state: SuperChainGameState) => ({
  R4: encodeSuperR4Board(state.boards),
  R5: encodeR5_6Pubkey(state.p1PubKeyHex),
  R6: encodeR5_6Pubkey(state.p2PubKeyHex),
  R7: encodeR7Wager(state.wagerNanoErg),
  R8: encodeSuperR8LastActive(state.lastActiveHeight),
  R9: encodeSuperR9Constraint(state.constraintSub),
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
  const r9 = decodeRegister(regs.R9);
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

  let lastActiveHeight = 0;
  let constraintSub: number | null = null;

  if (r9) {
    const rawH = r8.data as bigint | number;
    lastActiveHeight = Number(typeof rawH === "bigint" ? rawH : BigInt(rawH));
    const rawC = r9.data as bigint | number;
    const cBig = typeof rawC === "bigint" ? rawC : BigInt(rawC);
    constraintSub = cBig === BigInt(-1) ? null : Number(cBig);
  } else {
    const rawC = r8.data as bigint | number;
    const cBig = typeof rawC === "bigint" ? rawC : BigInt(rawC);
    constraintSub = cBig === BigInt(-1) ? null : Number(cBig);
    lastActiveHeight = 0;
  }

  try {
    return {
      boards: subs,
      constraintSub,
      p1PubKeyHex: bytesToHex(p1),
      p2PubKeyHex: bytesToHex(p2),
      wagerNanoErg,
      lastActiveHeight,
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
  lastActiveHeight: 0,
});

export const pubkeyToMainnetAddress = (pubkeyHex: string): string =>
  ErgoAddress.fromPublicKey(hexToBytes(pubkeyHex), Network.Mainnet).encode(
    Network.Mainnet
  );

export const isSuperOpenGame = (state: SuperChainGameState): boolean =>
  state.p1PubKeyHex === state.p2PubKeyHex;
