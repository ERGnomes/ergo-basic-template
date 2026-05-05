import {
  parseShowDevTools,
  parseWalletProviderMode,
} from "./appEnv";

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

describe("parseShowDevTools", () => {
  it("defaults off", () => {
    expect(parseShowDevTools("")).toBe(false);
    expect(parseShowDevTools(undefined)).toBe(false);
    expect(parseShowDevTools("0")).toBe(false);
    expect(parseShowDevTools("false")).toBe(false);
    expect(parseShowDevTools("off")).toBe(false);
  });
  it("enables for common truthy strings", () => {
    expect(parseShowDevTools("1")).toBe(true);
    expect(parseShowDevTools("true")).toBe(true);
    expect(parseShowDevTools("TRUE")).toBe(true);
    expect(parseShowDevTools("on")).toBe(true);
    expect(parseShowDevTools("yes")).toBe(true);
  });
});
