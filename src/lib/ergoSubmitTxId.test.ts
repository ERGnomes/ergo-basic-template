import { parseTxIdFromSubmitResponse } from "./ergoSubmitTxId";

describe("parseTxIdFromSubmitResponse", () => {
  const hex64 = "a".repeat(64);

  it("returns plain 64-char hex", () => {
    expect(parseTxIdFromSubmitResponse(hex64, "b".repeat(64))).toBe(hex64);
  });

  it("parses JSON id field", () => {
    expect(
      parseTxIdFromSubmitResponse(JSON.stringify({ id: hex64 }), "fallback")
    ).toBe(hex64);
  });

  it("extracts hex from noisy body", () => {
    expect(
      parseTxIdFromSubmitResponse(`ok ${hex64} done`, "fallback")
    ).toBe(hex64);
  });

  it("uses fallback when body is empty", () => {
    expect(parseTxIdFromSubmitResponse("", hex64)).toBe(hex64);
  });

  it("uses fallback when body is unparseable", () => {
    expect(parseTxIdFromSubmitResponse("not-json", hex64)).toBe(hex64);
  });
});
