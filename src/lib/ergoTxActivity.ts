/**
 * Lightweight, client-only "transaction activity" log for passkey vault /
 * Explorer-submitted txs. Nautilus users already see history in the
 * extension; this gives Dynamic-email users a comparable anchor on-chain.
 */

export interface ErgoTxActivityEntry {
  txId: string;
  label: string;
  submittedAt: number;
}

const STORAGE_KEY = "ergo-tx-activity-v1";
const MAX_ENTRIES = 40;

const subscribers = new Set<() => void>();

const readAll = (): ErgoTxActivityEntry[] => {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ErgoTxActivityEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e) =>
        e &&
        typeof e.txId === "string" &&
        e.txId.length === 64 &&
        typeof e.label === "string" &&
        typeof e.submittedAt === "number"
    );
  } catch {
    return [];
  }
};

const writeAll = (entries: ErgoTxActivityEntry[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // quota
  }
  subscribers.forEach((cb) => {
    try {
      cb();
    } catch {
      // ignore
    }
  });
};

export const getErgoTxActivity = (): ErgoTxActivityEntry[] => readAll();

export const recordErgoTxActivity = (entry: ErgoTxActivityEntry): void => {
  const all = readAll().filter((e) => e.txId !== entry.txId);
  const next = [entry, ...all].slice(0, MAX_ENTRIES);
  writeAll(next);
};

export const removeErgoTxActivity = (txId: string): void => {
  writeAll(readAll().filter((e) => e.txId !== txId));
};

export const clearErgoTxActivity = (): void => {
  writeAll([]);
};

export const subscribeErgoTxActivity = (cb: () => void): (() => void) => {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
};
