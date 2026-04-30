import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
  useCallback,
  useRef,
} from "react";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { WalletData } from "../components/wallet/WalletConnector";
import { processTokens } from "../utils/tokenProcessing";
import {
  fetchAddressBalance,
  enrichTokens,
  formatErgFromNano,
} from "../utils/ergoExplorer";
import { findExistingVault } from "../lib/ergoKeyVault";
import { VaultRecord } from "../lib/vaultStorage";
import { isErgoWallet } from "../lib/NautilusConnector";
import {
  nautilusDirectAddressFallbackEnabled,
  walletProviderMode,
} from "../lib/appEnv";

/**
 * WalletContext is the unified surface the rest of the app reads from
 * (WalletDashboard, NFTGallery, navbar widget, etc.).
 *
 * It bridges three sources, in priority order:
 *
 *   1. The user's primary Dynamic wallet (e.g. Nautilus picked inside
 *      the DynamicWidget). Address comes straight from the connector.
 *
 *   2. The user's encrypted vault, if they're logged in via email and
 *      have already provisioned the passkey-encrypted Ergo wallet.
 *      We don't need the seed unlocked to read balance/tokens — the
 *      Ergo address is stored on the public part of the vault record.
 *
 *   3. (Legacy fallback) A direct Nautilus connection, if the user
 *      somehow connected without going through Dynamic. We keep this
 *      so older WalletConnector dropdowns don't break, but the
 *      "Connect" action no longer triggers it.
 *
 * Whichever source resolves first wins, and the rest of the app sees
 * a single `walletData.isConnected = true` regardless of which path.
 */

const WALLET_AUTO_CONNECT_KEY = "ergo_wallet_auto_connect";

interface WalletContextType {
  walletData: WalletData;
  /** Opens Dynamic auth when enabled; otherwise no-op. */
  connectToWallet: () => Promise<void>;
  /** Connect Nautilus via EIP-12 without opening Dynamic (when enabled by env). */
  connectWithNautilusDirect: () => Promise<void>;
  /** Navbar / dashboard: Dynamic in dynamic+both modes, Nautilus in nautilus-only. */
  connectPrimaryWallet: () => Promise<void>;
  /** Logs the user out of Dynamic and clears local state. */
  disconnectFromWallet: () => Promise<void>;
  /** Re-fetches balance + tokens for the current address. */
  refreshWallet: () => Promise<void>;
  /** Active Ergo address feeding the dashboard, or null. */
  ergoAddress: string | null;
  /** Source of the active address, for UI hints. */
  source: "dynamic-nautilus" | "vault" | "nautilus-direct" | null;
  /** Kept for API compatibility with the old auto-connect toggle. */
  setAutoConnect: (enabled: boolean) => void;
  autoConnectEnabled: boolean;
}

const defaultWalletData: WalletData = {
  isConnected: false,
  ergBalance: "0",
  tokens: [],
  walletStatus: "Not connected",
};

const WalletContext = createContext<WalletContextType>({
  walletData: defaultWalletData,
  connectToWallet: async () => {},
  connectWithNautilusDirect: async () => {},
  connectPrimaryWallet: async () => {},
  disconnectFromWallet: async () => {},
  refreshWallet: async () => {},
  ergoAddress: null,
  source: null,
  setAutoConnect: () => {},
  autoConnectEnabled: false,
});

export const useWallet = () => useContext(WalletContext);

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const { primaryWallet, user, handleLogOut, setShowAuthFlow } =
    useDynamicContext();

  const [walletData, setWalletData] = useState<WalletData>(defaultWalletData);
  const [ergoAddress, setErgoAddress] = useState<string | null>(null);
  const [source, setSource] = useState<WalletContextType["source"]>(null);
  /** Set when the user connects Nautilus from the navbar without Dynamic. */
  const [nautilusDirectAddr, setNautilusDirectAddr] = useState<string | null>(null);
  const nautilusAutoTried = useRef(false);

  const [autoConnectEnabled, setAutoConnectEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem(WALLET_AUTO_CONNECT_KEY);
    return saved === "true";
  });

  const setAutoConnect = (enabled: boolean) => {
    setAutoConnectEnabled(enabled);
    localStorage.setItem(WALLET_AUTO_CONNECT_KEY, enabled ? "true" : "false");
  };

  // Resolve the best Ergo address for the current session.
  useEffect(() => {
    let cancelled = false;
    const resolveAddress = async () => {
      // 1) Nautilus picked through the Dynamic widget.
      if (isErgoWallet(primaryWallet)) {
        try {
          const w = window as any;
          const addr =
            w.ergo && (await w.ergo.get_change_address?.());
          if (!cancelled && addr) {
            setErgoAddress(addr);
            setSource("dynamic-nautilus");
            return;
          }
        } catch {
          // fall through to vault lookup
        }
      }

      // 2) Email login → vault. The vault record already contains the
      //    Ergo address publicly; no unlock needed for read-only state.
      if (user) {
        const vault: VaultRecord | null = findExistingVault(user as any);
        if (!cancelled && vault?.ergoAddress) {
          setErgoAddress(vault.ergoAddress);
          setSource("vault");
          return;
        }
      }

      // 3) Navbar "Connect Nautilus" (explicit direct session).
      if (nautilusDirectAddr) {
        if (!cancelled) {
          setErgoAddress(nautilusDirectAddr);
          setSource("nautilus-direct");
        }
        return;
      }

      // 4) Legacy direct Nautilus (window.ergo populated outside Dynamic).
      if (nautilusDirectAddressFallbackEnabled) {
        try {
          const w = window as any;
          if (w.ergo && typeof w.ergo.get_change_address === "function") {
            const addr = await w.ergo.get_change_address();
            if (!cancelled && addr) {
              setErgoAddress(addr);
              setSource("nautilus-direct");
              return;
            }
          }
        } catch {
          // ignore
        }
      }

      if (!cancelled) {
        setErgoAddress(null);
        setSource(null);
      }
    };
    resolveAddress();
    return () => {
      cancelled = true;
    };
  }, [primaryWallet, user, nautilusDirectAddr]);

  // Whenever the address changes, refresh balance + tokens.
  const refreshSeq = useRef(0);
  const loadDataForAddress = useCallback(async (addr: string) => {
    const seq = ++refreshSeq.current;
    setWalletData((prev) => ({ ...prev, walletStatus: "Loading…" }));
    const balance = await fetchAddressBalance(addr);
    if (seq !== refreshSeq.current) return;
    if (!balance) {
      setWalletData({
        isConnected: true,
        ergBalance: "0",
        tokens: [],
        walletStatus: "Connected (balance unavailable)",
      });
      return;
    }
    const enriched = await enrichTokens(balance.tokens);
    if (seq !== refreshSeq.current) return;
    const processed = processTokens(enriched, {
      metadataOptions: { extractTraits: true },
      detectCollections: true,
      generatePlaceholderImage: true,
    });
    setWalletData({
      isConnected: true,
      ergBalance: formatErgFromNano(balance.nanoErgs),
      tokens: processed,
      walletStatus: "Connected",
    });
  }, []);

  useEffect(() => {
    if (!ergoAddress) {
      setWalletData(defaultWalletData);
      return;
    }
    loadDataForAddress(ergoAddress);
  }, [ergoAddress, loadDataForAddress]);

  const refreshWallet = useCallback(async () => {
    if (ergoAddress) await loadDataForAddress(ergoAddress);
  }, [ergoAddress, loadDataForAddress]);

  const connectToWallet = useCallback(async () => {
    setNautilusDirectAddr(null);
    setShowAuthFlow(true);
    setAutoConnect(true);
  }, [setShowAuthFlow, setAutoConnect]);

  const connectWithNautilusDirect = useCallback(async () => {
    const w = window as any;
    if (!w.ergoConnector?.nautilus) {
      throw new Error(
        "Nautilus extension not detected. Install Nautilus and reload this page."
      );
    }
    const granted = await w.ergoConnector.nautilus.connect();
    if (!granted) {
      throw new Error("Nautilus connection was rejected.");
    }
    if (!w.ergo?.get_change_address) {
      throw new Error("Nautilus connected but window.ergo is not available.");
    }
    const addr = await w.ergo.get_change_address();
    setNautilusDirectAddr(addr);
    setAutoConnect(true);
  }, [setAutoConnect]);

  const connectPrimaryWallet = useCallback(async () => {
    if (walletProviderMode === "nautilus") {
      await connectWithNautilusDirect();
    } else {
      await connectToWallet();
    }
  }, [walletProviderMode, connectToWallet, connectWithNautilusDirect]);

  // Nautilus-only builds: optional one-shot auto-connect when the user enabled it.
  useEffect(() => {
    if (walletProviderMode !== "nautilus") return;
    if (!autoConnectEnabled || nautilusAutoTried.current) return;
    if (ergoAddress) return;
    nautilusAutoTried.current = true;
    void connectWithNautilusDirect().catch(() => {
      // Extension missing or user rejected — stay disconnected.
    });
  }, [
    walletProviderMode,
    autoConnectEnabled,
    ergoAddress,
    connectWithNautilusDirect,
  ]);

  const disconnectFromWallet = useCallback(async () => {
    try {
      await handleLogOut();
    } catch {
      // ignore — local state is wiped below regardless.
    }
    setWalletData(defaultWalletData);
    setErgoAddress(null);
    setSource(null);
    setNautilusDirectAddr(null);
    setAutoConnect(false);
  }, [handleLogOut]);

  return (
    <WalletContext.Provider
      value={{
        walletData,
        connectToWallet,
        connectWithNautilusDirect,
        connectPrimaryWallet,
        disconnectFromWallet,
        refreshWallet,
        ergoAddress,
        source,
        setAutoConnect,
        autoConnectEnabled,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};
