import React, { ReactNode } from "react";
import { DynamicContextProvider } from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";

const ENV_ID =
  process.env.REACT_APP_DYNAMIC_ENV_ID ||
  process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID ||
  "";

interface Props {
  children: ReactNode;
}

/**
 * Root provider that wires Dynamic.xyz into the app.
 *
 * Per Dynamic's Tier 3 docs, Ergo is not a natively-supported chain, so
 * we register the EVM connectors and use the embedded EVM wallet as the
 * signing root for Ergo (see `lib/ergoFromDynamic.ts`).
 */
export const DynamicProvider: React.FC<Props> = ({ children }) => {
  if (!ENV_ID) {
    return (
      <div
        style={{
          padding: "16px",
          margin: "16px",
          border: "1px solid #d97706",
          borderRadius: "8px",
          background: "rgba(217, 119, 6, 0.08)",
          fontFamily: "monospace",
          fontSize: "13px",
          lineHeight: 1.5,
        }}
      >
        <strong>Dynamic.xyz environment ID is missing.</strong>
        <br />
        Set <code>REACT_APP_DYNAMIC_ENV_ID</code> (or{" "}
        <code>NEXT_PUBLIC_DYNAMIC_ENV_ID</code> if you migrate to Next.js)
        in a <code>.env</code> file at the project root and restart the
        dev server. See <code>.env.example</code>.
        <div style={{ marginTop: 8 }}>{children}</div>
      </div>
    );
  }

  return (
    <DynamicContextProvider
      settings={{
        environmentId: ENV_ID,
        walletConnectors: [EthereumWalletConnectors],
      }}
    >
      {children}
    </DynamicContextProvider>
  );
};
