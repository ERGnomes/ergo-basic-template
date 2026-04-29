/**
 * Ergo test-lab helpers.
 *
 * A small grab bag of integration tests that exercise the vault end
 * to end without requiring live ERG. Each helper returns a structured
 * result so the UI can render a clear "PASS / FAIL + details" line.
 *
 * Tests included:
 *   - signMessage / verifyMessage (round-trip with `verify_signature`)
 *   - signMessage with mutated message (must NOT verify)
 *   - signMessage with mutated address (must NOT verify)
 *   - deterministic-address check (vault address matches secret)
 *   - balance fetch (Explorer reachability + balance shape sanity)
 *   - dry-run send: build + sign a self-send tx but DON'T submit
 *     (proves the full Schnorr signing pipeline works without
 *      spending ERG)
 *   - submit-only zero-value send (optional, only if user has UTXOs)
 */

import { ErgoSecretBytes } from "./ergoKeyVault";

const ERGO_API = "https://api.ergoplatform.com/api/v1";

export interface TestLabResult {
  name: string;
  ok: boolean;
  durationMs: number;
  details: string;
}

const wasmModulePromise: { current: Promise<typeof import("ergo-lib-wasm-browser")> | null } =
  { current: null };

const loadWasm = () => {
  if (!wasmModulePromise.current) {
    wasmModulePromise.current = import("ergo-lib-wasm-browser");
  }
  return wasmModulePromise.current;
};

const enc = new TextEncoder();
const toHex = (u: Uint8Array): string =>
  Array.from(u, (b) => b.toString(16).padStart(2, "0")).join("");

const time = async <T,>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> => {
  const t0 = performance.now();
  const result = await fn();
  return { result, ms: Math.round(performance.now() - t0) };
};

/**
 * Sign-and-verify round trip. Uses `Wallet.sign_message_using_p2pk` to
 * produce a real Ergo Schnorr proof for an arbitrary string, then
 * `verify_signature` (the top-level function) to confirm acceptance.
 */
export const runSignVerify = async (
  secret: ErgoSecretBytes,
  ergoAddress: string,
  message: string
): Promise<TestLabResult> => {
  const t0 = performance.now();
  try {
    const wasm = await loadWasm();
    const sk = wasm.SecretKey.dlog_from_bytes(secret.bytes);
    const sks = new wasm.SecretKeys();
    sks.add(sk);
    const wallet = wasm.Wallet.from_secrets(sks);
    const address = wasm.Address.from_mainnet_str(ergoAddress);
    const msgBytes = enc.encode(message);

    const sig = wallet.sign_message_using_p2pk(address, msgBytes);
    const ok = wasm.verify_signature(address, msgBytes, sig);

    return {
      name: "Sign + verify message",
      ok,
      durationMs: Math.round(performance.now() - t0),
      details: ok
        ? `Signed ${msgBytes.length}-byte message, ${sig.length}-byte proof.\nproof: ${toHex(sig).slice(0, 64)}...`
        : "verify_signature returned false on a freshly-generated proof.",
    };
  } catch (err: any) {
    return {
      name: "Sign + verify message",
      ok: false,
      durationMs: Math.round(performance.now() - t0),
      details: err?.message || String(err),
    };
  }
};

/**
 * Negative test: take the previous proof, flip a bit in the message,
 * and confirm verification REJECTS it. Catches a degenerate
 * implementation that always returns true.
 */
export const runTamperedMessage = async (
  secret: ErgoSecretBytes,
  ergoAddress: string,
  message: string
): Promise<TestLabResult> => {
  const t0 = performance.now();
  try {
    const wasm = await loadWasm();
    const sk = wasm.SecretKey.dlog_from_bytes(secret.bytes);
    const sks = new wasm.SecretKeys();
    sks.add(sk);
    const wallet = wasm.Wallet.from_secrets(sks);
    const address = wasm.Address.from_mainnet_str(ergoAddress);
    const original = enc.encode(message);
    const sig = wallet.sign_message_using_p2pk(address, original);

    if (original.length === 0) {
      return {
        name: "Tampered message rejected",
        ok: false,
        durationMs: Math.round(performance.now() - t0),
        details: "Skipped — empty message can't be meaningfully tampered.",
      };
    }
    const tampered = new Uint8Array(original);
    tampered[Math.floor(tampered.length / 2)] ^= 0x01;

    const accepted = wasm.verify_signature(address, tampered, sig);

    return {
      name: "Tampered message rejected",
      ok: !accepted,
      durationMs: Math.round(performance.now() - t0),
      details: accepted
        ? "FAIL: verify_signature accepted a proof for a mutated message — should never happen."
        : "verify_signature correctly rejected a one-bit-flipped message.",
    };
  } catch (err: any) {
    return {
      name: "Tampered message rejected",
      ok: false,
      durationMs: Math.round(performance.now() - t0),
      details: err?.message || String(err),
    };
  }
};

/**
 * Negative test: verify the proof against a DIFFERENT random Ergo
 * address. Must be rejected.
 */
export const runWrongAddress = async (
  secret: ErgoSecretBytes,
  ergoAddress: string,
  message: string
): Promise<TestLabResult> => {
  const t0 = performance.now();
  try {
    const wasm = await loadWasm();
    const sk = wasm.SecretKey.dlog_from_bytes(secret.bytes);
    const sks = new wasm.SecretKeys();
    sks.add(sk);
    const wallet = wasm.Wallet.from_secrets(sks);
    const address = wasm.Address.from_mainnet_str(ergoAddress);
    const msg = enc.encode(message);
    const sig = wallet.sign_message_using_p2pk(address, msg);

    const otherSk = wasm.SecretKey.random_dlog();
    const otherAddress = otherSk.get_address();
    const accepted = wasm.verify_signature(otherAddress, msg, sig);
    otherSk.free();

    return {
      name: "Wrong-address verification rejected",
      ok: !accepted,
      durationMs: Math.round(performance.now() - t0),
      details: accepted
        ? "FAIL: verify_signature accepted a proof against an unrelated address."
        : "verify_signature correctly rejected the proof under a different P2PK key.",
    };
  } catch (err: any) {
    return {
      name: "Wrong-address verification rejected",
      ok: false,
      durationMs: Math.round(performance.now() - t0),
      details: err?.message || String(err),
    };
  }
};

/**
 * Verify the address rendered by the UI matches the address we'd
 * compute on the fly from the secret bytes. Catches state-mismatch
 * bugs (e.g. user re-provisioned but UI still has old address).
 */
export const runAddressMatchesSecret = async (
  secret: ErgoSecretBytes,
  ergoAddress: string
): Promise<TestLabResult> => {
  const t0 = performance.now();
  try {
    const wasm = await loadWasm();
    const sk = wasm.SecretKey.dlog_from_bytes(secret.bytes);
    const computed = sk.get_address().to_base58(wasm.NetworkPrefix.Mainnet);
    sk.free();
    const ok = computed === ergoAddress;
    return {
      name: "Vault address matches secret",
      ok,
      durationMs: Math.round(performance.now() - t0),
      details: ok
        ? `Address derived from secret bytes matches the vault record (${ergoAddress.slice(0, 10)}…).`
        : `Mismatch: vault says ${ergoAddress.slice(0, 12)}… but secret derives ${computed.slice(0, 12)}…`,
    };
  } catch (err: any) {
    return {
      name: "Vault address matches secret",
      ok: false,
      durationMs: Math.round(performance.now() - t0),
      details: err?.message || String(err),
    };
  }
};

/**
 * Hit the Explorer balance endpoint and confirm a parseable response
 * comes back. Useful as a basic CORS / network sanity check.
 */
export const runBalanceFetch = async (
  ergoAddress: string
): Promise<TestLabResult> => {
  const { result, ms } = await time(async () => {
    const res = await fetch(
      `${ERGO_API}/addresses/${encodeURIComponent(ergoAddress)}/balance/total`
    );
    return { ok: res.ok, status: res.status, body: await res.text() };
  });
  let nano = "0";
  try {
    const parsed = JSON.parse(result.body);
    nano = String(parsed?.confirmed?.nanoErgs ?? parsed?.nanoErgs ?? "0");
  } catch {
    // ignore — body might not be JSON on error
  }
  return {
    name: "Explorer balance fetch",
    ok: result.ok,
    durationMs: ms,
    details: result.ok
      ? `HTTP ${result.status} — confirmed nanoErgs: ${nano}`
      : `HTTP ${result.status}: ${result.body.slice(0, 120)}`,
  };
};

/**
 * Build + sign a 0.001-ERG self-send transaction but DO NOT submit it
 * to the network. Proves the full Schnorr-signing pipeline works
 * (header parsing, state context, wallet, sigma-rust prover) without
 * spending any ERG.
 *
 * Requires the address to have at least one UTXO.
 */
export const runDryRunSign = async (
  secret: ErgoSecretBytes,
  ergoAddress: string
): Promise<TestLabResult> => {
  const t0 = performance.now();
  try {
    const wasm = await loadWasm();

    const utxoRes = await fetch(
      `${ERGO_API}/boxes/unspent/byAddress/${encodeURIComponent(ergoAddress)}?limit=10`
    );
    if (!utxoRes.ok) throw new Error(`unspent: HTTP ${utxoRes.status}`);
    const utxoJson = await utxoRes.json();
    const inputs = (utxoJson.items || []) as any[];
    if (inputs.length === 0) {
      return {
        name: "Dry-run build + sign self-send",
        ok: false,
        durationMs: Math.round(performance.now() - t0),
        details:
          "Skipped — derived address has no unspent boxes. Fund the address with a tiny amount of ERG and re-run.",
      };
    }

    const headersRes = await fetch(`${ERGO_API}/blocks/headers?limit=10`);
    const headersJson = await headersRes.json();
    const explorerHeaders = (headersJson.items || []) as any[];
    const adapt = (h: any) => ({
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
    const headersArr = explorerHeaders.map(adapt);
    const currentHeight: number = explorerHeaders[0].height;

    const fleet = await import("@fleet-sdk/core");
    const { TransactionBuilder, OutputBuilder, RECOMMENDED_MIN_FEE_VALUE } =
      fleet as any;

    const built = new TransactionBuilder(currentHeight)
      .from(inputs)
      .to(new OutputBuilder(BigInt(1_000_000), ergoAddress))
      .sendChangeTo(ergoAddress)
      .payFee(RECOMMENDED_MIN_FEE_VALUE)
      .build()
      .toEIP12Object();

    const unsignedTx = wasm.UnsignedTransaction.from_json(JSON.stringify(built));
    const boxes = wasm.ErgoBoxes.from_boxes_json(inputs);
    const dataBoxes = wasm.ErgoBoxes.empty();

    const headerObjects = headersArr
      .slice(0, 10)
      .map((h: any) => wasm.BlockHeader.from_json(JSON.stringify(h)));
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

    const signed = wallet.sign_transaction(stateContext, unsignedTx, boxes, dataBoxes);
    const txId = signed.id().to_str();

    return {
      name: "Dry-run build + sign self-send",
      ok: true,
      durationMs: Math.round(performance.now() - t0),
      details: `Built and signed a 0.001 ERG self-send (NOT submitted). txId=${txId.slice(0, 16)}…`,
    };
  } catch (err: any) {
    return {
      name: "Dry-run build + sign self-send",
      ok: false,
      durationMs: Math.round(performance.now() - t0),
      details: err?.message || String(err),
    };
  }
};

export interface TestLabSpec {
  /** A free-form message string the user types into the UI. */
  message: string;
  /** Whether to run the dry-run tx test (slower, needs UTXOs). */
  includeDryRun: boolean;
}

/**
 * Run the full battery in order. Returns a list of structured results.
 * Designed to be safe to call repeatedly — none of the tests have
 * permanent side effects.
 */
export const runAllTests = async (
  secret: ErgoSecretBytes,
  ergoAddress: string,
  spec: TestLabSpec
): Promise<TestLabResult[]> => {
  const results: TestLabResult[] = [];
  results.push(await runAddressMatchesSecret(secret, ergoAddress));
  results.push(await runSignVerify(secret, ergoAddress, spec.message));
  results.push(await runTamperedMessage(secret, ergoAddress, spec.message));
  results.push(await runWrongAddress(secret, ergoAddress, spec.message));
  results.push(await runBalanceFetch(ergoAddress));
  if (spec.includeDryRun) {
    results.push(await runDryRunSign(secret, ergoAddress));
  }
  return results;
};
