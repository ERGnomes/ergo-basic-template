/**
 * WebAuthn / passkey helpers for the Ergo key vault.
 *
 * We use WebAuthn's `prf` extension to derive a deterministic 32-byte
 * secret from a hardware-backed passkey. That secret never leaves the
 * authenticator (Secure Enclave / TPM / Android Strongbox); the browser
 * only ever sees the PRF output, which we then use as input keying
 * material for HKDF -> AES-GCM-256 to encrypt the Ergo private key.
 *
 * Why PRF and not just signature-as-key?
 *   - PRF is purpose-built for this exact use case (derive a stable
 *     secret bound to a credential + an app-chosen salt).
 *   - The output is the same for the same (credential, salt) pair, so
 *     we get deterministic decryption without the authenticator ever
 *     producing a phishable bearer token.
 *
 * Browser support (April 2026):
 *   - Chrome / Edge:       full PRF support.
 *   - Safari 18+:          full PRF support (macOS Sonoma+, iOS 18+).
 *   - Firefox:             PRF behind a flag in stable; full support
 *                          coming. We surface this with `isPrfSupported`.
 *
 * If PRF is not available we fall back to a recovery-code-only flow
 * (handled in `ergoKeyVault.ts`).
 */

const RP_NAME = "Ergo Wallet (Dynamic Tier 3)";
const PRF_SALT_LABEL = "ergo-vault-prf-v1";

const textEncoder = new TextEncoder();

const toBuffer = (u: Uint8Array): ArrayBuffer => {
  const out = new ArrayBuffer(u.byteLength);
  new Uint8Array(out).set(u);
  return out;
};

const fromBuffer = (b: ArrayBuffer | Uint8Array): Uint8Array =>
  b instanceof Uint8Array ? b : new Uint8Array(b);

const b64u = {
  encode(bytes: Uint8Array): string {
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },
  decode(str: string): Uint8Array {
    const pad = "=".repeat((4 - (str.length % 4)) % 4);
    const b64 = (str + pad).replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
};

export interface PasskeyHandle {
  credentialId: string;
  prfSalt: string;
}

/**
 * Quick capability probe — does this browser appear to support
 * WebAuthn at all? (We can't probe PRF without an actual ceremony,
 * so the vault's own state tracks whether PRF worked.)
 */
export const isPlatformAuthenticatorAvailable = async (): Promise<boolean> => {
  if (typeof window === "undefined") return false;
  if (!window.PublicKeyCredential) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
};

const cryptoRandom = (n: number): Uint8Array => {
  const u = new Uint8Array(n);
  crypto.getRandomValues(u);
  return u;
};

/**
 * Register a new passkey for the current user, requesting the PRF
 * extension. Returns a `PasskeyHandle` you should persist alongside
 * the encrypted Ergo blob (in localStorage AND in Dynamic user
 * metadata for cross-device recovery).
 *
 * The PRF salt is fresh and per-user; storing it is fine (it's an HKDF
 * salt, not a secret), but rotating it would invalidate the encrypted
 * blob, so do not regenerate it on every call.
 */
export const registerPasskey = async (
  userIdentifier: string,
  displayName: string
): Promise<PasskeyHandle> => {
  if (!window.PublicKeyCredential) {
    throw new Error("WebAuthn is not available in this browser.");
  }

  const challenge = cryptoRandom(32);
  const userId = textEncoder.encode(userIdentifier);
  const prfSalt = cryptoRandom(32);

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: toBuffer(challenge),
      rp: { name: RP_NAME, id: window.location.hostname },
      user: {
        id: toBuffer(userId),
        name: userIdentifier,
        displayName: displayName || userIdentifier,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },   // ES256
        { type: "public-key", alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
        authenticatorAttachment: "platform",
      },
      timeout: 60_000,
      attestation: "none",
      extensions: {
        prf: {
          eval: { first: toBuffer(textEncoder.encode(PRF_SALT_LABEL)) },
        },
      } as unknown as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;

  if (!credential) throw new Error("Passkey registration was cancelled.");

  return {
    credentialId: b64u.encode(fromBuffer(credential.rawId)),
    prfSalt: b64u.encode(prfSalt),
  };
};

/**
 * Trigger a WebAuthn assertion against the saved passkey and ask for
 * a PRF evaluation under our salt. Returns 32 bytes of high-entropy
 * key material.
 */
export const evaluatePrf = async (
  handle: PasskeyHandle
): Promise<Uint8Array> => {
  if (!window.PublicKeyCredential) {
    throw new Error("WebAuthn is not available in this browser.");
  }

  const credentialId = b64u.decode(handle.credentialId);
  const prfSalt = b64u.decode(handle.prfSalt);
  const challenge = cryptoRandom(32);

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: toBuffer(challenge),
      timeout: 60_000,
      userVerification: "required",
      rpId: window.location.hostname,
      allowCredentials: [
        {
          id: toBuffer(credentialId),
          type: "public-key",
          transports: ["internal", "hybrid"],
        },
      ],
      extensions: {
        prf: {
          eval: { first: toBuffer(prfSalt) },
        },
      } as unknown as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;

  if (!assertion) throw new Error("Passkey assertion was cancelled.");

  const results = (assertion.getClientExtensionResults() as any)?.prf?.results;
  const first = results?.first as ArrayBuffer | undefined;

  if (!first) {
    throw new Error(
      "This browser/authenticator does not support the WebAuthn PRF extension. " +
        "Please use Chrome, Edge, or Safari 18+ — or recover with your recovery code."
    );
  }

  return fromBuffer(first);
};

/**
 * HKDF-SHA-256 over the PRF output to produce an AES-GCM key.
 *
 * The salt argument is application-fixed (so callers can't accidentally
 * mix encryption keys across components); the PRF salt itself is
 * already high-entropy.
 */
export const deriveAesKeyFromPrf = async (
  prfOutput: Uint8Array,
  info: string
): Promise<CryptoKey> => {
  const ikm = await crypto.subtle.importKey(
    "raw",
    toBuffer(prfOutput),
    "HKDF",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: toBuffer(textEncoder.encode("ergo-vault-hkdf-v1")),
      info: toBuffer(textEncoder.encode(info)),
    },
    ikm,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

export const aesGcmEncrypt = async (
  key: CryptoKey,
  plaintext: Uint8Array
): Promise<{ iv: string; ciphertext: string }> => {
  const iv = cryptoRandom(12);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toBuffer(iv) },
    key,
    toBuffer(plaintext)
  );
  return { iv: b64u.encode(iv), ciphertext: b64u.encode(fromBuffer(ct)) };
};

export const aesGcmDecrypt = async (
  key: CryptoKey,
  ivB64u: string,
  ciphertextB64u: string
): Promise<Uint8Array> => {
  const iv = b64u.decode(ivB64u);
  const ct = b64u.decode(ciphertextB64u);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toBuffer(iv) },
    key,
    toBuffer(ct)
  );
  return fromBuffer(pt);
};

export const base64url = b64u;
