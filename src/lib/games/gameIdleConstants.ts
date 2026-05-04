/**
 * On-chain idle timeout: if no one moves for this many blocks after the
 * last on-chain activity height (stored in registers), the **waiting**
 * player may split the pot back to both P2PK addresses (minus fee slack).
 *
 * 5040 blocks ≈ 7 days at ~2 min/block (common Ergo inter-block time).
 * Must match literals in `ticTacToe.es` and `superTicTacToe.es`.
 */
export const IDLE_REFUND_BLOCKS = 5040;

/** Upper bound on miner fee (nanoERG) assumed inside contracts for refund math. */
export const IDLE_REFUND_FEE_ALLOWANCE_NANO = BigInt(5_000_000);
