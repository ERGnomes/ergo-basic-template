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
/**
 * When no env id is configured we still need to render the app shell
 * (so the rest of the template — Nautilus path, NFT gallery, etc. —
 * keeps working) but components that call `useDynamicContext()` would
 * throw. We solve this with a lightweight "missing env id" dialog
 * mounted at the top of the page and a Dynamic provider configured
 * with a placeholder env id so child hooks resolve to a no-op context
 * instead of throwing.
 *
 * The placeholder env id below is invalid on purpose — Dynamic's
 * widget will refuse to authenticate against it, which surfaces the
 * misconfiguration at the right layer.
 */
const PLACEHOLDER_ENV_ID = "00000000-0000-0000-0000-000000000000";

const MissingEnvBanner: React.FC = () => (
  <div
    style={{
      padding: "12px 16px",
      margin: "12px 16px",
      border: "1px solid #d97706",
      borderRadius: "8px",
      background: "rgba(217, 119, 6, 0.08)",
      fontFamily:
        "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontSize: "13px",
      lineHeight: 1.5,
    }}
  >
    <strong>Dynamic.xyz environment ID is missing.</strong> Set{" "}
    <code>REACT_APP_DYNAMIC_ENV_ID</code> (or{" "}
    <code>NEXT_PUBLIC_DYNAMIC_ENV_ID</code>) on the build environment
    and redeploy. See <code>.env.example</code>. The Dynamic-based
    pages will not work until this is configured.
  </div>
);

export const DynamicProvider: React.FC<Props> = ({ children }) => {
  return (
    <DynamicContextProvider
      settings={{
        environmentId: ENV_ID || PLACEHOLDER_ENV_ID,
        walletConnectors: [EthereumWalletConnectors],
      }}
    >
      {!ENV_ID && <MissingEnvBanner />}
      {children}
    </DynamicContextProvider>
  );
};
