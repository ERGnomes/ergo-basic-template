/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  WalletConnectorBase,
  type Chain,
  type WalletConstructor,
} from '@dynamic-labs/wallet-connector-core';

export const NAUTILUS_KEY = 'nautilusergo';

const NAUTILUS_NAME = 'Nautilus';

const NAUTILUS_ICON =
  'data:image/svg+xml;base64,' +
  (typeof btoa !== 'undefined'
    ? btoa(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
          '<rect width="64" height="64" rx="14" fill="#FF6B00"/>' +
          '<path d="M18 46V18h6l16 18V18h6v28h-6L24 28v18z" fill="#fff"/>' +
          '</svg>',
      )
    : Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
          '<rect width="64" height="64" rx="14" fill="#FF6B00"/>' +
          '<path d="M18 46V18h6l16 18V18h6v28h-6L24 28v18z" fill="#fff"/>' +
          '</svg>',
      ).toString('base64'));

/**
 * Minimal EIP-12 surface used by this connector. The real Nautilus
 * provider exposes more, but we only depend on what the Dynamic SDK
 * needs to fulfill the WalletConnectorBase contract.
 */
export type ErgoEip12Provider = {
  get_change_address: () => Promise<string>;
  get_used_addresses: () => Promise<string[]>;
  get_balance: () => Promise<string>;
  auth: (
    address: string,
    message: string,
  ) => Promise<{ signedMessage: string; proof: string }>;
};

export type NautilusErgoConnector = {
  connect: () => Promise<boolean>;
  isConnected?: () => Promise<boolean>;
  disconnect?: () => Promise<void>;
  getContext?: () => Promise<ErgoEip12Provider>;
};

/**
 * Nautilus is the de-facto Ergo browser wallet. It implements the
 * EIP-12 dApp / wallet bridge — `window.ergoConnector.nautilus` for
 * the connection lifecycle and `window.ergo` for signing once a
 * session is open.
 *
 * Ergo is a [Tier 3 chain on Dynamic](https://docs.dynamic.xyz/overview/wallets-and-chains/tier-3-chains):
 * the Dynamic SDK does not (yet) expose `ERGO` in the public `Chain`
 * enum, so this connector claims `'EVM'` as its supported chain. The
 * widget's chain filter then accepts it as long as the project has
 * EVM enabled. Downstream Ethereum-specific code paths are never
 * invoked because consumers should discriminate by `connector.key`
 * (`NAUTILUS_KEY`), not by chain. When Dynamic adds an `ERGO` value
 * to the `Chain` enum upstream, swap the two `'EVM'` references
 * below.
 */
export class NautilusErgoWalletConnector extends WalletConnectorBase {
  ChainWallet = undefined as unknown as WalletConstructor<any>;

  override name = NAUTILUS_NAME;

  override readonly supportedChains: Chain[] = ['EVM'];

  override connectedChain: Chain = 'EVM';

  override get key(): string {
    return NAUTILUS_KEY;
  }

  override get metadata() {
    return {
      id: NAUTILUS_KEY,
      name: NAUTILUS_NAME,
      iconUrl: NAUTILUS_ICON,
      websiteUrl: 'https://nautiluswallet.com',
    } as any;
  }

  protected getNautilus(): NautilusErgoConnector | undefined {
    if (typeof window === 'undefined') return undefined;
    const w = window as any;
    return w.ergoConnector?.nautilus as NautilusErgoConnector | undefined;
  }

  protected getErgo(): ErgoEip12Provider | undefined {
    if (typeof window === 'undefined') return undefined;
    const w = window as any;
    return w.ergo as ErgoEip12Provider | undefined;
  }

  override isInstalledOnBrowser(): boolean {
    return Boolean(this.getNautilus());
  }

  override async init(): Promise<void> {
    this.isAvailable = this.isInstalledOnBrowser();
  }

  override async connect(): Promise<void> {
    const nautilus = this.getNautilus();
    if (!nautilus) {
      throw new Error(
        'Nautilus is not installed. Install it from nautiluswallet.com and reload.',
      );
    }
    const granted = await nautilus.connect();
    if (!granted) {
      throw new Error('Nautilus connection was rejected by the user.');
    }
  }

  override async getAddress(): Promise<string | undefined> {
    const ergo = this.getErgo();
    if (!ergo) return undefined;
    try {
      return await ergo.get_change_address();
    } catch {
      return undefined;
    }
  }

  override async getConnectedAccounts(): Promise<string[]> {
    const ergo = this.getErgo();
    if (!ergo) return [];
    try {
      const addr = await ergo.get_change_address();
      return addr ? [addr] : [];
    } catch {
      return [];
    }
  }

  override async signMessage(
    messageToSign: string,
  ): Promise<string | undefined> {
    const ergo = this.getErgo();
    if (!ergo) return undefined;
    const address = await ergo.get_change_address();
    if (!address) return undefined;
    const result = await ergo.auth(address, messageToSign);
    return result?.proof;
  }

  override async proveOwnership(
    address: string,
    messageToSign: string,
  ): Promise<string | undefined> {
    const ergo = this.getErgo();
    if (!ergo) return undefined;
    const result = await ergo.auth(address, messageToSign);
    return result?.proof;
  }

  override async endSession(): Promise<void> {
    try {
      await this.getNautilus()?.disconnect?.();
    } catch {
      /* nautilus throws if already disconnected; ignore */
    }
  }

  override async getNetwork(): Promise<number | string | undefined> {
    return 'ergo:mainnet';
  }

  override async isTestnet(): Promise<boolean> {
    return false;
  }

  get hasNativeToken(): boolean {
    return true;
  }

  override async getBalance(): Promise<string | undefined> {
    const ergo = this.getErgo();
    if (!ergo) return undefined;
    try {
      return String(await ergo.get_balance());
    } catch {
      return undefined;
    }
  }

  override parseAddress(address: string): string {
    return address;
  }

  override async getBlockExplorerUrlsForCurrentNetwork(): Promise<string[]> {
    return ['https://explorer.ergoplatform.com/'];
  }

  override supportsNetworkSwitching(): boolean {
    return false;
  }

  override filter(): boolean {
    return this.isInstalledOnBrowser();
  }
}
