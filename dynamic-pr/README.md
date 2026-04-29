# Dynamic.xyz upstream contributions for Nautilus

This folder contains everything we need to push **upstream** so that the
Nautilus / Ergo wallet shows up in `<DynamicWidget />` for every Dynamic
customer (and anyone else who installs the connector package), instead of
being a custom in-app workaround like our `src/lib/NautilusConnector.ts`.

The work splits into two upstream PRs.

## 1. `dynamic-labs-oss/public-wallet-connectors` — new connector package

Repo: <https://github.com/dynamic-labs-oss/public-wallet-connectors>
Contribution guide: [`CONTRIBUTING.md`](https://github.com/dynamic-labs-oss/public-wallet-connectors/blob/main/CONTRIBUTING.md)

This is the public, MIT-licensed monorepo that ships extra wallet connectors
for the Dynamic SDK (Safe, Intersend, Sequence, Abstract, Xverse / Starknet,
Tap / Bitcoin, etc.). It explicitly accepts community PRs for new wallet
connectors; the maintainers merge and then publish under the
`@dynamic-labs-connectors/<name>` npm scope.

The directory `public-wallet-connectors/packages/@dynamic-labs-connectors/nautilus-ergo/`
in this folder is a **drop-in** package laid out exactly the way the
existing connector packages are (same `package.json` shape, same
`project.json`, same `.swcrc`, same `tsconfig.{json,lib,spec}`, same
`eslint.config.cjs`, same `jest.config.ts`, same `README.md` shape).

### How to submit it

```sh
git clone https://github.com/dynamic-labs-oss/public-wallet-connectors.git
cd public-wallet-connectors

# Drop the package in
cp -R /path/to/this/repo/dynamic-pr/public-wallet-connectors/packages/@dynamic-labs-connectors/nautilus-ergo \
  packages/@dynamic-labs-connectors/

# Add the package path to the root tsconfig.base.json `compilerOptions.paths`
#   "@dynamic-labs-connectors/nautilus-ergo": [
#     "packages/@dynamic-labs-connectors/nautilus-ergo/src/index.ts"
#   ]

# Verify
pnpm install
pnpm nx build @dynamic-labs-connectors/nautilus-ergo
pnpm nx test  @dynamic-labs-connectors/nautilus-ergo

# Open the PR
git checkout -b feat/nautilus-ergo-connector
git add packages/@dynamic-labs-connectors/nautilus-ergo tsconfig.base.json
git commit -m "feat(nautilus-ergo): add Nautilus / Ergo EIP-12 connector"
git push -u origin feat/nautilus-ergo-connector
gh pr create --fill
```

### What the package contains

| File | Purpose |
|------|---------|
| `src/NautilusErgoWalletConnector.ts` | The connector — extends `WalletConnectorBase`, talks to `window.ergoConnector.nautilus` and `window.ergo` (EIP-12). |
| `src/index.ts` | `NautilusErgoWalletConnectors` factory + `isNautilusErgoWallet` runtime type-guard + re-exports. |
| `src/NautilusErgoWalletConnector.spec.ts` | Unit tests for every overridden method (install detection, connect, get/sign/auth, endSession, network metadata, filter). |
| `src/index.spec.ts` | Tests for the factory + the type guard. |
| `package.json` | `@dynamic-labs-connectors/nautilus-ergo` v4.6.4, peer-deps `@dynamic-labs/wallet-connector-core` ^4.20.1. |
| `project.json`, `tsconfig*.json`, `.swcrc`, `jest.config.ts`, `eslint.config.cjs` | Same shape as `safe-evm` / `xverse-starknet` so nx, swc, jest and eslint pick it up automatically. |
| `README.md` | Install + usage docs in the same shape as the other connector packages. |

### Why we extend `WalletConnectorBase` and not `EthereumInjectedConnector`

The dedicated base classes (`EthereumWalletConnector`,
`SolanaWalletConnector`, `BitcoinWalletConnector`, `StarknetWalletConnector`,
…) are tied to chain-specific signing pipelines — viem for EVM,
solana-web3.js for Solana, etc. Ergo's signing model is closer to
[CIP-30](https://cips.cardano.org/cips/cip30/) than to anything Dynamic
already has a base for, so the base class isn't a fit.

`WalletConnectorBase` is the right abstraction: it lets us implement the
required surface (`connect`, `getAddress`, `signMessage`, `proveOwnership`,
`endSession`, …) directly on top of EIP-12, the way Nautilus actually
exposes itself.

The single Ergo-shaped wart is the `supportedChains: ['EVM']` workaround,
documented in both the connector source and the README. When (2) below
lands upstream we change those two strings to `'ERGO'` and the wart is
gone.

## 2. Dynamic SDK core — add `ERGO` to the public `Chain` enum (separate ask)

The closed-source `@dynamic-labs/wallet-connector-core` package exports a
`Chain` enum that's currently `'EVM' | 'SOL' | 'STARK' | 'FLOW' | …` —
no `'ERGO'`. Dynamic's
[Tier 3 chains doc](https://docs.dynamic.xyz/overview/wallets-and-chains/tier-3-chains)
explicitly invites partners to push for promotion to tiers 1/2.

Until Dynamic adds `'ERGO'` to the enum, every Ergo connector will need
to claim `'EVM'` to satisfy the chain filter (which is what we do in (1)).

When you talk to Dynamic about merging the connector PR, mention this
follow-up. It's not blocking — the connector ships and works today.

## 3. wallet-book — register Nautilus icon / metadata

The `@dynamic-labs/wallet-book` package
([README](https://www.npmjs.com/package/@dynamic-labs/wallet-book)) is the
catalog of every wallet the widget knows how to render: it's where
icons, names, brand colours, chrome / firefox extension IDs, and injected
detection rules are listed. Its source isn't on GitHub — the package
README says "make any changes that you need" and points at internal paths,
so the change has to go through Dynamic directly.

The file `wallet-book/firstParty-nautilus-snippet.ts` is the entry to
hand them. The shape mirrors the example in their README. The connector
key matches `NAUTILUS_KEY` (`nautilusergo`) exported from (1).

If wallet-book gets the entry, the connector picks up its proper icon
and brand colour automatically. Without it, the connector still works —
it just falls back to the inline data-URI SVG icon defined in the
connector source.
