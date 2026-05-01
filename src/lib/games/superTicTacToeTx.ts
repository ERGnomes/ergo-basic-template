/**
 * Transaction builders for the Ultimate (Super) tic-tac-toe contract.
 * Mirrors `ticTacToeTx.ts` (create / join / move / cancel / claim).
 */

import {
  ErgoAddress,
  OutputBuilder,
  RECOMMENDED_MIN_FEE_VALUE,
  SAFE_MIN_BOX_VALUE,
  TransactionBuilder,
} from "@fleet-sdk/core";
import {
  applySuperMove,
  isLegalSuperMove,
  superMetaFull,
  superWinner,
  totalMoves,
  type SuperGame,
} from "./superTicTacToeLogic";
import {
  encodeSuperAllRegisters,
  getSuperGameP2SAddress,
  pubkeyToMainnetAddress,
  type SuperChainGameState,
} from "./superTicTacToeContract";
import { CELL_X } from "./ticTacToeLogic";

const ERGO_API = "https://api.ergoplatform.com/api/v1";

const normalizeExplorerBox = (box: any): any => {
  const regs = box?.additionalRegisters;
  if (!regs || typeof regs !== "object") return box;
  const flatRegs: Record<string, string> = {};
  for (const [k, v] of Object.entries(regs)) {
    if (typeof v === "string") {
      flatRegs[k] = v;
    } else if (v && typeof v === "object") {
      const ser = (v as any).serializedValue;
      if (typeof ser === "string") flatRegs[k] = ser;
    }
  }
  return { ...box, additionalRegisters: flatRegs };
};

const normalizeExplorerBoxes = (boxes: any[]): any[] =>
  boxes.map(normalizeExplorerBox);

const fetchUnspentBoxes = async (address: string): Promise<any[]> => {
  const res = await fetch(
    `${ERGO_API}/boxes/unspent/byAddress/${encodeURIComponent(address)}?limit=50`
  );
  if (!res.ok) throw new Error(`UTXO fetch HTTP ${res.status}`);
  const body = await res.json();
  return body.items || [];
};

const fetchCurrentHeight = async (): Promise<number> => {
  const res = await fetch(`${ERGO_API}/blocks/headers?limit=1`);
  if (!res.ok) throw new Error(`headers HTTP ${res.status}`);
  const body = await res.json();
  return (body.items || body)[0].height;
};

const emptySuperChainState = (
  p1: string,
  p2: string,
  wager: bigint
): SuperChainGameState => ({
  boards: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
  ] as unknown as SuperChainGameState["boards"],
  constraintSub: null,
  p1PubKeyHex: p1,
  p2PubKeyHex: p2,
  wagerNanoErg: wager,
});

export const buildSuperCreateGameTx = async (params: {
  creatorAddress: string;
  creatorPubKeyHex: string;
  wagerNanoErg: bigint;
}) => {
  const { creatorAddress, creatorPubKeyHex, wagerNanoErg } = params;
  if (wagerNanoErg <= BigInt(0)) {
    throw new Error("Wager must be > 0 nanoERG.");
  }

  const inputs = normalizeExplorerBoxes(await fetchUnspentBoxes(creatorAddress));
  if (inputs.length === 0) throw new Error("No unspent boxes at your address.");
  const height = await fetchCurrentHeight();
  const contractAddress = getSuperGameP2SAddress();

  const gameBoxValue = wagerNanoErg + SAFE_MIN_BOX_VALUE;

  const gameState = emptySuperChainState(
    creatorPubKeyHex,
    creatorPubKeyHex,
    wagerNanoErg
  );
  const regs = encodeSuperAllRegisters(gameState);

  const out = new OutputBuilder(
    gameBoxValue,
    ErgoAddress.fromBase58(contractAddress)
  ).setAdditionalRegisters({
    R4: regs.R4 as any,
    R5: regs.R5 as any,
    R6: regs.R6 as any,
    R7: regs.R7 as any,
    R8: regs.R8 as any,
  });

  const unsigned = new TransactionBuilder(height)
    .from(inputs)
    .to(out)
    .sendChangeTo(creatorAddress)
    .payFee(RECOMMENDED_MIN_FEE_VALUE)
    .build()
    .toEIP12Object();

  return { unsignedEip12: unsigned, inputBoxes: inputs };
};

export const buildSuperJoinGameTx = async (params: {
  currentGameBox: any;
  currentGameState: SuperChainGameState;
  joinerAddress: string;
  joinerPubKeyHex: string;
}) => {
  const { currentGameState, joinerAddress, joinerPubKeyHex } = params;
  if (currentGameState.p1PubKeyHex !== currentGameState.p2PubKeyHex) {
    throw new Error("This game has already been joined.");
  }
  if (joinerPubKeyHex === currentGameState.p1PubKeyHex) {
    throw new Error("You can't join your own game.");
  }

  const currentGameBox = normalizeExplorerBox(params.currentGameBox);
  const funding = normalizeExplorerBoxes(await fetchUnspentBoxes(joinerAddress));
  if (funding.length === 0) {
    throw new Error("No unspent boxes at your address to fund the join.");
  }
  const height = await fetchCurrentHeight();

  const newState: SuperChainGameState = {
    ...currentGameState,
    p2PubKeyHex: joinerPubKeyHex,
  };
  const regs = encodeSuperAllRegisters(newState);

  const newValue =
    BigInt(currentGameBox.value) + currentGameState.wagerNanoErg;

  const out = new OutputBuilder(
    newValue,
    ErgoAddress.fromBase58(getSuperGameP2SAddress())
  ).setAdditionalRegisters({
    R4: regs.R4 as any,
    R5: regs.R5 as any,
    R6: regs.R6 as any,
    R7: regs.R7 as any,
    R8: regs.R8 as any,
  });

  const unsigned = new TransactionBuilder(height)
    .from([currentGameBox, ...funding])
    .to(out)
    .sendChangeTo(joinerAddress)
    .payFee(RECOMMENDED_MIN_FEE_VALUE)
    .build()
    .toEIP12Object();

  return {
    unsignedEip12: unsigned,
    inputBoxes: [currentGameBox, ...funding],
  };
};

const chainToSuperGame = (s: SuperChainGameState): SuperGame => ({
  boards: s.boards,
  constraintSub: s.constraintSub,
});

const superGameToChain = (
  g: SuperGame,
  p1: string,
  p2: string,
  wager: bigint
): SuperChainGameState => ({
  boards: g.boards,
  constraintSub: g.constraintSub,
  p1PubKeyHex: p1,
  p2PubKeyHex: p2,
  wagerNanoErg: wager,
});

export const buildSuperMoveTx = async (params: {
  currentGameBox: any;
  currentGameState: SuperChainGameState;
  moverAddress: string;
  moverPubKeyHex: string;
  subIndex: number;
  cellIndex: number;
}) => {
  const { currentGameState, moverAddress, moverPubKeyHex, subIndex, cellIndex } =
    params;
  const currentGameBox = normalizeExplorerBox(params.currentGameBox);

  if (currentGameState.p1PubKeyHex === currentGameState.p2PubKeyHex) {
    throw new Error("Game hasn't been joined yet.");
  }
  if (superWinner(currentGameState.boards) !== null) {
    throw new Error("Game is already won on the meta board.");
  }
  if (superMetaFull(currentGameState.boards)) {
    throw new Error("Meta board is full.");
  }

  const game = chainToSuperGame(currentGameState);
  const xTurn = totalMoves(currentGameState.boards) % 2 === 0;
  const expectedPubKey = xTurn
    ? currentGameState.p1PubKeyHex
    : currentGameState.p2PubKeyHex;
  if (expectedPubKey !== moverPubKeyHex) {
    throw new Error("It's not your turn.");
  }

  if (!isLegalSuperMove(game, subIndex, cellIndex)) {
    throw new Error("Illegal move for Ultimate tic-tac-toe.");
  }

  const nextGame = applySuperMove(game, subIndex, cellIndex);
  const nextState = superGameToChain(
    nextGame,
    currentGameState.p1PubKeyHex,
    currentGameState.p2PubKeyHex,
    currentGameState.wagerNanoErg
  );
  const regs = encodeSuperAllRegisters(nextState);

  const funding = normalizeExplorerBoxes(await fetchUnspentBoxes(moverAddress));
  const height = await fetchCurrentHeight();

  const out = new OutputBuilder(
    BigInt(currentGameBox.value),
    ErgoAddress.fromBase58(getSuperGameP2SAddress())
  ).setAdditionalRegisters({
    R4: regs.R4 as any,
    R5: regs.R5 as any,
    R6: regs.R6 as any,
    R7: regs.R7 as any,
    R8: regs.R8 as any,
  });

  const unsigned = new TransactionBuilder(height)
    .from([currentGameBox, ...funding])
    .to(out)
    .sendChangeTo(moverAddress)
    .payFee(RECOMMENDED_MIN_FEE_VALUE)
    .build()
    .toEIP12Object();

  return {
    unsignedEip12: unsigned,
    inputBoxes: [currentGameBox, ...funding],
  };
};

export const buildSuperCancelGameTx = async (params: {
  currentGameBox: any;
  currentGameState: SuperChainGameState;
  creatorAddress: string;
  creatorPubKeyHex: string;
}) => {
  const { currentGameState, creatorAddress, creatorPubKeyHex } = params;
  const currentGameBox = normalizeExplorerBox(params.currentGameBox);
  if (currentGameState.p1PubKeyHex !== currentGameState.p2PubKeyHex) {
    throw new Error("Game is already joined; cancel is no longer allowed.");
  }
  if (creatorPubKeyHex !== currentGameState.p1PubKeyHex) {
    throw new Error("Only the creator can cancel.");
  }

  const height = await fetchCurrentHeight();
  const gameValue = BigInt(currentGameBox.value);
  const fee = RECOMMENDED_MIN_FEE_VALUE;

  const out = new OutputBuilder(
    gameValue - fee,
    ErgoAddress.fromBase58(creatorAddress)
  );

  const unsigned = new TransactionBuilder(height)
    .from([currentGameBox])
    .to(out)
    .sendChangeTo(creatorAddress)
    .payFee(fee)
    .build()
    .toEIP12Object();

  return { unsignedEip12: unsigned, inputBoxes: [currentGameBox] };
};

export const buildSuperClaimWinTx = async (params: {
  currentGameBox: any;
  currentGameState: SuperChainGameState;
  winnerAddress: string;
  winnerPubKeyHex: string;
}) => {
  const { currentGameState, winnerAddress, winnerPubKeyHex } = params;
  const currentGameBox = normalizeExplorerBox(params.currentGameBox);
  const w = superWinner(currentGameState.boards);
  if (w === null) {
    throw new Error("No meta-board winner yet.");
  }
  const expectedWinnerPk =
    w === CELL_X
      ? currentGameState.p1PubKeyHex
      : currentGameState.p2PubKeyHex;
  if (winnerPubKeyHex !== expectedWinnerPk) {
    throw new Error("You didn't win this game.");
  }

  const height = await fetchCurrentHeight();
  const gameValue = BigInt(currentGameBox.value);
  const fee = RECOMMENDED_MIN_FEE_VALUE;

  const out = new OutputBuilder(
    gameValue - fee,
    ErgoAddress.fromBase58(winnerAddress)
  );

  const unsigned = new TransactionBuilder(height)
    .from([currentGameBox])
    .to(out)
    .sendChangeTo(winnerAddress)
    .payFee(fee)
    .build()
    .toEIP12Object();

  return { unsignedEip12: unsigned, inputBoxes: [currentGameBox] };
};

/**
 * Meta draw: both players must co-sign. Split (value − fee) evenly between p1 and p2.
 */
export const buildSuperDrawSplitTx = async (params: {
  currentGameBox: any;
  currentGameState: SuperChainGameState;
  p1Address: string;
  p2Address: string;
  signerPubKeyHex: string;
}) => {
  const { currentGameState, p1Address, p2Address, signerPubKeyHex } = params;
  const currentGameBox = normalizeExplorerBox(params.currentGameBox);
  if (currentGameState.p1PubKeyHex === currentGameState.p2PubKeyHex) {
    throw new Error("Game is not joined.");
  }
  if (superWinner(currentGameState.boards) !== null) {
    throw new Error("There is a meta winner — use claim instead.");
  }
  if (!superMetaFull(currentGameState.boards)) {
    throw new Error("Meta board is not full — not a draw yet.");
  }
  if (
    signerPubKeyHex !== currentGameState.p1PubKeyHex &&
    signerPubKeyHex !== currentGameState.p2PubKeyHex
  ) {
    throw new Error("Only a participant can build the draw split transaction.");
  }

  const height = await fetchCurrentHeight();
  const gameValue = BigInt(currentGameBox.value);
  const fee = RECOMMENDED_MIN_FEE_VALUE;
  const potAfterFee = gameValue - fee;
  if (potAfterFee <= BigInt(0)) {
    throw new Error("Box value too low to pay network fee and split.");
  }
  const half = potAfterFee / BigInt(2);
  const rem = potAfterFee % BigInt(2);
  const toP1 = half + rem;
  const toP2 = half;
  const minPer = SAFE_MIN_BOX_VALUE;
  if (toP1 < minPer || toP2 < minPer) {
    throw new Error("Pot too small to split into two valid outputs after fee.");
  }

  const out1 = new OutputBuilder(toP1, ErgoAddress.fromBase58(p1Address));
  const out2 = new OutputBuilder(toP2, ErgoAddress.fromBase58(p2Address));

  const unsigned = new TransactionBuilder(height)
    .from([currentGameBox])
    .to(out1)
    .to(out2)
    .payFee(fee)
    .sendChangeTo(p1Address)
    .build()
    .toEIP12Object();

  return { unsignedEip12: unsigned, inputBoxes: [currentGameBox] };
};

export const getSuperPlayerAddresses = (state: SuperChainGameState) => ({
  p1: pubkeyToMainnetAddress(state.p1PubKeyHex),
  p2:
    state.p1PubKeyHex === state.p2PubKeyHex
      ? null
      : pubkeyToMainnetAddress(state.p2PubKeyHex),
});