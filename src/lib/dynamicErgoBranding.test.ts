import {
  applyErgoBrandingToEvmNetworks,
  ergoMarkPath,
} from "@ergnomes/ergo-dapp-kit/branding";

describe("applyErgoBrandingToEvmNetworks", () => {
  const base = {
    name: "Ethereum Mainnet",
    shortName: "eth",
    chain: "EVM",
    chainId: 1,
    networkId: "1",
    iconUrls: ["https://example.com/eth.png"],
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: [],
    blockExplorerUrls: [],
  };

  const emptyPublicUrl = "";

  it("prefixes mainnet with Ergo vanity and mark", () => {
    const [out] = applyErgoBrandingToEvmNetworks([base as any], emptyPublicUrl);
    expect(out.vanityName).toBe("Ergo mainnet (passkey signer)");
    expect(out.iconUrls[0]).toBe(ergoMarkPath(emptyPublicUrl));
    expect(out.iconUrls[1]).toBe("https://example.com/eth.png");
  });

  it("handles Sepolia", () => {
    const [out] = applyErgoBrandingToEvmNetworks(
      [{ ...base, chainId: 11155111, networkId: "11155111" } as any],
      emptyPublicUrl
    );
    expect(out.vanityName).toBe("Ergo testnet (passkey signer)");
    expect(out.iconUrls[0]).toBe(ergoMarkPath(emptyPublicUrl));
  });

  it("leaves other chain ids unchanged", () => {
    const [out] = applyErgoBrandingToEvmNetworks(
      [{ ...base, chainId: 137, networkId: "137" } as any],
      emptyPublicUrl
    );
    expect(out.vanityName).toBeUndefined();
    expect(out.iconUrls).toEqual(["https://example.com/eth.png"]);
  });
});
