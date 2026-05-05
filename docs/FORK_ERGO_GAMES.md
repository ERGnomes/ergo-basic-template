# Spin-off: ERGO.games

This guide turns the **ergo-dapp-starter** into a dedicated games site (working name **ERGO.games**). The codebase stays MIT-licensed; you own branding, hosting, and any new contracts you deploy.

## 1. Create the GitHub project

1. **Fork** this repository on GitHub (or use “Use this template” if the repo enables it), **or** create an empty `ergo-games` repo and push a copy:
   ```bash
   git clone https://github.com/ERGnomes/ergo-basic-template.git ergo-games
   cd ergo-games
   git remote remove origin
   git remote add origin https://github.com/YOUR_ORG/ergo-games.git
   git push -u origin main
   ```
2. Pick a **repository name** you are happy with (`ergo-games`, `ERGO-games`, etc.). The npm `package.json` name can match (`ergo-games`) for clarity.

## 2. Branding and environment

1. Copy the games-focused env template:
   ```bash
   cp .env.ergo.games.example .env
   ```
2. Edit `.env` (and set the **same** variables in production — e.g. Railway — before `npm run build`):
   - `REACT_APP_SITE_NAME` — e.g. `ERGO.games`
   - `REACT_APP_SITE_DESCRIPTION` — short public description for meta tags
   - `REACT_APP_SITE_URL` — canonical URL, e.g. `https://ergo.games` (Open Graph)
   - `REACT_APP_GITHUB_REPO_URL` — your new repo (footer “Source on GitHub”)
3. Leave **`REACT_APP_SHOW_DEV_TOOLS` unset** on production so `/rosen-test` stays hidden.

See [SETUP.md](../SETUP.md) for `REACT_APP_WALLET_PROVIDERS` and `REACT_APP_DYNAMIC_ENV_ID`.

## 3. Domain and HTTPS

1. Register or point **ergo.games** (or your chosen hostname) at your host’s DNS instructions.
2. Enable HTTPS at the edge (Railway, Cloudflare, etc.). Set `REACT_APP_SITE_URL` to the `https://` URL you serve.

## 4. Product shape (recommended first steps)

| Area | Suggestion |
|------|------------|
| **Home** | Today the app lands on the wallet dashboard. For a games portal, consider a future `LandingPage` at `/` and move dashboard to `/wallet` — or keep dashboard and add a prominent “Play” section linking to `/games/tic-tac-toe` and `/games/xoxo`. |
| **Nav** | Edit `src/App.tsx` `navLinks`: reorder so game routes are first; hide NFT Gallery or Rosen test until you need them. |
| **Contracts** | Games use embedded ErgoTree hex in `*Contract.ts`. When you change `.es` sources, recompile, update hex, and append old trees in `gameLegacyTrees.ts` so open boxes still appear. |
| **Dynamic** | Use a **Dedicated** Dynamic project for ERGO.games so keys and branding are separate from the template demo. |

## 5. Optional cleanup

- **`package.json`**: change `"name"` to `ergo-games` and bump `"version"` when you ship.
- **`public/manifest.json`**: short_name / name for install prompts (CRA does not substitute env here; edit manually or add a small build script later).
- **Screenshots**: Replace `public/Screenshot *.png` in README with ERGO.games UI when ready.
- **LICENSE**: Keep MIT; you may add a `NOTICE` file for attributions if you redistribute.

## 6. Ongoing sync with upstream

If you want fixes from **ergo-dapp-starter**:

```bash
git remote add upstream https://github.com/ERGnomes/ergo-basic-template.git
git fetch upstream
git merge upstream/main
# resolve conflicts in App.tsx, games, etc.
```

## 7. Checklist before launch

- [ ] Production env vars set and **redeploy** after any change (CRA bakes them at build time).
- [ ] `REACT_APP_DYNAMIC_ENV_ID` (or Nautilus-only mode) tested on the real hostname.
- [ ] Wallet flows tested: create/join/move/claim and idle refund on a **tiny** wager.
- [ ] Footer and `/developers` copy match your support / disclaimer needs.

When this file lives in your fork, update any `ERGnomes/ergo-basic-template` URLs in it to your repo.
