# nautilus-ergo

[Nautilus](https://nautiluswallet.com) is the most widely-used browser wallet
for [Ergo](https://ergoplatform.org). It implements
[EIP-12](https://github.com/ergoplatform/eips/pull/23) (the Ergo dApp / wallet
web bridge): `window.ergoConnector.nautilus` for the connection lifecycle,
`window.ergo` for signing once a session is open.

This package exposes Nautilus as a custom Dynamic SDK connector so the
`<DynamicWidget />` lists it alongside Dynamic's first-party wallets whenever
the extension is installed.

## Integrating with the Dynamic SDK

### Install the connector

Install with the version that matches your Dynamic SDK major (`@4` here for
SDK v4):

```
npm install @dynamic-labs-connectors/nautilus-ergo@4
```

### Use the connector

Pass `NautilusErgoWalletConnectors` to the `walletConnectors` prop of the
`DynamicContextProvider`. Combine it with your other connectors as usual:

```tsx
import { DynamicContextProvider, DynamicWidget } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';
import { NautilusErgoWalletConnectors } from '@dynamic-labs-connectors/nautilus-ergo';

const App = () => {
  return (
    <DynamicContextProvider
      settings={{
        environmentId: 'REPLACE-WITH-YOUR-ENVIRONMENT-ID',
        walletConnectors: [
          EthereumWalletConnectors,
          NautilusErgoWalletConnectors,
        ],
      }}
    >
      <DynamicWidget />
    </DynamicContextProvider>
  );
};
```

### Discriminating the active wallet

Because Ergo is currently a [Tier 3 chain](https://docs.dynamic.xyz/overview/wallets-and-chains/tier-3-chains)
on Dynamic, the public `Chain` enum has no `ERGO` value. The connector
therefore claims `'EVM'` as `supportedChains` so the SDK's chain filter
accepts it. As a side-effect, `isEthereumWallet(wallet)` from
`@dynamic-labs/ethereum` will return `true` for the Nautilus wallet object
because that helper is a chain-level check.

Always discriminate by `connector.key` instead. This package exports a
helper for exactly that:

```ts
import { isNautilusErgoWallet } from '@dynamic-labs-connectors/nautilus-ergo';

if (isNautilusErgoWallet(primaryWallet)) {
  // sign with window.ergo (EIP-12), not viem
}
```

When upstream Dynamic adds an `ERGO` value to the public `Chain` enum,
the two `'EVM'` references in `NautilusErgoWalletConnector.ts` become a
single `'ERGO'` and the side-effect above goes away.

## Building

Run `nx build @dynamic-labs-connectors/nautilus-ergo` to build the library.

## Running unit tests

Run `nx test @dynamic-labs-connectors/nautilus-ergo` to execute the unit
tests via [Jest](https://jestjs.io).
