import { type WalletConnectorConstructor } from '@dynamic-labs/wallet-connector-core';

import { NautilusErgoWalletConnector } from './NautilusErgoWalletConnector.js';

export {
  NautilusErgoWalletConnector,
  NAUTILUS_KEY,
} from './NautilusErgoWalletConnector.js';
export type {
  ErgoEip12Provider,
  NautilusErgoConnector,
} from './NautilusErgoWalletConnector.js';

/**
 * Canonical type guard for a primary wallet that is actually our
 * Nautilus / Ergo connector. Prefer this over `isEthereumWallet`
 * because the connector claims `'EVM'` as its supported chain to
 * satisfy the SDK's chain filter (the public `Chain` enum has no
 * `ERGO` value yet).
 */
export const isNautilusErgoWallet = (wallet: unknown): boolean =>
  Boolean(
    wallet &&
      typeof wallet === 'object' &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (wallet as any).connector?.key === 'nautilusergo',
  );

export const NautilusErgoWalletConnectors = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- we don't care about the props
  _props: any,
): WalletConnectorConstructor[] => [
  NautilusErgoWalletConnector as unknown as WalletConnectorConstructor,
];
