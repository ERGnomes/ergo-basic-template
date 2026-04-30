import React, { ReactNode, useMemo } from "react";
import { DynamicContextProvider } from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { NautilusWalletConnectors } from "./NautilusConnector";
import { dynamicAuthRoutesEnabled, dynamicEnvironmentId } from "./appEnv";
import {
  dynamicErgoCssOverrides,
  useDynamicErgoSettingsOverrides,
} from "./dynamicErgoBranding";

const ENV_ID = dynamicEnvironmentId;

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
    and redeploy. See <code>SETUP.md</code> and <code>.env.example</code>.
    The Dynamic-based pages will not work until this is configured.
  </div>
);

export const DynamicProvider: React.FC<Props> = ({ children }) => {
  const ergoBrandingOverrides = useDynamicErgoSettingsOverrides();
  const settings = useMemo(
    () => ({
      environmentId: ENV_ID || PLACEHOLDER_ENV_ID,
      /** Required for `cssOverrides` string to apply (SDK injects it next to widget DOM). */
      shadowDOMEnabled: false,
      cssOverrides: dynamicErgoCssOverrides,
      overrides: ergoBrandingOverrides,
      walletConnectors: [
        EthereumWalletConnectors,
        // Surfaces Nautilus inside the DynamicWidget when the user
        // has the extension installed; auto-hidden otherwise via
        // `isInstalledOnBrowser()`. See `lib/NautilusConnector.ts`.
        NautilusWalletConnectors,
      ],
    }),
    [ergoBrandingOverrides]
  );

  return (
    <DynamicContextProvider
      settings={settings}
    >
      {dynamicAuthRoutesEnabled && !ENV_ID && <MissingEnvBanner />}
      {children}
    </DynamicContextProvider>
  );
};
