/**
 * Pending tx tracker for on-chain Ultimate (Super) tic-tac-toe.
 * Same reconciliation idea as `pendingTx.ts` but separate storage key.
 */

import type { SuperBoard } from "./superTicTacToeLogic";

export type PendingSuperKind = "create" | "join" | "move" | "cancel" | "claim";

export interface PendingSuperTx {
  id: string;
  kind: PendingSuperKind;
  spentBoxId: string | null;
  predicted: {
    boards: SuperBoard;
    constraintSub: number | null;
    p1PubKeyHex: string;
    p2PubKeyHex: string;
    wagerNanoErg: string;
  } | null;
  predictedPhase: "open" | "ongoing" | "won" | "drawn" | "spent";
  follow: {
    p1PubKeyHex: string;
    p2PubKeyHex: string;
    wagerNanoErg: string;
  } | null;
  submittedAt: number;
  description: string;
}

const STORAGE_KEY = "ergo-super-game-pending-v1";
const MAX_AGE_MS = 30 * 60 * 1000;
export const SUPER_STUCK_AFTER_MS = 6 * 60 * 1000;

const subscribers = new Set<() => void>();

const readAll = (): PendingSuperTx[] => {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingSuperTx[];
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed.filter((p) => now - p.submittedAt < MAX_AGE_MS);
  } catch {
    return [];
  }
};

const writeAll = (txs: PendingSuperTx[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(txs));
  } catch {
    // ignore
  }
  subscribers.forEach((cb) => {
    try {
      cb();
    } catch {
      // ignore
    }
  });
};

export const getPendingSuperTxs = (): PendingSuperTx[] => readAll();

export const addPendingSuperTx = (tx: PendingSuperTx): void => {
  const all = readAll();
  const next = [...all.filter((p) => p.id !== tx.id), tx];
  writeAll(next);
};

export const removePendingSuperTx = (id: string): void => {
  const next = readAll().filter((p) => p.id !== id);
  writeAll(next);
};

export interface SuperChainSnapshot {
  unspentBoxIds: Set<string>;
  unspentTriples: Set<string>;
}

const SETTLE_GRACE_MS = 10_000;

export const reconcilePendingSuper = (snap: SuperChainSnapshot): void => {
  const all = readAll();
  const now = Date.now();
  const surviving: PendingSuperTx[] = [];
  for (const p of all) {
    const tooNew = now - p.submittedAt < SETTLE_GRACE_MS;
    if (tooNew) {
      surviving.push(p);
      continue;
    }

    const spentDisappeared =
      p.spentBoxId !== null && !snap.unspentBoxIds.has(p.spentBoxId);

    const followKey = p.follow
      ? `${p.follow.p1PubKeyHex}|${p.follow.p2PubKeyHex}|${p.follow.wagerNanoErg}`
      : null;
    const followBoxIsThere = followKey
      ? snap.unspentTriples.has(followKey)
      : false;

    if (p.kind === "cancel" || p.kind === "claim") {
      if (spentDisappeared) continue;
      surviving.push(p);
    } else if (p.kind === "create") {
      if (followBoxIsThere) continue;
      surviving.push(p);
    } else {
      if (followBoxIsThere && spentDisappeared) continue;
      surviving.push(p);
    }
  }
  if (surviving.length !== all.length) writeAll(surviving);
};

export const subscribePendingSuper = (cb: () => void): (() => void) => {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
};
