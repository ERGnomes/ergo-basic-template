/**
 * Persistence layer for the encrypted Ergo vault.
 *
 * We mirror the vault blob in two places:
 *
 *  1. localStorage (fast path; always available; lost if the user
 *     clears site data).
 *  2. Dynamic user metadata (cross-device recovery; survives
 *     localStorage purges; requires the user to be logged in via
 *     Dynamic).
 *
 * The blob itself is just `{ iv, ciphertext }` from AES-GCM and the
 * passkey handle / passkey-encrypted recovery wrapper. None of this is
 * sensitive on its own — without either the passkey OR the recovery
 * code, the ciphertext is unreadable.
 */

import { PasskeyHandle } from "./passkey";

export const VAULT_VERSION = 1;

export interface VaultRecord {
  v: number;
  ergoAddress: string;
  passkey: PasskeyHandle | null;
  passkeyEncrypted: { iv: string; ciphertext: string } | null;
  recoveryEncrypted: { iv: string; ciphertext: string; salt: string };
  createdAt: number;
}

const LS_KEY = "ergo-dynamic-vault-v1";

export const loadVaultFromLocalStorage = (): VaultRecord | null => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== VAULT_VERSION) return null;
    return parsed as VaultRecord;
  } catch {
    return null;
  }
};

export const saveVaultToLocalStorage = (record: VaultRecord): void => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(record));
  } catch {
    // Quota errors etc. — non-fatal; Dynamic mirror is the canonical copy.
  }
};

export const clearVaultLocally = (): void => {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    // ignore
  }
};

const DYNAMIC_METADATA_KEY = "ergoVaultV1";

/**
 * Read a vault record out of a Dynamic user object's `metadata`. Safe
 * to call before login — returns null if no user / no vault.
 */
export const loadVaultFromDynamicUser = (
  user: { metadata?: any } | null | undefined
): VaultRecord | null => {
  const meta = user?.metadata as Record<string, unknown> | undefined;
  if (!meta) return null;
  const raw = meta[DYNAMIC_METADATA_KEY];
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as VaultRecord;
  if (candidate.v !== VAULT_VERSION) return null;
  return candidate;
};

/**
 * Build the metadata patch you can hand to Dynamic's `updateUser`
 * call. We deliberately spread the existing metadata so we don't clobber
 * other apps that may store fields on the same user.
 */
export const buildDynamicMetadataPatch = (
  existingMetadata: Record<string, unknown> | undefined,
  vault: VaultRecord
): Record<string, unknown> => ({
  ...(existingMetadata || {}),
  [DYNAMIC_METADATA_KEY]: vault,
});

export const buildDynamicMetadataClearPatch = (
  existingMetadata: Record<string, unknown> | undefined
): Record<string, unknown> => {
  const next = { ...(existingMetadata || {}) };
  delete next[DYNAMIC_METADATA_KEY];
  return next;
};
