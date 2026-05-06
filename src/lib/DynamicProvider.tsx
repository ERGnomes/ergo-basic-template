import React, { ReactNode } from "react";
import { ErgoDynamicProvider } from "@twobitedd/ergo-dapp-kit";

interface Props {
  children: ReactNode;
}

/**
 * Root Dynamic.xyz provider with Ethereum + Nautilus (Ergo EIP-12).
 * Implemented by `@twobitedd/ergo-dapp-kit`.
 */
export const DynamicProvider: React.FC<Props> = ({ children }) => (
  <ErgoDynamicProvider>{children}</ErgoDynamicProvider>
);
