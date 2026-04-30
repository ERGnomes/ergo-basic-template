import { useCallback, useMemo } from "react";
import type { GenericNetwork } from "@dynamic-labs/types";

/** Served from `public/` so it works with any `homepage` / `PUBLIC_URL`. */
export const ergoMarkPublicPath = `${process.env.PUBLIC_URL ?? ""}/ergo-mark.svg`;

const isMainnetId = (id: number | string) => id === 1 || id === "1";
const isSepoliaId = (id: number | string) =>
  id === 11155111 || id === "11155111";

/**
 * Dynamic.xyz Tier-3 Ergo flow still uses an EVM embedded signer under the hood.
 * This re-labels the EVM chain row in the widget (fallback when no network vanity name).
 */
export const dynamicErgoChainDisplayOverrides = {
  evm: { displayName: "Ergo (local passkey)" },
} as const;

/** Exported for unit tests; applies vanity names + Ergo icon to known EVM testnets. */
export const applyErgoBrandingToEvmNetworks = (
  networks: GenericNetwork[]
): GenericNetwork[] => networks.map((net) => {
  const id = net.chainId;
  const icons = [...(net.iconUrls ?? [])];
  if (isMainnetId(id)) {
    return {
      ...net,
      vanityName: "Ergo mainnet (passkey signer)",
      iconUrls: [ergoMarkPublicPath, ...icons],
    };
  }
  if (isSepoliaId(id)) {
    return {
      ...net,
      vanityName: "Ergo testnet (passkey signer)",
      iconUrls: [ergoMarkPublicPath, ...icons],
    };
  }
  return net;
});

export const useDynamicErgoEvmNetworksOverride = () =>
  useCallback((dashboardNetworks: GenericNetwork[]) => {
    return applyErgoBrandingToEvmNetworks(dashboardNetworks);
  }, []);

export const useDynamicErgoSettingsOverrides = () => {
  const evmNetworks = useDynamicErgoEvmNetworksOverride();
  return useMemo(
    () => ({
      chainDisplayValues: dynamicErgoChainDisplayOverrides,
      evmNetworks,
    }),
    [evmNetworks]
  );
};

/**
 * Injects after Dynamic's base styles. `shadowDOMEnabled: false` is required so
 * this reaches widget markup (see Dynamic `ShadowDOM` implementation).
 */
export const dynamicErgoCssOverrides = `
.wallet-icon-with-network__network-container {
  display: none !important;
}
`;
