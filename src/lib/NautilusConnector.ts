/**
 * Custom Dynamic.xyz wallet connector for Nautilus (Ergo EIP-12).
 *
 * Goal: surface "Nautilus" as a selectable wallet inside the
 * `<DynamicWidget />` whenever the user has the extension installed,
 * so the login screen presents a single unified set of options
 * (email login + Nautilus). When Nautilus isn't installed, the
 * connector reports `isInstalledOnBrowser() === false` and Dynamic
 * automatically hides it from the list.
 *
 * Implementation notes:
 *
 *   - Dynamic's `Chain` enum does not include "ERGO". We therefore
 *     claim `["EVM"]` as `supportedChains` so the widget's chain
 *     filter (which intersects against the project's enabled chains)
 *     accepts our connector. This has one side-effect: the global
 *     helper `isEthereumWallet(wallet)` will return `true` for our
 *     wallet object too, because it checks `wallet.chain === 'EVM'`.
 *     Downstream Ethereum-specific code (e.g. viem signing) is NEVER
 *     invoked on this wallet because the user only interacts with it
 *     through our `NautilusErgoSession` helper, which routes
 *     everything through `window.ergo` (EIP-12). To distinguish at
 *     runtime, prefer checking `wallet.connector.key === NAUTILUS_KEY`.
 *
 *   - Nautilus's connect API is asynchronous: `window.ergoConnector.nautilus.connect()`
 *     prompts the user, then `window.ergo` becomes available. We wrap
 *     that into Dynamic's `connect()` lifecycle, then expose a single
 *     address (the change address) via `getAddress()`.
 *
 *   - For `signMessage` we call `window.ergo.auth(address, message)`,
 *     which produces an Ergo P2PK Schnorr proof (NOT an ECDSA
 *     signature). The base interface accepts a returned string so
 *     this is fine; consumers that try to interpret the result as
 *     ECDSA will not be hit because we type-narrow by key, not by
 *     chain.
 *
 *   - This module is intentionally a thin runtime adapter. It does
 *     NOT attempt to fork Dynamic's full wallet UI book entry. The
 *     widget renders our connector with the metadata we hand to its
 *     constructor (name, icon, etc).
 */

import {
  WalletConnectorBase,
  type Chain,
  type WalletConstructor,
} from "@dynamic-labs/wallet-connector-core";

export const NAUTILUS_KEY = "nautilusergo";

// We rely on the global `Window.ergoConnector` / `Window.ergo` types
// declared in `src/utils/ergo.ts`. We avoid re-declaring them here so
// the two modules don't collide on declaration-merging modifiers.
type ErgoEip12 = {
  get_change_address(): Promise<string>;
  get_used_addresses(): Promise<string[]>;
  get_balance(): Promise<string>;
  get_utxos(amount?: any): Promise<any[]>;
  sign_tx(tx: any): Promise<any>;
  auth(
    address: string,
    message: string
  ): Promise<{ signedMessage: string; proof: string }>;
};

const NAUTILUS_METADATA = {
  id: NAUTILUS_KEY,
  name: "Nautilus (Ergo)",
  // Inline SVG → data URI so we don't depend on shipping a static
  // asset. Renders as a stylised "N" against the Ergo orange.
  icon:
    "data:image/svg+xml;base64," +
    btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#FF6B00"/>
  <path d="M18 46V18h6l16 18V18h6v28h-6L24 28v18z" fill="#fff"/>
</svg>`),
};

export class NautilusWalletConnector extends WalletConnectorBase {
  // Dynamic's WalletConnectorBase requires a `ChainWallet` for type
  // discrimination — we hand it the base `Wallet` since we only need
  // the standard fields.
  ChainWallet = undefined as unknown as WalletConstructor<any>;

  override name = "Nautilus";

  // See file-level note for why we claim EVM here.
  override readonly supportedChains: Chain[] = ["EVM"];

  // The widget reads `key` to position our wallet in the list and
  // we use the same key to identify the connector at runtime in
  // `ErgoWallet.tsx`.
  override get key(): string {
    return NAUTILUS_KEY;
  }

  // The chain field that goes onto the `Wallet` instance.
  override connectedChain: Chain = "EVM";

  override get metadata() {
    return {
      id: NAUTILUS_METADATA.id,
      name: NAUTILUS_METADATA.name,
      iconUrl: NAUTILUS_METADATA.icon,
      websiteUrl: "https://nautiluswallet.com",
    } as any;
  }

  override isInstalledOnBrowser(): boolean {
    if (typeof window === "undefined") return false;
    const w = window as any;
    return Boolean(w.ergoConnector && w.ergoConnector.nautilus);
  }

  override async init(): Promise<void> {
    // The base class declares `isAvailable` as a plain field.
    // We refresh it from the runtime probe on init so the widget's
    // wallet list shows or hides Nautilus correctly.
    this.isAvailable = this.isInstalledOnBrowser();
  }

  override async connect(): Promise<void> {
    if (!this.isInstalledOnBrowser()) {
      throw new Error(
        "Nautilus is not installed. Install it from nautiluswallet.com and reload."
      );
    }
    const w = window as any;
    const granted = await w.ergoConnector.nautilus.connect();
    if (!granted) {
      throw new Error("Nautilus connection was rejected by the user.");
    }
  }

  private getErgo(): ErgoEip12 | null {
    const w = window as any;
    return w.ergo ? (w.ergo as ErgoEip12) : null;
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

  override async signMessage(messageToSign: string): Promise<string | undefined> {
    const ergo = this.getErgo();
    if (!ergo) return undefined;
    const address = await ergo.get_change_address();
    // EIP-12 `auth(...)` produces an Ergo P2PK Schnorr proof of
    // knowledge of the address's private key for `messageToSign`.
    // The result has the shape { signedMessage, proof } — we return
    // the proof (hex) so consumers have something stable to verify.
    const result = await ergo.auth(address, messageToSign);
    return result?.proof;
  }

  override async proveOwnership(
    address: string,
    messageToSign: string
  ): Promise<string | undefined> {
    const ergo = this.getErgo();
    if (!ergo) return undefined;
    const result = await ergo.auth(address, messageToSign);
    return result?.proof;
  }

  override async endSession(): Promise<void> {
    try {
      const w = window as any;
      await w.ergoConnector?.nautilus?.disconnect?.();
    } catch {
      // ignore
    }
  }

  override async getNetwork(): Promise<number | string | undefined> {
    return "ergo:mainnet";
  }

  override async isTestnet(): Promise<boolean> {
    return false;
  }

  override get hasNativeToken(): boolean {
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
    return ["https://explorer.ergoplatform.com/"];
  }
}

/**
 * The factory shape that Dynamic's `walletConnectors` array expects.
 * Dynamic invokes each factory with constructor-options-prop and
 * expects an array of class constructors back.
 */
export const NautilusWalletConnectors = (
  _props?: any
): { new (props?: any): NautilusWalletConnector }[] => {
  return [NautilusWalletConnector];
};
