/**
 * Product / fork branding from `REACT_APP_*` (baked in at build time).
 * Defaults keep the repo usable as an anonymous starter without editing source.
 */

const trim = (s: string | undefined) => (s || "").trim();

/** Shown in the navbar and `document.title` (see `App.tsx`). */
export const siteName =
  trim(process.env.REACT_APP_SITE_NAME) || "Ergo dApp starter";

/** Meta description and PWA-oriented copy; override for your fork. */
export const siteDescription =
  trim(process.env.REACT_APP_SITE_DESCRIPTION) ||
  "React + Chakra starter for Ergo: wallet flows, NFT gallery, and on-chain game examples you can rip out or extend.";

/** Canonical site URL for Open Graph (optional). */
export const siteUrl = trim(process.env.REACT_APP_SITE_URL);

/** Shown in the footer when set (your repo URL). */
export const githubRepoUrl = trim(process.env.REACT_APP_GITHUB_REPO_URL);
