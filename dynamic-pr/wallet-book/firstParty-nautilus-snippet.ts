/**
 * SNIPPET — NOT meant to compile in this repo.
 *
 * This is the entry to add to `firstPartyWalletsData` inside
 * `packages/wallet-book/src/build/sources/firstParty/index.ts` of
 * Dynamic Labs' (currently closed-source) wallet-book package, per
 * the contribution guide on the @dynamic-labs/wallet-book npm
 * README:
 *
 *   https://www.npmjs.com/package/@dynamic-labs/wallet-book
 *
 * The connector key (`nautilusergo`) matches the `NAUTILUS_KEY` exported
 * from `@dynamic-labs-connectors/nautilus-ergo`. Because Nautilus is
 * not in `walletconnect.json`, no inheritance applies and we declare
 * everything inline.
 */
export const nautilusergo = {
  brand: {
    alt: 'Nautilus Wallet',
    primaryColor: '#FF6B00',
    spriteId: 'nautilusergo',
  },
  desktop: {
    chromeId: 'gjlmehlldlphhljhpnlddaodbjjcchai',
  },
  name: 'Nautilus',
  shortName: 'Nautilus',
  injectedConfig: [
    {
      // Ergo isn't yet a first-class chain on Dynamic — submit
      // alongside an SDK-side change that adds 'ERGO' to the Chain
      // enum, OR temporarily set chain to 'EVM' to satisfy the chain
      // filter (matches the connector package's `supportedChains`).
      chain: 'ERGO',
      extensionLocators: [
        // window.ergoConnector.nautilus is what nautilus injects.
        // The locator format below mirrors how other extension
        // wallets are registered — adjust to whatever locator schema
        // wallet-book ends up using for window.ergoConnector.<name>.
        { flag: 'ergoConnector.nautilus', value: true },
      ],
      windowLocations: ['ergoConnector.nautilus'],
    },
  ],
};
