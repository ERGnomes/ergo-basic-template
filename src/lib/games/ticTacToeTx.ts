/**
 * Transaction builders for the tic-tac-toe contract.
 *
 * Each builder returns an EIP-12 unsigned transaction object ready to
 * be handed to `signAndSubmit(...)`. The builder is pure — it doesn't
 * talk to the network beyond fetching the UTXOs it needs to fund the
 * transaction.
 *
 * The four entry points map 1:1 to the contract branches:
 *
 *   buildCreateGameTx   — no game box yet; creator funds a new one
 *   buildJoinGameTx     — joiner consumes an open game + adds wager
 *   buildMoveTx         — current mover consumes the current game box
 *                          and creates a new one with one more cell
 *                          filled
 *   buildCancelGameTx   — creator cancels an open game and recovers
 *                          their wager
 *   buildClaimWinTx     — winner drains the box after a 3-in-a-row
 */

import {
  ErgoAddress,
  Network,
  OutputBuilder,
  RECOMMENDED_MIN_FEE_VALUE,
  SAFE_MIN_BOX_VALUE,
  TransactionBuilder,
} from "@fleet-sdk/core";
import {
  applyMove,
  Board,
  EMPTY_BOARD,
  isXTurn,
  winnerOf,
  CELL_X,
  CELL_EMPTY,
} from "./ticTacToeLogic";
import {
  encodeAllRegisters,
  GameState,
  getGameP2SAddress,
  pubkeyToMainnetAddress,
} from "./ticTacToeContract";

const ERGO_API = "https://api.ergoplatform.com/api/v1";

/**
 * Explorer v1 returns registers as
 *   { R4: { serializedValue, sigmaType, renderedValue }, ... }
 * but Fleet's TransactionBuilder.from() and sigma-rust's
 * ErgoBoxes.from_boxes_json() both expect flat hex strings:
 *   { R4: "0e09...", ... }
 * Without this flattening, Fleet throws
 * `Expected an object of type 'string', got 'object'`
 * on any box that has registers (our game box does — P2PK boxes don't,
 * which is why the Send-ERG path doesn't hit it).
 */
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

/**
 * Build the transaction that creates a brand-new open game. The box
 * is funded with `wagerNanoErg + SAFE_MIN_BOX_VALUE` from the creator's
 * address; change goes back to them.
 *
 * R6 is set equal to R5 (creator's pubkey) to encode the "open" state.
 */
export const buildCreateGameTx = async (params: {
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
  const contractAddress = getGameP2SAddress();

  const gameBoxValue = wagerNanoErg + SAFE_MIN_BOX_VALUE;

  const gameState: GameState = {
    board: EMPTY_BOARD,
    p1PubKeyHex: creatorPubKeyHex,
    p2PubKeyHex: creatorPubKeyHex,
    wagerNanoErg,
  };
  const regs = encodeAllRegisters(gameState);

  const out = new OutputBuilder(
    gameBoxValue,
    ErgoAddress.fromBase58(contractAddress)
  ).setAdditionalRegisters({
    R4: regs.R4 as any,
    R5: regs.R5 as any,
    R6: regs.R6 as any,
    R7: regs.R7 as any,
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

/**
 * Build the transaction that joins an existing open game.
 *
 * The joiner spends (a) the game box and (b) enough of their own
 * UTXOs to top the box up by `wager`. The output game box re-uses
 * the contract, preserves R4/R5/R7, and replaces R6 with the joiner's
 * pubkey.
 */
export const buildJoinGameTx = async (params: {
  currentGameBox: any; // Explorer box shape
  currentGameState: GameState;
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

  const newState: GameState = {
    ...currentGameState,
    p2PubKeyHex: joinerPubKeyHex,
  };
  const regs = encodeAllRegisters(newState);

  const newValue =
    BigInt(currentGameBox.value) + currentGameState.wagerNanoErg;

  const out = new OutputBuilder(
    newValue,
    ErgoAddress.fromBase58(getGameP2SAddress())
  ).setAdditionalRegisters({
    R4: regs.R4 as any,
    R5: regs.R5 as any,
    R6: regs.R6 as any,
    R7: regs.R7 as any,
  });

  // The game box MUST be input 0 for the contract's OUTPUTS(0) check to
  // line up with input 0. Fleet's TransactionBuilder preserves the
  // order it receives inputs in.
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

/**
 * Build a move transaction: spend the current game box, produce a new
 * one with a single additional cell filled.
 */
export const buildMoveTx = async (params: {
  currentGameBox: any;
  currentGameState: GameState;
  moverAddress: string;
  moverPubKeyHex: string;
  cell: number; // 0..8
}) => {
  const { currentGameState, moverAddress, moverPubKeyHex, cell } = params;
  const currentGameBox = normalizeExplorerBox(params.currentGameBox);

  if (currentGameState.p1PubKeyHex === currentGameState.p2PubKeyHex) {
    throw new Error("Game hasn't been joined yet.");
  }
  if (winnerOf(currentGameState.board) !== null) {
    throw new Error("Game is already won.");
  }

  const myTurnAsP1 = isXTurn(currentGameState.board);
  const expectedPubKey = myTurnAsP1
    ? currentGameState.p1PubKeyHex
    : currentGameState.p2PubKeyHex;
  if (expectedPubKey !== moverPubKeyHex) {
    throw new Error("It's not your turn.");
  }

  if (currentGameState.board[cell] !== CELL_EMPTY) {
    throw new Error("That cell is already taken.");
  }

  const nextBoard = applyMove(currentGameState.board, cell);
  const nextState: GameState = { ...currentGameState, board: nextBoard };
  const regs = encodeAllRegisters(nextState);

  // We may need extra funding to pay the fee; fetch the mover's other
  // UTXOs to chip in.
  const funding = normalizeExplorerBoxes(await fetchUnspentBoxes(moverAddress));
  const height = await fetchCurrentHeight();

  const out = new OutputBuilder(
    BigInt(currentGameBox.value),
    ErgoAddress.fromBase58(getGameP2SAddress())
  ).setAdditionalRegisters({
    R4: regs.R4 as any,
    R5: regs.R5 as any,
    R6: regs.R6 as any,
    R7: regs.R7 as any,
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

/**
 * Build the transaction that cancels an open game and recovers the
 * creator's wager. Only valid while p1 == p2 (open state).
 */
export const buildCancelGameTx = async (params: {
  currentGameBox: any;
  currentGameState: GameState;
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

/**
 * Winner-takes-all claim after a 3-in-a-row. Only the winner's
 * pubkey can satisfy the contract, so this is safe to call for
 * either player as long as the board shows a win.
 */
export const buildClaimWinTx = async (params: {
  currentGameBox: any;
  currentGameState: GameState;
  winnerAddress: string;
  winnerPubKeyHex: string;
}) => {
  const { currentGameState, winnerAddress, winnerPubKeyHex } = params;
  const currentGameBox = normalizeExplorerBox(params.currentGameBox);
  const winner = winnerOf(currentGameState.board);
  if (winner === null) {
    throw new Error("No winner yet.");
  }
  const expectedWinnerPk =
    winner === CELL_X
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
 * Helper: given a GameState, convert `p1PubKeyHex` / `p2PubKeyHex`
 * into base58 mainnet addresses — useful for the UI to show the
 * players.
 */
export const getPlayerAddresses = (state: GameState) => ({
  p1: pubkeyToMainnetAddress(state.p1PubKeyHex),
  p2: state.p1PubKeyHex === state.p2PubKeyHex
    ? null
    : pubkeyToMainnetAddress(state.p2PubKeyHex),
});
