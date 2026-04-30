/**
 * Build → sign → submit pipeline for Ergo transactions, signed locally
 * with `ergo-lib-wasm-browser`'s `Wallet.from_secrets` (real Schnorr
 * proofs that mainnet accepts).
 *
 * The signing path here is deliberately offline-friendly: we only need
 * the latest 10 block headers from the Explorer to construct a valid
 * `ErgoStateContext`. Boxes-to-spend come from Explorer too.
 */

import { ErgoSecretBytes } from "./ergoKeyVault";
import { parseTxIdFromSubmitResponse } from "./ergoSubmitTxId";

const ERGO_API = "https://api.ergoplatform.com/api/v1";
const NODE_BASE = "https://api.ergoplatform.com/api/v1";

interface FleetUnsignedTxJson {
  inputs: Array<any>;
  dataInputs: Array<any>;
  outputs: Array<any>;
}

/**
 * The Explorer v1 `/blocks/headers` payload is *almost* the
 * node-native header JSON that sigma-rust's `BlockHeader::from_json`
 * accepts, but it omits a few fields. We synthesize plausible defaults
 * for the missing ones so the parser doesn't reject the input. None of
 * the synthesized fields participate in verification of P2PK proofs —
 * the sigma protocol uses the message digest, not the header — so this
 * is safe for our signing purposes.
 */
const adaptExplorerHeaderForSigmaRust = (h: any): any => ({
  id: h.id,
  parentId: h.parentId,
  version: h.version,
  height: h.height,
  timestamp: h.timestamp,
  nBits: h.nBits,
  difficulty: h.difficulty || "1",
  votes: h.votes || "000000",
  size: h.size || 0,
  stateRoot: h.stateRoot,
  adProofsRoot: h.adProofsRoot,
  transactionsRoot: h.transactionsRoot,
  extensionHash: h.extensionHash,
  extensionId: h.extensionId || h.extensionHash,
  adProofsId: h.adProofsId || h.adProofsRoot,
  transactionsId: h.transactionsId || h.transactionsRoot,
  powSolutions: h.powSolutions,
  unparsedBytes: h.unparsedBytes || "",
});

const wasmModulePromise: { current: Promise<typeof import("ergo-lib-wasm-browser")> | null } =
  { current: null };

const loadWasm = () => {
  if (!wasmModulePromise.current) {
    wasmModulePromise.current = import("ergo-lib-wasm-browser");
  }
  return wasmModulePromise.current;
};

export interface BuildAndSignResult {
  txId: string;
  submittedTxId?: string;
  submitResponse: string;
  submitOk: boolean;
}

/**
 * Build, sign, and submit a simple "send X ERG to recipient" tx.
 *
 * This is the happy-path utility used by ErgoWallet.tsx. For more
 * sophisticated use cases (multi-output, tokens, custom registers),
 * import the lower-level helpers from `@fleet-sdk/core` directly.
 */
export const sendErg = async (params: {
  fromAddress: string;
  toAddress: string;
  amountNanoErg: bigint;
  secret: ErgoSecretBytes;
}): Promise<BuildAndSignResult> => {
  const { fromAddress, toAddress, amountNanoErg, secret } = params;

  const utxoRes = await fetch(
    `${ERGO_API}/boxes/unspent/byAddress/${encodeURIComponent(fromAddress)}?limit=50`
  );
  if (!utxoRes.ok) {
    throw new Error(`Could not fetch unspent boxes: HTTP ${utxoRes.status}`);
  }
  const utxoJson = await utxoRes.json();
  const inputs = (utxoJson.items || []) as any[];
  if (inputs.length === 0) {
    throw new Error("No unspent boxes at the derived address.");
  }

  const headersRes = await fetch(`${NODE_BASE}/blocks/headers?limit=10`);
  if (!headersRes.ok) {
    throw new Error(`Could not fetch block headers: HTTP ${headersRes.status}`);
  }
  const headersJson = await headersRes.json();
  const explorerHeaders = (headersJson.items || headersJson) as any[];
  if (!Array.isArray(explorerHeaders) || explorerHeaders.length === 0) {
    throw new Error("Block-headers response was empty.");
  }
  const currentHeight: number = explorerHeaders[0].height;
  const headersArr = explorerHeaders.map(adaptExplorerHeaderForSigmaRust);

  const fleet = await import("@fleet-sdk/core");
  const { TransactionBuilder, OutputBuilder, RECOMMENDED_MIN_FEE_VALUE } =
    fleet as any;

  const fee = RECOMMENDED_MIN_FEE_VALUE;

  const builderTx = new TransactionBuilder(currentHeight)
    .from(inputs)
    .to(new OutputBuilder(amountNanoErg, toAddress))
    .sendChangeTo(fromAddress)
    .payFee(fee)
    .build()
    .toEIP12Object();

  const wasm = await loadWasm();
  const unsignedTx = wasm.UnsignedTransaction.from_json(JSON.stringify(builderTx));

  const boxes = wasm.ErgoBoxes.from_boxes_json(inputs);
  const dataBoxes = wasm.ErgoBoxes.empty();

  const headerObjects = headersArr.slice(0, 10).map((h) =>
    wasm.BlockHeader.from_json(JSON.stringify(h))
  );
  const blockHeaders = new wasm.BlockHeaders(headerObjects[0]);
  for (let i = 1; i < headerObjects.length; i++) {
    blockHeaders.add(headerObjects[i]);
  }
  const preHeader = wasm.PreHeader.from_block_header(headerObjects[0]);
  const stateContext = new wasm.ErgoStateContext(
    preHeader,
    blockHeaders,
    wasm.Parameters.default_parameters()
  );

  const sk = wasm.SecretKey.dlog_from_bytes(secret.bytes);
  const sks = new wasm.SecretKeys();
  sks.add(sk);
  const wallet = wasm.Wallet.from_secrets(sks);

  const signed = wallet.sign_transaction(stateContext, unsignedTx, boxes, dataBoxes);
  const txId = signed.id().to_str();
  const signedJson = JSON.parse(signed.to_json());

  const submitRes = await fetch(`${ERGO_API}/mempool/transactions/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(signedJson),
  });
  const submitText = await submitRes.text();
  const resolvedTxId = submitRes.ok
    ? parseTxIdFromSubmitResponse(submitText, txId)
    : undefined;

  return {
    txId: resolvedTxId ?? txId,
    submittedTxId: submitRes.ok ? resolvedTxId ?? txId : undefined,
    submitResponse: submitText,
    submitOk: submitRes.ok,
  };
};
