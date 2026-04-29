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
integration that lets users:

**(A) Sign in with email** and get a Dynamic-derived Ergo wallet, or
**(B) Connect an existing Nautilus wallet** over EIP-12.

### Email → Ergo flow

Because Ergo uses secp256k1 (the same curve as Ethereum), we use Dynamic's
EVM embedded wallet as the signing root and derive an Ergo identity from
it. The full flow lives in [`src/lib/ergoFromDynamic.ts`](src/lib/ergoFromDynamic.ts):

1. The user signs in with email through `<DynamicWidget />`. Dynamic
   provisions an embedded EVM wallet for the account.
2. We call `primaryWallet.signMessage("Derive Ergo address v1")` to get
   an EIP-191 personal-signed signature.
3. `viem`'s `recoverPublicKey` recovers the **uncompressed** secp256k1
   public key from the signature.
4. We compress that key to its 33-byte SEC1 form (`0x02`/`0x03` prefix
   + X coordinate).
5. `ergo-lib-wasm-browser`'s `Address.from_public_key(...)` builds a
   P2PK mainnet address. We render its base58 string in the UI.

The address derivation is deterministic — signing the same message
always produces the same compressed public key, which always maps to
the same Ergo P2PK address. Users can receive ERG and tokens at the
derived address immediately.

### ⚠️ Caveat: signing transactions

Ergo P2PK proofs are **Schnorr-style sigma protocol** proofs, not raw
secp256k1 ECDSA signatures over the sighash. Dynamic's EVM embedded
wallet only exposes ECDSA signing primitives (`signMessage`,
`signRawMessage`), so a faithful Tier 3 implementation cannot simply
"ECDSA-sign the digest and slot the bytes in as the proof".

`signErgoTx` in `src/lib/ergoFromDynamic.ts` follows the structure
described in the Dynamic Tier 3 docs (compute digest → `signRawMessage`
→ attach as proof) so the UI flow is wired end-to-end, but the
resulting transaction will **not** validate on Ergo mainnet. The
broadcast step in the UI is therefore expected to be rejected by the
network until one of the following is in place:

- a server-side Schnorr signer that holds the same secret derived from
  the Dynamic embedded wallet, or
- a [Custom Wallet Connector](https://docs.dynamic.xyz/wallets/advanced-wallets/custom-wallets)
  fork of `@dynamic-labs/wallet-connectors` that implements Ergo's
  proof format directly (tracked as a follow-up).

Until then, **broadcasting transactions should use Nautilus**.

### Nautilus flow

`src/components/NautilusButton.tsx` detects `window.ergoConnector.nautilus`,
calls `connect()`, and uses the EIP-12 dApp protocol directly (so it
sidesteps Dynamic entirely). This path is fully functional today.

A Dynamic-native Nautilus connector would require forking
`@dynamic-labs/wallet-connectors` and implementing a Custom Wallet
Connector that bridges Dynamic's `WalletConnector` interface to
Nautilus's EIP-12 surface. That is intentionally left as a follow-up.

### Files added by the Dynamic integration

| File                                  | Purpose                                                                 |
|---------------------------------------|-------------------------------------------------------------------------|
| `src/lib/DynamicProvider.tsx`         | Wraps the app in `DynamicContextProvider` with `EthereumWalletConnectors`. |
| `src/lib/ergoFromDynamic.ts`          | `deriveErgoAddress` + `signErgoTx` (Tier 3 helpers).                    |
| `src/components/ErgoWallet.tsx`       | UI for the email → Ergo flow (widget, balance, send form).              |
| `src/components/NautilusButton.tsx`   | Direct EIP-12 Nautilus connect button.                                  |
| `craco.config.js`                     | WASM + Node polyfill webpack overrides for CRA.                         |
| `.env.example`                        | `REACT_APP_DYNAMIC_ENV_ID` / `NEXT_PUBLIC_DYNAMIC_ENV_ID`.              |

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