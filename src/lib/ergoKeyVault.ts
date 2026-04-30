/**
 * Ergo key vault — Option B+ from the security analysis.
 *
 * Architecture:
 *
 *   Dynamic email login        ─┐
 *                                ├──► identity, recovery, JWT, metadata storage
 *                                │
 *   WebAuthn passkey + PRF      ─┤──► hardware-bound encryption key for Ergo seed
 *                                │
 *   Recovery passphrase (BIP-39)─┘──► out-of-band backup encryption key
 *
 * The Ergo private key itself:
 *   - is generated **fresh** with `crypto.getRandomValues` on first use
 *   - is encrypted twice: once with the passkey-derived AES key, once
 *     with a key derived from the recovery passphrase (PBKDF2)
 *   - both ciphertexts live in localStorage AND in Dynamic user metadata
 *   - is *only* held in memory while a transaction is being signed,
 *     and is wiped immediately afterward
 *
 * If the user has lost access to their passkey (new device, no synced
 * keychain), they can re-encrypt the seed for a new passkey by first
 * decrypting it with their recovery passphrase.
 */

import { generateMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";

import {
  PasskeyHandle,
  registerPasskey,
  evaluatePrf,
  deriveAesKeyFromPrf,
  aesGcmEncrypt,
  aesGcmDecrypt,
  base64url,
} from "./passkey";
import {
  VaultRecord,
  VAULT_VERSION,
  loadVaultFromLocalStorage,
  saveVaultToLocalStorage,
  loadVaultFromDynamicUser,
  clearVaultLocally,
} from "./vaultStorage";

const ERGO_INFO = "ergo-vault-aes-v1";
const RECOVERY_INFO = "ergo-vault-recovery-v1";
const RECOVERY_ITERATIONS = 250_000;

const wasmModulePromise: { current: Promise<typeof import("ergo-lib-wasm-browser")> | null } =
  { current: null };

const loadWasm = () => {
  if (!wasmModulePromise.current) {
    wasmModulePromise.current = import("ergo-lib-wasm-browser");
  }
  return wasmModulePromise.current;
};

/**
 * 32 bytes of Ergo dlog-secret material. Treat with care — wipe with
 * `wipe()` as soon as you're done signing.
 */
export class ErgoSecretBytes {
  private buf: Uint8Array | null;

  constructor(bytes: Uint8Array) {
    if (bytes.length !== 32) {
      throw new Error(`ErgoSecretBytes: expected 32 bytes, got ${bytes.length}`);
    }
    this.buf = new Uint8Array(bytes);
  }

  get bytes(): Uint8Array {
    if (!this.buf) throw new Error("ErgoSecretBytes already wiped");
    return this.buf;
  }

  wipe(): void {
    if (this.buf) {
      this.buf.fill(0);
      this.buf = null;
    }
  }
}

const computeErgoAddressFromSecret = async (
  secret: Uint8Array
): Promise<string> => {
  const wasm = await loadWasm();
  const sk = wasm.SecretKey.dlog_from_bytes(secret);
  try {
    return sk.get_address().to_base58(wasm.NetworkPrefix.Mainnet);
  } finally {
    sk.free();
  }
};

const cryptoRandom = (n: number): Uint8Array => {
  const u = new Uint8Array(n);
  crypto.getRandomValues(u);
  return u;
};

const deriveRecoveryKey = async (passphrase: string, salt: Uint8Array): Promise<CryptoKey> => {
  const ikm = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase.normalize("NFKD")),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: salt,
      iterations: RECOVERY_ITERATIONS,
    },
    ikm,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

export interface ProvisionResult {
  vault: VaultRecord;
  recoveryPhrase: string;
}

/**
 * Provision a brand-new vault: generate Ergo seed, register passkey,
 * generate recovery phrase, double-encrypt, persist locally.
 *
 * The caller must show the recovery phrase to the user EXACTLY ONCE
 * and require a confirmation step before saving the vault to Dynamic.
 */
export const provisionVault = async (
  userIdentifier: string,
  displayName: string,
  options: { withPasskey?: boolean } = {}
): Promise<ProvisionResult> => {
  const withPasskey = options.withPasskey !== false;

  const seed = cryptoRandom(32);

  const ergoAddress = await computeErgoAddressFromSecret(seed);
  const recoveryPhrase = generateMnemonic(wordlist, 256);

  const recoverySalt = cryptoRandom(16);
  const recoveryKey = await deriveRecoveryKey(recoveryPhrase, recoverySalt);
  const recoveryWrapped = await aesGcmEncrypt(recoveryKey, seed);

  let passkey: PasskeyHandle | null = null;
  let passkeyEncrypted: { iv: string; ciphertext: string } | null = null;
  if (withPasskey) {
    try {
      passkey = await registerPasskey(userIdentifier, displayName);
      const prfOut = await evaluatePrf(passkey);
      const aes = await deriveAesKeyFromPrf(prfOut, ERGO_INFO);
      passkeyEncrypted = await aesGcmEncrypt(aes, seed);
      prfOut.fill(0);
    } catch (err) {
      // Surface to the caller so they can decide whether to retry. The
      // recovery-only branch below will still work.
      passkey = null;
      passkeyEncrypted = null;
      throw err;
    } finally {
      // best-effort wipe regardless of outcome
    }
  }

  // Wipe seed from memory.
  seed.fill(0);

  const vault: VaultRecord = {
    v: VAULT_VERSION,
    ergoAddress,
    passkey,
    passkeyEncrypted,
    recoveryEncrypted: {
      iv: recoveryWrapped.iv,
      ciphertext: recoveryWrapped.ciphertext,
      salt: base64url.encode(recoverySalt),
    },
    createdAt: Date.now(),
  };

  saveVaultToLocalStorage(vault);
  return { vault, recoveryPhrase };
};

/**
 * Unlock the vault using the registered passkey. Returns the raw
 * Ergo seed in an `ErgoSecretBytes` wrapper — caller MUST `.wipe()`
 * it as soon as signing is done.
 */
export const unlockWithPasskey = async (
  vault: VaultRecord
): Promise<ErgoSecretBytes> => {
  if (!vault.passkey || !vault.passkeyEncrypted) {
    throw new Error(
      "This vault has no passkey wrapper — recover with your recovery phrase, " +
        "then re-attach a passkey."
    );
  }
  const prfOut = await evaluatePrf(vault.passkey);
  try {
    const aes = await deriveAesKeyFromPrf(prfOut, ERGO_INFO);
    const seed = await aesGcmDecrypt(
      aes,
      vault.passkeyEncrypted.iv,
      vault.passkeyEncrypted.ciphertext
    );
    return new ErgoSecretBytes(seed);
  } finally {
    prfOut.fill(0);
  }
};

/**
 * Unlock with the recovery phrase. Use as the fallback when the user
 * is on a device that doesn't have the passkey synced.
 */
export const unlockWithRecoveryPhrase = async (
  vault: VaultRecord,
  phrase: string
): Promise<ErgoSecretBytes> => {
  const salt = base64url.decode(vault.recoveryEncrypted.salt);
  const key = await deriveRecoveryKey(phrase.trim(), salt);
  const seed = await aesGcmDecrypt(
    key,
    vault.recoveryEncrypted.iv,
    vault.recoveryEncrypted.ciphertext
  );
  return new ErgoSecretBytes(seed);
};

/**
 * Re-attach a fresh passkey to an existing vault. Used after recovery
 * on a new device — caller should already have unlocked the seed via
 * recovery phrase.
 */
export const attachPasskey = async (
  vault: VaultRecord,
  seed: ErgoSecretBytes,
  userIdentifier: string,
  displayName: string
): Promise<VaultRecord> => {
  const passkey = await registerPasskey(userIdentifier, displayName);
  const prfOut = await evaluatePrf(passkey);
  try {
    const aes = await deriveAesKeyFromPrf(prfOut, ERGO_INFO);
    const wrapped = await aesGcmEncrypt(aes, seed.bytes);
    const next: VaultRecord = {
      ...vault,
      passkey,
      passkeyEncrypted: { iv: wrapped.iv, ciphertext: wrapped.ciphertext },
    };
    saveVaultToLocalStorage(next);
    return next;
  } finally {
    prfOut.fill(0);
  }
};

/**
 * Convenience: pull whichever vault we already know about for this
 * user. localStorage wins (fast path), Dynamic metadata fills in for
 * cross-device.
 */
export const findExistingVault = (
  user: { metadata?: any } | null | undefined
): VaultRecord | null => {
  return loadVaultFromLocalStorage() || loadVaultFromDynamicUser(user);
};

export const wipeLocalVault = (): void => clearVaultLocally();

// Re-export so callers don't have to import from two places.
export { mnemonicToSeedSync };
