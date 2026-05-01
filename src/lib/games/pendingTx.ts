/**
 * Pending-transaction tracker for the tic-tac-toe game.
 *
 * Ergo block times are 1.5–3 minutes, and during that window a move
 * looks like nothing happened from the player's perspective: the tx
 * is in the mempool but the unspent-box poll still returns the old
 * state. Without UX scaffolding the user assumes their move didn't
 * land and clicks the cell again, double-submitting.
 *
 * This module:
 *   - Persists pending ops to localStorage so they survive a refresh.
 *   - Tags each op with the boxId it consumes and the predicted next
 *     state, so reconciliation against the polled chain state is
 *     trivial.
 *   - Lets the Lobby / Active-game view render OPTIMISTIC state for
 *     ops that have been submitted but not yet confirmed.
 *   - Auto-clears confirmed ops once the chain catches up.
 *   - Surfaces "stuck" ops (no progress after N minutes) so the user
 *     can decide whether to retry.
 */

import { Board } from "./ticTacToeLogic";

export type PendingKind = "create" | "join" | "move" | "cancel" | "claim" | "draw";

export interface PendingTx {
  /** Stable id; we use the on-chain txId once we have it. */
  id: string;
  kind: PendingKind;
  /** The box this op consumed (the one we predict will be gone next poll). */
  spentBoxId: string | null;
  /** Predicted new game state — only set for kinds that produce one. */
  predicted: {
    board: Board;
    p1PubKeyHex: string;
    p2PubKeyHex: string;
    wagerNanoErg: string; // serialized for localStorage
  } | null;
  /** Extra metadata for the predicted next box ("created", "joined", ...). */
  predictedPhase: "open" | "ongoing" | "won" | "drawn" | "spent";
  /** Used to follow the box across rebuilds: (p1, p2, wager) triple. */
  follow: {
    p1PubKeyHex: string;
    p2PubKeyHex: string; // for create, this is p1
    wagerNanoErg: string;
  } | null;
  submittedAt: number;
  /** Free-form summary for the toast / banner. */
  description: string;
}

const STORAGE_KEY = "ergo-game-pending-v1";
const MAX_AGE_MS = 30 * 60 * 1000; // drop after 30 min — block can't be that slow
export const STUCK_AFTER_MS = 6 * 60 * 1000; // soft warn after 6 min

const subscribers = new Set<() => void>();

const readAll = (): PendingTx[] => {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingTx[];
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed.filter((p) => now - p.submittedAt < MAX_AGE_MS);
  } catch {
    return [];
  }
};

const writeAll = (txs: PendingTx[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(txs));
  } catch {
    // quota — ignore, in-memory copy is still fine
  }
  subscribers.forEach((cb) => {
    try {
      cb();
    } catch {
      // ignore
    }
  });
};

export const getPendingTxs = (): PendingTx[] => readAll();

export const addPendingTx = (tx: PendingTx): void => {
  const all = readAll();
  const next = [...all.filter((p) => p.id !== tx.id), tx];
  writeAll(next);
};

export const removePendingTx = (id: string): void => {
  const next = readAll().filter((p) => p.id !== id);
  writeAll(next);
};

/**
 * Drop pending ops whose predicted state has been observed on-chain
 * (or whose spent box is no longer unspent — close enough). We keep
 * very recent ops (<10s) regardless so the optimistic UI doesn't
 * flicker between submit and the first poll.
 */
export interface ChainSnapshot {
  unspentBoxIds: Set<string>;
  /** Set of (p1Pk + p2Pk + wager) keys for unspent boxes. */
  unspentTriples: Set<string>;
}

const SETTLE_GRACE_MS = 10_000;

export const reconcilePending = (snap: ChainSnapshot): void => {
  const all = readAll();
  const now = Date.now();
  const surviving: PendingTx[] = [];
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

    if (p.kind === "cancel" || p.kind === "claim" || p.kind === "draw") {
      // Resolved when the spent box is gone (no successor expected).
      if (spentDisappeared) continue;
      surviving.push(p);
    } else if (p.kind === "create") {
      // First box for this game: no spent input. Confirmed once the
      // (p1, p1, wager) open game appears on-chain.
      if (followBoxIsThere) continue;
      surviving.push(p);
    } else {
      // join / move: the follow triple may already match the *pre-tx*
      // unspent box (same p1, p2, wager across a move). We must wait
      // until the spent input box id drops out of the unspent set;
      // otherwise we'd clear the pending op ~10s after submit while
      // the old box is still the only mempool-visible state.
      if (followBoxIsThere && spentDisappeared) continue;
      surviving.push(p);
    }
  }
  if (surviving.length !== all.length) writeAll(surviving);
};

export const subscribePending = (cb: () => void): (() => void) => {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
};
