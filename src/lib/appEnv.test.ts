import { parseWalletProviderMode } from "./appEnv";

describe("parseWalletProviderMode", () => {
  it("defaults to both", () => {
    expect(parseWalletProviderMode("")).toBe("both");
    expect(parseWalletProviderMode("ALL")).toBe("both");
  });
  it("parses dynamic", () => {
    expect(parseWalletProviderMode("dynamic")).toBe("dynamic");
    expect(parseWalletProviderMode("DYNAMIC_ONLY")).toBe("dynamic");
  });
  it("parses nautilus", () => {
    expect(parseWalletProviderMode("nautilus")).toBe("nautilus");
    expect(parseWalletProviderMode("nautilus-only")).toBe("nautilus");
  });
});
