import React, { ReactNode } from "react";
import {
  ErgoWalletProvider,
  useErgoWallet,
  useWallet,
} from "@twobitedd/ergo-dapp-kit";
import { findExistingVault } from "../lib/ergoKeyVault";

export { useWallet, useErgoWallet };
export type { WalletData } from "@twobitedd/ergo-dapp-kit";

interface WalletProviderProps {
  children: ReactNode;
}

/** Bridges Dynamic + Nautilus + optional vault address into one hook (`useWallet`). */
export const WalletProvider: React.FC<WalletProviderProps> = ({
  children,
}) => (
  <ErgoWalletProvider
    getVaultErgoAddress={(user) =>
      findExistingVault(
        user as { metadata?: unknown } | null | undefined
      )?.ergoAddress ?? null
    }
  >
    {children}
  </ErgoWalletProvider>
);
