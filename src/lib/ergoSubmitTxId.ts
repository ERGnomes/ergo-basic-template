/**
 * Explorer `POST /mempool/transactions/submit` may return the new tx id as
 * plain text, JSON (`{"id":"..."}`), or other shapes depending on gateway.
 * We always know the canonical id from the signed tx locally — use that as
 * fallback so callers never lose track of a successful broadcast.
 */
export const parseTxIdFromSubmitResponse = (
  responseText: string,
  fallbackTxId: string | undefined
): string | undefined => {
  const trimmed = (responseText || "").trim();
  if (!trimmed) return fallbackTxId;

  if (/^[a-fA-F0-9]{64}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const j = JSON.parse(trimmed) as Record<string, unknown>;
    const id = j.id ?? j.txId ?? j.transactionId;
    if (typeof id === "string" && /^[a-fA-F0-9]{64}$/.test(id)) {
      return id;
    }
  } catch {
    // not JSON
  }

  const m = trimmed.match(/\b([a-fA-F0-9]{64})\b/);
  if (m) return m[1];

  return fallbackTxId;
};
