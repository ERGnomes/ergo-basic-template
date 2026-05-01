/**
 * Explorer GraphQL client — avoids huge GET URLs for `byErgoTree` (super TTT
 * ErgoTree hex is ~7.6k chars; browsers/proxies reject the REST path).
 *
 * Endpoint: https://gql.ergoplatform.com/
 */

const GQL_URL = "https://gql.ergoplatform.com/";

export interface GqlExplorerBoxLike {
  boxId: string;
  value: number | string;
  ergoTree?: string;
  additionalRegisters?: Record<string, any>;
  spentTransactionId?: string | null;
  settlementHeight?: number;
  transactionId?: string;
}

export interface GqlBoxRow {
  boxId: string;
  value: string;
  settlementHeight: number | null;
  spentBy: { transactionId: string } | null;
  additionalRegisters: Record<string, unknown> | null;
}

const gql = async <T>(query: string, variables: Record<string, unknown>): Promise<T> => {
  const res = await fetch(GQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`Explorer GraphQL HTTP ${res.status}`);
  }
  const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors && body.errors.length > 0) {
    throw new Error(body.errors.map((e) => e.message).join("; "));
  }
  if (!body.data) {
    throw new Error("Explorer GraphQL returned no data");
  }
  return body.data;
};

/**
 * Map GraphQL register values (hex strings) to Explorer REST-style register
 * objects so existing `decode(serializedValue)` helpers keep working.
 */
export const gqlRegistersToExplorerShape = (
  regs: Record<string, unknown> | null | undefined
): Record<string, { serializedValue: string }> => {
  const out: Record<string, { serializedValue: string }> = {};
  if (!regs || typeof regs !== "object") return out;
  for (const [k, v] of Object.entries(regs)) {
    if (typeof v === "string") {
      out[k] = { serializedValue: v };
    }
  }
  return out;
};

export const gqlBoxToExplorerLike = (b: GqlBoxRow): GqlExplorerBoxLike => ({
  boxId: b.boxId,
  value: b.value,
  spentTransactionId: b.spentBy?.transactionId ?? null,
  settlementHeight: typeof b.settlementHeight === "number" ? b.settlementHeight : undefined,
  additionalRegisters: gqlRegistersToExplorerShape(b.additionalRegisters || undefined),
});

const BOX_FIELDS = `
  boxId
  value
  settlementHeight
  spentBy { transactionId }
  additionalRegisters
`;

/**
 * @param spent - true: only spent; false: only unspent; omit for all (GraphQL null)
 */
export const fetchBoxesByErgoTreeGql = async (
  ergoTreeHex: string,
  opts: { spent?: boolean; take?: number; skip?: number } = {}
): Promise<GqlBoxRow[]> => {
  const take = opts.take ?? 100;
  const skip = opts.skip ?? 0;
  const spent = opts.spent;

  const data = await gql<{ boxes: GqlBoxRow[] }>(
    `
    query BoxesByTree($tree: String!, $spent: Boolean, $take: Int!, $skip: Int!) {
      boxes(ergoTree: $tree, spent: $spent, take: $take, skip: $skip) {
        ${BOX_FIELDS}
      }
    }
  `,
    { tree: ergoTreeHex, spent: spent ?? null, take, skip }
  );
  return data.boxes || [];
};
