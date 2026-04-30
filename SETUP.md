# Setup guide

This project is a **Create React App** (CRA) front end for Ergo: Dynamic.xyz (email + passkey vault, Nautilus inside the widget), optional **direct Nautilus**, NFT gallery, and on-chain tic-tac-toe. Everything runs in the browser; Ergo state comes from the public **Explorer API** (`api.ergoplatform.com`).

## Requirements

| Tool | Notes |
|------|--------|
| **Node.js** | `>= 20.19` recommended (see `package.json` `engines` and `nixpacks.toml` for Railway). |
| **npm** | Comes with Node. |
| **Nautilus** (optional) | [Browser extension](https://github.com/capt-nemo429/nautilus-wallet) for EIP-12 signing and “Nautilus-only” deploys. |

## Quick start (local)

```bash
cp .env.example .env
# Edit .env — at minimum set REACT_APP_WALLET_PROVIDERS and Dynamic env id if you use Dynamic.
npm install --legacy-peer-deps
npm start
```

Open [http://localhost:3000](http://localhost:3000).

### Funding the email vault from Nautilus

On `/dynamic`, after you sign into Dynamic and have a vault address, use **Fund passkey vault from Nautilus** — it connects via **`ergoConnector.nautilus`** (classic dApp flow), independent of Dynamic’s in-widget wallet list. You can send ERG and optionally a token/NFT (`tokenId` + amount).

## Environment variables

CRA only reads variables prefixed with **`REACT_APP_`** (baked in at **build** time). Set them in `.env`, `.env.local`, or your host (Railway, Vercel, etc.) **before** `npm run build`.

### `REACT_APP_WALLET_PROVIDERS`

Controls which wallet entry points appear and how the header behaves.

| Value | Meaning |
|--------|---------|
| `both` or `all` or *(empty)* | **Default.** Dynamic login page + navbar “Sign in with Dynamic” + “Connect with Nautilus”. Direct `window.ergo` can still resolve if the user connected Nautilus outside Dynamic. |
| `dynamic` or `dynamic-only` | **Dynamic only.** Hides direct Nautilus menu item; `WalletContext` will **not** pick up `window.ergo` unless it came from Dynamic or the email vault. |
| `nautilus` or `nautilus-only` | **Nautilus-first.** Hides the `/dynamic` route and nav link; navbar primary action is Nautilus. Dynamic SDK still mounts internally with a placeholder env id so hooks do not throw. |

Case-insensitive; underscores and hyphens are accepted (`dynamic_only`, `nautilus-only`, etc.).

### `REACT_APP_DYNAMIC_ENV_ID` / `NEXT_PUBLIC_DYNAMIC_ENV_ID`

Your [Dynamic.xyz](https://app.dynamic.xyz/) project **Environment ID** (Dashboard → API). Required for real email / social login and for Nautilus **inside** the Dynamic widget.

If this is empty **and** `REACT_APP_WALLET_PROVIDERS` is not `nautilus-only`, a banner explains the misconfiguration. Nautilus-only builds can leave it empty.

### Optional

| Variable | Purpose |
|----------|---------|
| `PORT` | Used by `npm run serve` in production Docker/Railway (default `3000`). |

## Production build

```bash
npm install --legacy-peer-deps
npm run build
npm run serve
```

`npm run build` sets `CI=false` so webpack warnings from upstream deps do not fail the build (see `package.json`).

## Railway / Nixpacks

This repo includes `nixpacks.toml` (Node 22, `legacy-peer-deps`, `npm run build`, `npm run serve`). Set the same `REACT_APP_*` variables in the Railway service **Variables** tab, then redeploy so the new values are compiled into the bundle.

## Wallet modes at a glance

- **Both:** Best for demos — users choose Dynamic or Nautilus from the header menu; `/dynamic` exposes the passkey vault + Dynamic widget.
- **Dynamic-only:** Stricter — no silent “Nautilus already open” address; good when you only want Dynamic-gated sessions.
- **Nautilus-only:** Extension-first release — no Dynamic dashboard route; users connect with Nautilus only.

## Further reading

- `.env.example` — copy-paste template for env keys.
- `src/lib/appEnv.ts` — source of truth for parsing `REACT_APP_WALLET_PROVIDERS` and related flags.
