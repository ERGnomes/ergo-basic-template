# Ergo Basic Template

A modular React template for building applications on the Ergo blockchain. This template provides a structured foundation with reusable components for wallet connection, token display, and a beautiful dashboard interface.

## 📱 Application Preview

### Landing Page
![Landing Page](public/Screenshot%201.png)
*Clean landing page with wallet connection prompt*

### Wallet Dashboard
![Wallet Dashboard](public/Screenshot%202.png)
*Dashboard showing wallet overview and NFT collection*

### NFT Gallery
![NFT Gallery](public/Screenshot%203.png)
*Dedicated NFT gallery with detailed token information*

### NFT Details
![NFT Details](public/Screenshot%204.png)
*Modal view showing detailed NFT traits and metadata*

## ✨ Features

- **Modular Component Structure**: Components are organized by function for easy reuse
- **Nautilus Wallet Integration**: Connect to the Ergo blockchain using Nautilus wallet
- **Complete Wallet Dashboard**: View your ERG balance and all tokens in a beautiful interface
- **NFT Gallery**: Dedicated page for viewing and managing your NFT collection
- **Metadata Display**: Beautiful rendering of NFT traits and metadata
- **Reusable Utilities**: Common functions for working with ERG, tokens, and wallet interaction
- **Responsive UI**: Built with Chakra UI for a beautiful, responsive experience
- **Type Safety**: Written in TypeScript for improved developer experience
- **Theme Customization**: Easily configurable theme with Ergo-inspired styling
- **Animations & Transitions**: Smooth animations for a modern user experience

## 🚀 Getting Started

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/ergo-basic-template.git
   cd ergo-basic-template
   ```

2. Install dependencies:
   ```
   npm install --legacy-peer-deps
   ```

3. Configure Dynamic.xyz (optional, only required for the email login flow):
   ```
   cp .env.example .env
   # then edit .env and set REACT_APP_DYNAMIC_ENV_ID to your Dynamic env id
   ```

4. Start the development server:
   ```
   npm start
   ```

5. Build for production:
   ```
   npm run build
   ```

6. Serve the production build locally:
   ```
   npm run serve
   ```

> The build is wired through [CRACO](https://craco.js.org/) (`craco.config.js`)
> so we can enable webpack 5's `asyncWebAssembly` experiment for
> `ergo-lib-wasm-browser` and inject Node-style polyfills for the Dynamic
> SDK's transitive dependencies. If you eject from CRA you'll need to
> port that configuration manually.

## 🔐 Dynamic.xyz authentication (Tier 3 architecture)

Ergo is a [Tier 3 chain on Dynamic](https://docs.dynamic.xyz/overview/wallets-and-chains/tier-3-chains)
— there is no native Ergo connector. This template ships a Tier 3
integration with two paths:

- **(A) Sign in with email** → get a self-custodial Ergo wallet whose
  private key is generated locally, encrypted with a hardware-backed
  passkey (WebAuthn PRF), and mirrored encrypted into your Dynamic
  user metadata so it survives across devices.
- **(B) Connect an existing Nautilus wallet** over EIP-12.

### Email → Ergo flow (Option B+ in the security analysis)

This is the production flow. Dynamic is used **only** for identity,
session, and encrypted-blob storage — it never sees the Ergo private
key in any form.

1. User signs in via `<DynamicWidget />`. Dynamic provisions an embedded
   EVM wallet for the account, but we ignore that wallet's signing
   capabilities entirely.
2. **First time on this account:** we generate a fresh 32-byte Ergo
   secret with `crypto.getRandomValues`, register a platform passkey
   for the current origin (with the WebAuthn PRF extension), derive an
   AES-GCM-256 key from `HKDF(prfOutput)`, and double-encrypt the
   secret:
   - once with that passkey-derived AES key
   - once with `PBKDF2(recoveryPhrase, 250_000)` over a fresh BIP-39
     24-word phrase shown to the user **exactly once**
   The resulting `{ ciphertext, iv, salt, passkeyCredId }` blob is
   saved to `localStorage` and mirrored to Dynamic user metadata via
   `updateUser({ metadata: { ergoVaultV1: ... } })`.
3. **Every subsequent unlock / sign:** `navigator.credentials.get()`
   triggers a biometric / device-PIN prompt. The PRF output decrypts
   the Ergo secret in memory, sigma-rust signs the transaction, the
   secret is wiped (`Uint8Array.fill(0)`) immediately afterward.
4. **Cross-device recovery:** sign in to Dynamic on the new device →
   if the device has the synced passkey (iCloud Keychain / Google
   Password Manager), unlock works immediately. Otherwise, paste the
   24-word recovery phrase, and we automatically register a fresh
   passkey on the new device while we have the secret in memory.

#### Why this is more secure than "derive seed from signMessage"

| Threat                | "Seed from signMessage"               | This template (passkey + recovery)  |
|-----------------------|----------------------------------------|--------------------------------------|
| Phishing              | Any dapp that gets you to sign that one string steals the seed forever | WebAuthn credentials are origin-bound by the browser; cross-site sites cannot use them |
| Insider at Dynamic    | Can replay your sigMessage, re-derive the seed | Has only your encrypted blob; lacks passkey + recovery phrase |
| XSS in this app       | Can compute the seed on demand        | Can request decryption but biometric prompt gates each operation |
| Lost device           | Email recovery works                   | Synced passkey OR recovery phrase    |
| Server breach         | N/A                                    | N/A — no server holds keys           |

#### File map

| File                                | Purpose                                                                        |
|-------------------------------------|--------------------------------------------------------------------------------|
| `src/lib/DynamicProvider.tsx`       | Wraps the app in `DynamicContextProvider` with `EthereumWalletConnectors`.     |
| `src/lib/passkey.ts`                | WebAuthn PRF helpers (`registerPasskey`, `evaluatePrf`, `aesGcm{En,De}crypt`). |
| `src/lib/ergoKeyVault.ts`           | `provisionVault`, `unlockWithPasskey`, `unlockWithRecoveryPhrase`, `attachPasskey`. |
| `src/lib/vaultStorage.ts`           | localStorage adapter + Dynamic user-metadata patch builders.                   |
| `src/lib/ergoSigning.ts`            | `sendErg(...)` — real Schnorr sign via `Wallet.from_secrets`, then submit.     |
| `src/lib/ergoFromDynamic.ts`        | Legacy Tier 3 derivation reference (`deriveErgoAddress`, `signErgoTx`).        |
| `src/components/ErgoWallet.tsx`     | UI state machine for the vault flow + Send-ERG form.                           |
| `src/components/NautilusButton.tsx` | Direct EIP-12 Nautilus connect.                                                |
| `craco.config.js`                   | WASM + Node polyfill webpack overrides for CRA.                                |
| `.env.example`                      | `REACT_APP_DYNAMIC_ENV_ID` / `NEXT_PUBLIC_DYNAMIC_ENV_ID`.                     |

### Browser support for the passkey path

WebAuthn PRF support has improved across the board:

- ✅ Chrome / Edge (desktop & Android)
- ✅ Safari 18+ (macOS Sonoma+, iOS 18+)
- ✅ Firefox (modern stable versions ship PRF; this has worked
  end-to-end in our own testing)

If a specific browser + authenticator combination ever can't do PRF,
the vault flow surfaces a clear "WebAuthn PRF extension not
supported" error at the moment of the first passkey call rather
than pre-emptively blocking you.

### Future hardening: 2-of-2 MPC

The next-tier security model would split the Ergo secret into two
shares — one client-held, one server-held — and use additive 2-party
Schnorr. Neither share alone can sign. Schnorr-on-Ergo happens to be
unusually well-suited to this (no Paillier/OT machinery needed). Out
of scope for this template, but tracked as a follow-up if you build a
real product on top.

### Nautilus inside the Dynamic widget

We ship a custom Dynamic wallet connector (`src/lib/NautilusConnector.ts`)
that registers Nautilus alongside Dynamic's built-in connectors. When
the user has the Nautilus extension installed, the `<DynamicWidget />`
shows it as a selectable wallet automatically; when they don't,
`isInstalledOnBrowser()` returns false and Dynamic hides it from the
list. There's no separate "Connect Nautilus" button to find — the
sign-in widget is unified.

When a user picks Nautilus inside the widget:

- `primaryWallet.connector.key === "nautilusergo"` becomes true.
- `ErgoWallet.tsx` skips the passkey-encrypted vault flow entirely
  (Nautilus owns its own keys natively).
- A small "Connected via Nautilus" panel renders showing the address
  and balance, and signing/broadcasting goes through `window.ergo`
  (EIP-12) directly.

#### Implementation note: claiming `EVM` as supported chain

Dynamic's `Chain` enum is hardcoded to a fixed list and does not
include `ERGO`. Our connector therefore claims `["EVM"]` as
`supportedChains` so the widget's chain filter accepts it (the user's
Dynamic project already has EVM enabled). One side-effect:
`isEthereumWallet(wallet)` will return `true` for our Nautilus wallet
object because it just checks `wallet.chain === 'EVM'`. We work
around this by discriminating on `connector.key`, not on chain — see
the runtime check in `ErgoWallet.tsx`. Downstream Ethereum-specific
code paths are never invoked because all of our consumers route
through that key check.

A standalone `<NautilusButton />` is still rendered for users who
choose to skip Dynamic entirely (e.g. quick test of the EIP-12 path
without going through email login). It uses the same `window.ergo`
API.

## 🚂 Deploying to Railway

This repo ships with a `railway.json`, a `nixpacks.toml`, and a `Procfile`,
so a fresh Railway service should detect everything automatically:

1. Create a new Railway project → **Deploy from GitHub repo** → select
   this repository (or your fork) and the branch you want to deploy.
2. Add the following environment variable on the Railway service:
   - `REACT_APP_DYNAMIC_ENV_ID` — your Dynamic environment ID.
   > CRA inlines `REACT_APP_*` values **at build time**, so it must be
   > set on the Railway service before the first build (or Redeploy
   > after adding it).
3. (Optional) leave `PORT` alone — Railway sets it for you and the
   `npm run serve` script binds to it via `serve -s build -l tcp://0.0.0.0:$PORT`.
4. Trigger a deploy. Nixpacks will run:
   ```
   npm install --legacy-peer-deps --no-audit --no-fund
   npm run build              # CI=false NODE_OPTIONS=--max-old-space-size=4096
   npm run serve              # serves ./build on $PORT
   ```
5. Once the service is up, copy its public URL (e.g.
   `https://your-app.up.railway.app`) and add it to your Dynamic
   project's allowed origins in the Dynamic dashboard
   (**Developers → CORS / Domains**). Without this, the embedded
   wallet's `signMessage` call will be blocked by Dynamic's origin
   check and the email-login flow will silently fail.

If the build OOMs on a small Railway plan, raise the heap further by
overriding the build command on the service to
`NODE_OPTIONS=--max-old-space-size=8192 npm run build`.

## 📂 Project Structure

The project is organized for maximum reusability:

- `src/components/`: Reusable UI components
  - `layout/`: Layout components like Navbar and PageLayout
  - `wallet/`: Wallet connection components and dashboard
  - `tokens/`: Token display components
- `src/utils/`: Utility functions
  - `ergo.ts`: Ergo-specific utility functions
- `src/theme.ts`: Customizable Chakra UI theme

## 🛠️ Extending the Template

This template is designed to be easily extended:

1. **Add New Pages**: Create new page components and add them to your routing
2. **Customize the Theme**: Modify `src/theme.ts` to change colors and styles
3. **Add New Components**: Follow the existing component structure in `/components`
4. **Add New Functionality**: Extend utility functions in `/utils`

## 📚 Tutorials

Check out our step-by-step tutorials to learn how to build different types of applications with this template:

- [**NFT Gallery**](docs/tutorials/01-nft-gallery.md) - Display your NFT collection
- [**NFT Marketplace**](docs/tutorials/02-nft-marketplace.md) - Buy and sell NFTs
- [**Raffle dApp**](docs/tutorials/03-raffle-contract.md) - Create raffles with prizes
- [**NFT Escrow Trading**](docs/tutorials/04-nft-escrow.md) - Trade NFTs securely

These tutorials provide detailed guidance for building real-world Ergo applications. View the [tutorial index](docs/tutorials/README.md) for more information.

## ✅ Key Components

### WalletConnector

A component for connecting to Nautilus wallet with a dropdown menu showing:
- Connection status
- ERG balance
- Preview of tokens with amounts

### WalletDashboard

A dashboard displaying:
- Wallet status and balance overview
- Complete list of tokens with details
- Connect button for non-connected state

### TokensDisplay

A grid display of tokens with:
- Token name
- Token ID (shortened)
- Token amount with proper formatting

## 📚 Resources

- [Fleet SDK Documentation](https://fleet-sdk.github.io/docs/)
- [Ergo Platform](https://ergoplatform.org/en/)
- [Nautilus Wallet](https://chromewebstore.google.com/detail/nautilus-wallet/gjlmehlldlphhljhpnlddaodbjjcchai)
- [Chakra UI Documentation](https://chakra-ui.com/docs/getting-started)

## 🙏 Credits

- Thanks to [@LADOPIXEL](https://github.com/LADOPIXEL) for inspiration
- Built with [Fleet SDK](https://github.com/fleet-sdk) for Ergo blockchain interaction

## 📄 License

MIT