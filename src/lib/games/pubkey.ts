/**
 * Extract the 33-byte compressed secp256k1 public key (hex) from an
 * Ergo P2PK mainnet address.
 *
 * Used by the game flow to populate register R5 / R6 when building
 * transactions.
 */

let wasmPromise: Promise<typeof import("ergo-lib-wasm-browser")> | null = null;
const loadWasm = () => {
  if (!wasmPromise) wasmPromise = import("ergo-lib-wasm-browser");
  return wasmPromise;
};

const bytesToHex = (u: Uint8Array): string => {
  let s = "";
  for (let i = 0; i < u.length; i++) s += u[i].toString(16).padStart(2, "0");
  return s;
};

export const pubKeyHexFromAddress = async (address: string): Promise<string> => {
  const wasm = await loadWasm();
  const addr = wasm.Address.from_mainnet_str(address);
  try {
    // For P2PK addresses, content_bytes() IS the serialized compressed
    // pubkey (33 bytes).
    const content = addr.content_bytes();
    if (content.length !== 33) {
      throw new Error(
        `Expected 33-byte P2PK content_bytes, got ${content.length}. Is this a P2PK address?`
      );
    }
    return bytesToHex(content);
  } finally {
    addr.free();
  }
};
