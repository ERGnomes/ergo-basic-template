/**
 * Read-only helpers for fetching wallet data from the Ergo Explorer
 * V1 API. Used by the Dynamic-bridged WalletContext to populate the
 * dashboard from any Ergo address (vault-derived OR Nautilus) without
 * depending on `window.ergo`.
 */

import { isValidJson } from "./textFormat";

const ERGO_API = "https://api.ergoplatform.com/api/v1";

export interface ExplorerBalance {
  nanoErgs: string;
  tokens: ExplorerTokenSummary[];
}

export interface ExplorerTokenSummary {
  tokenId: string;
  amount: string;
  name?: string;
  decimals?: number;
}

export interface RichToken {
  tokenId: string;
  amount: string;
  name: string;
  decimals: number;
  description: string;
  imageUrl: string;
  collection?: string;
}

const toUtf8String = (hexString: string): string => {
  if (!hexString) return "";
  let str = "";
  for (let i = 0; i < hexString.length; i += 2) {
    str += String.fromCharCode(parseInt(hexString.substr(i, 2), 16));
  }
  return str;
};

const resolveIpfs = (url: string): string => {
  const ipfsPrefix = "ipfs://";
  if (!url.startsWith(ipfsPrefix)) return url;
  return url.replace(ipfsPrefix, "https://cloudflare-ipfs.com/ipfs/");
};

/**
 * Fetch the confirmed balance for an Ergo address.
 */
export const fetchAddressBalance = async (
  address: string
): Promise<ExplorerBalance | null> => {
  try {
    const res = await fetch(
      `${ERGO_API}/addresses/${encodeURIComponent(address)}/balance/total`
    );
    if (!res.ok) return null;
    const json = await res.json();
    const confirmed = json?.confirmed ?? json;
    return {
      nanoErgs: String(confirmed?.nanoErgs ?? "0"),
      tokens: (confirmed?.tokens || []).map((t: any) => ({
        tokenId: t.tokenId,
        amount: String(t.amount),
        name: t.name,
        decimals: t.decimals,
      })),
    };
  } catch {
    return null;
  }
};

/**
 * Format nanoErgs as a 4-decimal ERG string, matching the dashboard's
 * existing display style.
 */
export const formatErgFromNano = (nano: string | number): string => {
  const n = typeof nano === "string" ? Number(nano) : nano;
  return (n / 1_000_000_000).toFixed(4);
};

/**
 * Enrich a list of bare token summaries with metadata fetched from
 * Explorer's per-token endpoint (and, for items with amount=1, from
 * the issuing-box registers so NFT images surface).
 */
export const enrichTokens = async (
  tokens: ExplorerTokenSummary[]
): Promise<RichToken[]> => {
  if (tokens.length === 0) return [];

  const enriched = await Promise.all(
    tokens.map(async (t): Promise<RichToken> => {
      const base: RichToken = {
        tokenId: t.tokenId,
        amount: t.amount,
        name: t.name || "Unknown Token",
        decimals: t.decimals ?? 0,
        description: "",
        imageUrl: "",
      };
      try {
        const tokenInfoRes = await fetch(`${ERGO_API}/tokens/${t.tokenId}`);
        if (tokenInfoRes.ok) {
          const info = await tokenInfoRes.json();
          base.name = info.name || base.name;
          base.decimals = info.decimals ?? base.decimals;
          base.description = info.description || "";
        }
      } catch {
        // Non-fatal — fall through with base token shape.
      }

      if (t.amount === "1") {
        try {
          const issuingRes = await fetch(
            `https://api.ergoplatform.com/api/v0/assets/${t.tokenId}/issuingBox`
          );
          if (issuingRes.ok) {
            const issuing = await issuingRes.json();
            const box = issuing?.[0];
            const regs = box?.additionalRegisters || {};

            if (regs.R9) {
              const url = toUtf8String(regs.R9).substr(2);
              base.imageUrl = resolveIpfs(url);
            }
            if (regs.R5) {
              try {
                const meta = toUtf8String(regs.R5).substr(2);
                if (isValidJson(meta)) {
                  const parsed = JSON.parse(meta);
                  if (parsed.name) base.name = parsed.name;
                  if (parsed.description) base.description = parsed.description;
                  if (parsed.collection) base.collection = parsed.collection;
                }
              } catch {
                // ignore
              }
            }
          }
        } catch {
          // ignore — NFT metadata is optional
        }
      }

      return base;
    })
  );

  return enriched;
};
