/**
 * Wallet / feature flags from `REACT_APP_*` env vars (Create React App).
 * Values are baked in at **build time** — set them in CI / Railway before `npm run build`.
 */

const trim = (s: string | undefined) => (s || "").trim();

/** Dynamic.xyz environment id (from dashboard API tab). */
export const dynamicEnvironmentId =
  trim(process.env.REACT_APP_DYNAMIC_ENV_ID) ||
  trim(process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID) ||
  "";

export type WalletProviderMode = "dynamic" | "nautilus" | "both";

export const parseWalletProviderMode = (raw: string): WalletProviderMode => {
  const v = trim(raw)
    .toLowerCase()
    .replace(/_/g, "-");
  if (!v || v === "all" || v === "both") return "both";
  if (v === "dynamic" || v === "dynamic-only") return "dynamic";
  if (v === "nautilus" || v === "nautilus-only") return "nautilus";
  return "both";
};

/**
 * `REACT_APP_WALLET_PROVIDERS` (case-insensitive):
 *   `both` | `all` (default) — Dynamic + optional direct Nautilus in the navbar
 *   `dynamic` | `dynamic-only` — Dynamic only (no direct `window.ergo` fallback in WalletContext)
 *   `nautilus` | `nautilus-only` — Nautilus-first navbar; `/dynamic` route hidden
 */
export const walletProviderMode: WalletProviderMode = parseWalletProviderMode(
  trim(process.env.REACT_APP_WALLET_PROVIDERS)
);

/** Show Dynamic login page and "Sign in with Dynamic" flows. */
export const dynamicAuthRoutesEnabled =
  walletProviderMode === "both" || walletProviderMode === "dynamic";

/** Navbar / WalletContext may offer one-click Nautilus (EIP-12) without opening Dynamic. */
export const nautilusDirectEnabled =
  walletProviderMode === "both" || walletProviderMode === "nautilus";

/**
 * WalletContext may resolve `window.ergo` when the user never opened Dynamic.
 * Disabled in `dynamic-only` so Ergo address only comes from Dynamic session or vault.
 */
export const nautilusDirectAddressFallbackEnabled =
  walletProviderMode === "both" || walletProviderMode === "nautilus";
