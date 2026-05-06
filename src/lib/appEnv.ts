/**
 * Wallet / feature flags from `REACT_APP_*` env vars (Create React App).
 * Values are baked in at **build time** — set them in CI / Railway before `npm run build`.
 */

import {
  parseWalletProviderMode,
  readErgoDappEnv,
  type WalletProviderMode,
} from "@ergnomes/ergo-dapp-kit/env";

export { parseWalletProviderMode };
export type { WalletProviderMode };

const trim = (s: string | undefined) => (s || "").trim();

const kitEnv = readErgoDappEnv();

/** Dynamic.xyz environment id (from dashboard API tab). */
export const dynamicEnvironmentId = kitEnv.dynamicEnvironmentId;

/**
 * `REACT_APP_WALLET_PROVIDERS` (case-insensitive):
 *   `both` | `all` (default) — Dynamic + optional direct Nautilus in the navbar
 *   `dynamic` | `dynamic-only` — Dynamic only (no direct `window.ergo` fallback in WalletContext)
 *   `nautilus` | `nautilus-only` — Nautilus-first navbar; `/dynamic` route hidden
 */
export const walletProviderMode: WalletProviderMode = kitEnv.walletProviderMode;

/** Show Dynamic login page and "Sign in with Dynamic" flows. */
export const dynamicAuthRoutesEnabled = kitEnv.dynamicAuthRoutesEnabled;

/** Navbar / WalletContext may offer one-click Nautilus (EIP-12) without opening Dynamic. */
export const nautilusDirectEnabled = kitEnv.nautilusDirectEnabled;

/**
 * WalletContext may resolve `window.ergo` when the user never opened Dynamic.
 * Disabled in `dynamic-only` so Ergo address only comes from Dynamic session or vault.
 */
export const nautilusDirectAddressFallbackEnabled =
  kitEnv.nautilusDirectAddressFallbackEnabled;

/** Parse `REACT_APP_SHOW_DEV_TOOLS` style flags (1/true/on vs empty/false/0). */
export const parseShowDevTools = (raw: string | undefined): boolean => {
  const v = trim(raw).toLowerCase();
  if (!v || v === "0" || v === "false" || v === "no" || v === "off") {
    return false;
  }
  return v === "1" || v === "true" || v === "yes" || v === "on";
};

/**
 * `REACT_APP_SHOW_DEV_TOOLS`:
 * When true, show internal demo nav (e.g. Rosen metadata test) and expose `/rosen-test`.
 * Default **false** so forks look like a clean starter without editing `App.tsx`.
 */
export const devToolsNavEnabled = parseShowDevTools(
  process.env.REACT_APP_SHOW_DEV_TOOLS
);
