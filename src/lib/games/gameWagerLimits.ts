/**
 * Per-player wager (R7) bounds for on-chain tic-tac-toe games.
 * Kept tiny so demos cost almost nothing; total pot still includes
 * `SAFE_MIN_BOX_VALUE` from the Fleet SDK when creating the box.
 */

/** Minimum wager each player locks (nanoERG). One nanoERG is dust-tier for learning. */
export const MIN_WAGER_NANOERG = BigInt(1);

/** For `NumberInput` / ERG display (1 nanoERG). */
export const MIN_WAGER_ERG = 1e-9;

/** One ERG in nanoERG (for float conversion). */
export const NANO_PER_ERG = BigInt(1_000_000_000);

/** Suggested default in the UI — well below typical fees, still easy to type. */
export const DEFAULT_WAGER_ERG = 0.001;

const NANO_PER_ERG_NUM = Number(NANO_PER_ERG);

/** Convert ERG (UI float) to per-player wager nanoERG; rounds to nearest nano. */
export const ergToWagerNano = (erg: number): bigint => {
  if (!Number.isFinite(erg) || erg < 0) return BigInt(0);
  return BigInt(Math.round(erg * NANO_PER_ERG_NUM));
};
