import {
  NautilusErgoWalletConnectors,
  NautilusErgoWalletConnector,
  NAUTILUS_KEY,
  isNautilusErgoWallet,
} from './index.js';

describe('NautilusErgoWalletConnectors', () => {
  it('exports the connector constructor', () => {
    expect(NautilusErgoWalletConnectors({})).toEqual([NautilusErgoWalletConnector]);
  });

  it('exposes the canonical wallet key', () => {
    expect(NAUTILUS_KEY).toBe('nautilusergo');
  });
});

describe('isNautilusErgoWallet', () => {
  it('returns true for objects whose connector key matches', () => {
    expect(isNautilusErgoWallet({ connector: { key: NAUTILUS_KEY } })).toBe(true);
  });

  it('returns false for non-nautilus wallets', () => {
    expect(isNautilusErgoWallet({ connector: { key: 'metamask' } })).toBe(false);
    expect(isNautilusErgoWallet(undefined)).toBe(false);
    expect(isNautilusErgoWallet(null)).toBe(false);
    expect(isNautilusErgoWallet({})).toBe(false);
  });
});
