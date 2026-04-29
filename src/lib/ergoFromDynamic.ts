/**
 * Ergo-from-Dynamic helpers.
 *
 * Dynamic.xyz does not natively support Ergo (it is a Tier 3 chain).
 * Per Dynamic's Tier 3 docs (/overview/wallets-and-chains/tier-3-chains)
 * Ergo uses secp256k1, the same curve as Ethereum. We therefore use
 * Dynamic's EVM embedded wallet as the signing root and derive the Ergo
 * identity from it as follows:
 *
 *  1. Ask the embedded wallet to sign a deterministic, well-known message
 *     ("Derive Ergo address v1") via `primaryWallet.signMessage(...)`.
 *  2. Recover the uncompressed secp256k1 public key from that signature
 *     using viem's `recoverPublicKey` (eth_personal_sign / EIP-191 hashing).
 *  3. Compress the 65-byte uncompressed key down to 33 bytes (standard
 *     SEC1 compressed format: 0x02/0x03 prefix + X coordinate).
 *  4. Hand the 33-byte compressed pubkey to ergo-lib-wasm's
 *     `Address.from_public_key(...)` which produces a P2PK Ergo address.
 *
 * The resulting Ergo address is deterministic for a given Dynamic embedded
 * wallet: signing the same message always produces the same compressed
 * public key, which always maps to the same Ergo P2PK address.
 *
 * ---
 *
 * Caveat about transaction signing:
 *
 * Ergo's P2PK proofs are Schnorr-style sigma protocol proofs, NOT raw
 * secp256k1 ECDSA signatures over the tx digest. A faithful Tier 3
 * implementation therefore cannot simply "ask the EVM wallet to ECDSA-sign
 * the sighash and slot the bytes in as the proof" — building a real Ergo
 * proof requires interactive Schnorr commitments, which the Dynamic EVM
 * wallet does not expose.
 *
 * The `signErgoTx` helper below follows the structure described in the
 * task spec (compute digest -> signRawMessage -> attach as proof) so the
 * code path is wired end-to-end, but it should be treated as a stub: the
 * resulting transaction will not validate on Ergo mainnet until either
 *
 *   (a) a proper Schnorr-capable signer is available (e.g. a server-side
 *       signer that holds the same secret derived from Dynamic, or a
 *       Dynamic Custom Wallet Connector that knows the Ergo proof format),
 *       or
 *   (b) the user signs the prepared unsigned tx with Nautilus instead
 *       (see `components/NautilusButton.tsx`).
 *
 * The address-derivation path (`deriveErgoAddress`) is fully functional —
 * users can receive ERG and tokens at the derived address right away.
 */

import { recoverPublicKey, hexToBytes, bytesToHex } from "viem";

const DERIVATION_MESSAGE = "Derive Ergo address v1";

let wasmModulePromise: Promise<typeof import("ergo-lib-wasm-browser")> | null =
  null;

const loadWasm = () => {
  if (!wasmModulePromise) {
    wasmModulePromise = import("ergo-lib-wasm-browser");
  }
  return wasmModulePromise;
};

/**
 * Compress an uncompressed secp256k1 public key (65 bytes, leading 0x04)
 * to its 33-byte SEC1 compressed form.
 */
const compressPublicKey = (uncompressed: Uint8Array): Uint8Array => {
  if (uncompressed.length !== 65 || uncompressed[0] !== 0x04) {
    throw new Error(
      `Expected uncompressed secp256k1 pubkey (65 bytes, 0x04 prefix), got ${uncompressed.length} bytes prefix=0x${uncompressed[0]?.toString(16)}`
    );
  }
  const x = uncompressed.slice(1, 33);
  const y = uncompressed.slice(33, 65);
  const yIsEven = (y[y.length - 1] & 0x01) === 0;
  const compressed = new Uint8Array(33);
  compressed[0] = yIsEven ? 0x02 : 0x03;
  compressed.set(x, 1);
  return compressed;
};

const ensureHex = (value: string): `0x${string}` => {
  if (!value.startsWith("0x")) {
    return `0x${value}` as `0x${string}`;
  }
  return value as `0x${string}`;
};

/**
 * Minimal shape of the Dynamic primary wallet object we depend on.
 * We avoid importing Dynamic types directly so this file can be unit-tested
 * without pulling the Dynamic SDK into the test runtime.
 */
export interface DynamicPrimaryWalletLike {
  address?: string;
  signMessage: (message: string) => Promise<string | undefined>;
  signRawMessage?: (digestHex: string) => Promise<string | undefined>;
}

export interface DerivedErgoIdentity {
  ergoAddress: string;
  compressedPublicKeyHex: string;
  uncompressedPublicKeyHex: string;
  signature: string;
  message: string;
}

/**
 * Derive a deterministic Ergo P2PK mainnet address from a Dynamic embedded
 * EVM wallet by signing a known message and recovering the secp256k1
 * public key from the signature.
 */
export const deriveErgoAddress = async (
  primaryWallet: DynamicPrimaryWalletLike
): Promise<DerivedErgoIdentity> => {
  if (!primaryWallet || typeof primaryWallet.signMessage !== "function") {
    throw new Error(
      "deriveErgoAddress: primaryWallet is missing or has no signMessage()."
    );
  }

  const signature = await primaryWallet.signMessage(DERIVATION_MESSAGE);
  if (!signature) {
    throw new Error("deriveErgoAddress: signMessage returned no signature.");
  }

  const uncompressedHex = await recoverPublicKey({
    hash: hashEthMessage(DERIVATION_MESSAGE),
    signature: ensureHex(signature),
  });

  const uncompressed = hexToBytes(uncompressedHex);
  const compressed = compressPublicKey(uncompressed);

  const wasm = await loadWasm();
  const address = wasm.Address.from_public_key(compressed);
  const ergoAddress = address.to_base58(wasm.NetworkPrefix.Mainnet);

  return {
    ergoAddress,
    compressedPublicKeyHex: bytesToHex(compressed),
    uncompressedPublicKeyHex: uncompressedHex,
    signature,
    message: DERIVATION_MESSAGE,
  };
};

/**
 * EIP-191 personal_sign hashing: keccak256("\x19Ethereum Signed Message:\n" + len + msg).
 * We import lazily through viem's hashMessage to keep our bundle smaller.
 */
const hashEthMessage = (message: string): `0x${string}` => {
  // Done inline so we don't have to top-level import hashMessage; keeps tree-shaking happy.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { hashMessage } = require("viem") as typeof import("viem");
  return hashMessage(message);
};

export interface SignErgoTxResult {
  signedTxJson: any;
  digestHex: string;
  rawSignatureHex: string;
}

/**
 * Best-effort transaction signing flow described in the task spec.
 *
 * IMPORTANT: see the file-level comment — the resulting transaction will
 * NOT be a valid Ergo P2PK proof. This function is wired end-to-end so
 * the UI flow can be exercised, but the on-chain submission step is
 * expected to fail until a proper Schnorr signer is plugged in.
 *
 * @param primaryWallet  The Dynamic embedded wallet (EVM signer).
 * @param unsignedTxJson The unsigned transaction in EIP-12 / Node JSON form.
 * @param inputs         The input boxes corresponding to unsignedTx.inputs.
 */
export const signErgoTx = async (
  primaryWallet: DynamicPrimaryWalletLike,
  unsignedTxJson: any,
  inputs: any[]
): Promise<SignErgoTxResult> => {
  if (!primaryWallet) {
    throw new Error("signErgoTx: primaryWallet is required.");
  }
  if (typeof primaryWallet.signRawMessage !== "function") {
    throw new Error(
      "signErgoTx: primaryWallet does not expose signRawMessage(). " +
        "Make sure you are using Dynamic's EVM embedded wallet."
    );
  }

  const wasm = await loadWasm();

  const unsignedTx = wasm.UnsignedTransaction.from_json(
    typeof unsignedTxJson === "string"
      ? unsignedTxJson
      : JSON.stringify(unsignedTxJson)
  );

  // Use the unsigned tx id as the 32-byte digest. In Ergo this is
  // blake2b256 of the serialized unsigned-tx bytes and is what gets
  // committed-to by the prover when constructing a P2PK proof.
  const digestHex = unsignedTx.id().to_str();

  const rawSignatureHex = await primaryWallet.signRawMessage(
    ensureHex(digestHex)
  );
  if (!rawSignatureHex) {
    throw new Error("signErgoTx: signRawMessage returned no signature.");
  }

  // Build a "signed" tx by attaching the raw ECDSA signature bytes as the
  // proof for every input. NOTE: this will NOT validate on-chain; see the
  // file-level caveat. We still produce a parsable structure so downstream
  // code (e.g. broadcast UI) can be exercised.
  const proofBytes = hexToBytes(ensureHex(rawSignatureHex));
  const proofs: Uint8Array[] = inputs.map(() => proofBytes);
  const signedTx = wasm.Transaction.from_unsigned_tx(unsignedTx, proofs);
  const signedTxJson = JSON.parse(signedTx.to_json());

  return {
    signedTxJson,
    digestHex,
    rawSignatureHex,
  };
};

export const ERGO_DERIVATION_MESSAGE = DERIVATION_MESSAGE;
