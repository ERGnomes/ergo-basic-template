/**
 * Unified sign-and-submit for Ergo transactions produced by the game
 * transaction builders.
 *
 * Two paths, discriminated at the call site by what the user is
 * connected with:
 *
 *   1. Nautilus-via-Dynamic (window.ergo):
 *      - serialize to EIP-12 form
 *      - window.ergo.sign_tx(unsigned)  -> signed tx
 *      - window.ergo.submit_tx(signed)  -> txId (OR Explorer submit)
 *
 *   2. Passkey vault:
 *      - unlock secret with passkey
 *      - build ErgoStateContext from latest Explorer headers
 *      - Wallet.from_secrets().sign_transaction(...)
 *      - submit signed tx JSON to Explorer mempool endpoint
 */

import { ErgoSecretBytes } from "../ergoKeyVault";

const ERGO_API = "https://api.ergoplatform.com/api/v1";

const wasmModulePromise: {
  current: Promise<typeof import("ergo-lib-wasm-browser")> | null;
} = { current: null };

const loadWasm = () => {
  if (!wasmModulePromise.current) {
    wasmModulePromise.current = import("ergo-lib-wasm-browser");
  }
  return wasmModulePromise.current;
};

/**
 * The Explorer v1 /blocks/headers response is *almost* the node-native
 * BlockHeader JSON that sigma-rust expects. Fill in the missing
 * fields (none of which affect proof validation) before handing
 * over. Shared with lib/ergoSigning.ts — kept duplicated here so the
 * game module is self-contained and doesn't import into the unrelated
 * Send-ERG path.
 */
const adaptExplorerHeader = (h: any): any => ({
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

export interface SubmitResult {
  ok: boolean;
  txId?: string;
  responseText: string;
}

export interface NautilusSignParams {
  kind: "nautilus";
  /** An EIP-12 unsigned tx object (as produced by Fleet's toEIP12Object()). */
  unsignedEip12: any;
}

export interface VaultSignParams {
  kind: "vault";
  /** An EIP-12 unsigned tx object. */
  unsignedEip12: any;
  /** The boxes being spent (Explorer format accepted by wasm.ErgoBoxes). */
  inputBoxes: any[];
  /** Secret bytes for the vault. Caller is responsible for wiping. */
  secret: ErgoSecretBytes;
}

export const signAndSubmit = async (
  params: NautilusSignParams | VaultSignParams
): Promise<SubmitResult> => {
  if (params.kind === "nautilus") {
    return signAndSubmitNautilus(params.unsignedEip12);
  } else {
    return signAndSubmitVault(
      params.unsignedEip12,
      params.inputBoxes,
      params.secret
    );
  }
};

const signAndSubmitNautilus = async (unsigned: any): Promise<SubmitResult> => {
  const w = window as any;
  if (!w.ergo || typeof w.ergo.sign_tx !== "function") {
    return { ok: false, responseText: "window.ergo.sign_tx is unavailable" };
  }
  const signed = await w.ergo.sign_tx(unsigned);
  // Nautilus also exposes submit_tx; prefer it so the response is a
  // real txId. Fall back to Explorer if the extension rejects it.
  if (typeof w.ergo.submit_tx === "function") {
    try {
      const txId = await w.ergo.submit_tx(signed);
      return { ok: true, txId, responseText: txId };
    } catch (err: any) {
      // fall through
    }
  }
  const res = await fetch(`${ERGO_API}/mempool/transactions/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(signed),
  });
  const text = await res.text();
  return { ok: res.ok, responseText: text, txId: res.ok ? text.trim() : undefined };
};

const signAndSubmitVault = async (
  unsigned: any,
  inputs: any[],
  secret: ErgoSecretBytes
): Promise<SubmitResult> => {
  const wasm = await loadWasm();

  const headersRes = await fetch(`${ERGO_API}/blocks/headers?limit=10`);
  if (!headersRes.ok) {
    return {
      ok: false,
      responseText: `blocks/headers HTTP ${headersRes.status}`,
    };
  }
  const headersJson = await headersRes.json();
  const explorerHeaders = (headersJson.items || headersJson) as any[];
  if (!Array.isArray(explorerHeaders) || explorerHeaders.length === 0) {
    return { ok: false, responseText: "empty headers response" };
  }
  const headersArr = explorerHeaders.map(adaptExplorerHeader);

  const unsignedTx = wasm.UnsignedTransaction.from_json(
    typeof unsigned === "string" ? unsigned : JSON.stringify(unsigned)
  );
  const boxes = wasm.ErgoBoxes.from_boxes_json(inputs);
  const dataBoxes = wasm.ErgoBoxes.empty();

  const headerObjects = headersArr
    .slice(0, 10)
    .map((h) => wasm.BlockHeader.from_json(JSON.stringify(h)));
  const blockHeaders = new wasm.BlockHeaders(headerObjects[0]);
  for (let i = 1; i < headerObjects.length; i++) blockHeaders.add(headerObjects[i]);
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

  const signed = wallet.sign_transaction(
    stateContext,
    unsignedTx,
    boxes,
    dataBoxes
  );
  const signedJson = JSON.parse(signed.to_json());

  const submitRes = await fetch(`${ERGO_API}/mempool/transactions/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(signedJson),
  });
  const text = await submitRes.text();
  return {
    ok: submitRes.ok,
    responseText: text,
    txId: submitRes.ok ? signed.id().to_str() : undefined,
  };
};
