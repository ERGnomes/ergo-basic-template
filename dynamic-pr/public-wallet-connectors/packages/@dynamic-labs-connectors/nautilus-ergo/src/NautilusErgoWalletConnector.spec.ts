/* eslint-disable @typescript-eslint/no-explicit-any */
import { NautilusErgoWalletConnector } from './NautilusErgoWalletConnector.js';

jest.mock('@dynamic-labs/wallet-connector-core', () => ({
  ...jest.requireActual('@dynamic-labs/wallet-connector-core'),
  logger: {
    debug: jest.fn(),
  },
}));

const walletConnectorProps = {
  walletBook: {} as any,
  evmNetworks: [],
} as any;

const installNautilusMock = (overrides: Partial<{
  connect: jest.Mock;
  disconnect: jest.Mock;
  changeAddress: string | undefined;
  usedAddresses: string[];
  balance: string;
  authResult: { signedMessage: string; proof: string } | undefined;
  authThrows: boolean;
  changeAddressThrows: boolean;
  balanceThrows: boolean;
}> = {}) => {
  const w = window as any;

  const connect = overrides.connect ?? jest.fn().mockResolvedValue(true);
  const disconnect = overrides.disconnect ?? jest.fn().mockResolvedValue(undefined);

  w.ergoConnector = {
    nautilus: {
      connect,
      disconnect,
      isConnected: jest.fn().mockResolvedValue(true),
    },
  };

  const hasOwnChangeAddress = Object.prototype.hasOwnProperty.call(
    overrides,
    'changeAddress',
  );

  w.ergo = {
    get_change_address: jest.fn(async () => {
      if (overrides.changeAddressThrows) throw new Error('boom');
      return hasOwnChangeAddress
        ? overrides.changeAddress
        : '9f4QF8AD1nQ3nJahQVkMj8hFSVVzVom77b52JU7EW71Zexg6N8v';
    }),
    get_used_addresses: jest.fn(async () => overrides.usedAddresses ?? []),
    get_balance: jest.fn(async () => {
      if (overrides.balanceThrows) throw new Error('balance boom');
      return overrides.balance ?? '1000000000';
    }),
    auth: jest.fn(async () => {
      if (overrides.authThrows) throw new Error('auth boom');
      return (
        overrides.authResult ?? {
          signedMessage: 'msg',
          proof: 'deadbeef',
        }
      );
    }),
  };

  return { connect, disconnect };
};

const removeNautilusMock = () => {
  const w = window as any;
  delete w.ergoConnector;
  delete w.ergo;
};

describe('NautilusErgoWalletConnector', () => {
  let connector: NautilusErgoWalletConnector;

  beforeEach(() => {
    jest.clearAllMocks();
    removeNautilusMock();
    connector = new NautilusErgoWalletConnector(walletConnectorProps);
  });

  afterEach(() => {
    removeNautilusMock();
  });

  it('should initialize with correct name and key', () => {
    expect(connector.name).toBe('Nautilus');
    expect(connector.key).toBe('nautilusergo');
  });

  it('should expose a websiteUrl in metadata', () => {
    expect(connector.metadata.websiteUrl).toBe('https://nautiluswallet.com');
    expect(connector.metadata.id).toBe('nautilusergo');
    expect(connector.metadata.name).toBe('Nautilus');
  });

  it('should claim EVM as supported chain (Ergo is Tier 3)', () => {
    expect(connector.supportedChains).toEqual(['EVM']);
    expect(connector.connectedChain).toBe('EVM');
  });

  describe('isInstalledOnBrowser', () => {
    it('returns false when window.ergoConnector is missing', () => {
      expect(connector.isInstalledOnBrowser()).toBe(false);
    });

    it('returns true when window.ergoConnector.nautilus is present', () => {
      installNautilusMock();
      expect(connector.isInstalledOnBrowser()).toBe(true);
    });
  });

  describe('init', () => {
    it('flips isAvailable based on the runtime probe', async () => {
      installNautilusMock();
      await connector.init();
      expect(connector.isAvailable).toBe(true);

      removeNautilusMock();
      await connector.init();
      expect(connector.isAvailable).toBe(false);
    });
  });

  describe('connect', () => {
    it('throws when nautilus is not installed', async () => {
      await expect(connector.connect()).rejects.toThrow(
        /Nautilus is not installed/,
      );
    });

    it('throws when the user rejects the prompt', async () => {
      installNautilusMock({ connect: jest.fn().mockResolvedValue(false) });
      await expect(connector.connect()).rejects.toThrow(/rejected/);
    });

    it('resolves when nautilus grants the connection', async () => {
      const { connect } = installNautilusMock();
      await expect(connector.connect()).resolves.toBeUndefined();
      expect(connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAddress', () => {
    it('returns undefined when window.ergo is missing', async () => {
      expect(await connector.getAddress()).toBeUndefined();
    });

    it('returns the change address from EIP-12', async () => {
      installNautilusMock({ changeAddress: '9fAddress' });
      expect(await connector.getAddress()).toBe('9fAddress');
    });

    it('swallows EIP-12 errors and returns undefined', async () => {
      installNautilusMock({ changeAddressThrows: true });
      expect(await connector.getAddress()).toBeUndefined();
    });
  });

  describe('getConnectedAccounts', () => {
    it('returns empty when window.ergo is missing', async () => {
      expect(await connector.getConnectedAccounts()).toEqual([]);
    });

    it('returns [changeAddress]', async () => {
      installNautilusMock({ changeAddress: '9fAddress' });
      expect(await connector.getConnectedAccounts()).toEqual(['9fAddress']);
    });

    it('returns [] when change address resolves empty', async () => {
      installNautilusMock({ changeAddress: undefined as unknown as string });
      expect(await connector.getConnectedAccounts()).toEqual([]);
    });
  });

  describe('signMessage', () => {
    it('returns undefined when ergo is not present', async () => {
      expect(await connector.signMessage('hi')).toBeUndefined();
    });

    it('returns the auth proof when nautilus signs', async () => {
      installNautilusMock({
        authResult: { signedMessage: 'm', proof: 'cafef00d' },
      });
      expect(await connector.signMessage('hi')).toBe('cafef00d');
    });
  });

  describe('proveOwnership', () => {
    it('returns the proof produced by nautilus.auth', async () => {
      installNautilusMock({
        authResult: { signedMessage: 'm', proof: 'beef' },
      });
      expect(await connector.proveOwnership('9fAddress', 'hi')).toBe('beef');
    });

    it('returns undefined when ergo is missing', async () => {
      expect(await connector.proveOwnership('9fAddress', 'hi')).toBeUndefined();
    });
  });

  describe('endSession', () => {
    it('calls disconnect on nautilus when present', async () => {
      const { disconnect } = installNautilusMock();
      await connector.endSession();
      expect(disconnect).toHaveBeenCalledTimes(1);
    });

    it('swallows errors from nautilus.disconnect', async () => {
      installNautilusMock({
        disconnect: jest.fn().mockRejectedValue(new Error('already gone')),
      });
      await expect(connector.endSession()).resolves.toBeUndefined();
    });
  });

  describe('network metadata', () => {
    it('reports ergo:mainnet as the network', async () => {
      expect(await connector.getNetwork()).toBe('ergo:mainnet');
    });

    it('reports a non-testnet', async () => {
      expect(await connector.isTestnet()).toBe(false);
    });

    it('exposes the ergo block explorer', async () => {
      expect(await connector.getBlockExplorerUrlsForCurrentNetwork()).toEqual([
        'https://explorer.ergoplatform.com/',
      ]);
    });
  });

  describe('getBalance', () => {
    it('returns undefined when ergo is missing', async () => {
      expect(await connector.getBalance()).toBeUndefined();
    });

    it('returns the balance as a string', async () => {
      installNautilusMock({ balance: '42' });
      expect(await connector.getBalance()).toBe('42');
    });

    it('swallows errors and returns undefined', async () => {
      installNautilusMock({ balanceThrows: true });
      expect(await connector.getBalance()).toBeUndefined();
    });
  });

  describe('parseAddress', () => {
    it('round-trips the address (Ergo addresses are not hex-encoded)', () => {
      const addr =
        '9f4QF8AD1nQ3nJahQVkMj8hFSVVzVom77b52JU7EW71Zexg6N8v';
      expect(connector.parseAddress(addr)).toBe(addr);
    });
  });

  describe('filter', () => {
    it('returns true only when nautilus is detected', () => {
      expect(connector.filter()).toBe(false);
      installNautilusMock();
      expect(connector.filter()).toBe(true);
    });
  });

  describe('supportsNetworkSwitching', () => {
    it('returns false (Ergo only has one network on Nautilus)', () => {
      expect(connector.supportsNetworkSwitching()).toBe(false);
    });
  });
});
