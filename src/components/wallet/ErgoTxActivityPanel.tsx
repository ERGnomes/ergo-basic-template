import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Box,
  Button,
  Code,
  Divider,
  Heading,
  HStack,
  Link,
  Spinner,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorMode,
} from "@chakra-ui/react";
import {
  ErgoTxActivityEntry,
  clearErgoTxActivity,
  getErgoTxActivity,
  removeErgoTxActivity,
  subscribeErgoTxActivity,
} from "../../lib/ergoTxActivity";

const ERGO_API = "https://api.ergoplatform.com/api/v1";
const EXPLORER_TX = "https://explorer.ergoplatform.com/en/transactions/";

type RowStatus = "loading" | "mempool" | "confirmed" | "unknown" | "error";

interface RowState {
  status: RowStatus;
  confirmations?: number;
  error?: string;
}

const formatAge = (submittedAt: number): string => {
  const s = Math.max(0, Math.floor((Date.now() - submittedAt) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
};

export const ErgoTxActivityPanel: React.FC<{ ergoAddress: string | null }> = ({
  ergoAddress,
}) => {
  const { colorMode } = useColorMode();
  const [entries, setEntries] = useState<ErgoTxActivityEntry[]>(() =>
    getErgoTxActivity()
  );
  const [txState, setTxState] = useState<Record<string, RowState>>({});

  useEffect(() => {
    const unsub = subscribeErgoTxActivity(() =>
      setEntries(getErgoTxActivity())
    );
    return unsub;
  }, []);

  const refreshOne = useCallback(async (txId: string) => {
    setTxState((prev) => ({
      ...prev,
      [txId]: { status: "loading" },
    }));
    try {
      const res = await fetch(
        `${ERGO_API}/transactions/${encodeURIComponent(txId)}`
      );
      if (res.status === 404) {
        setTxState((prev) => ({
          ...prev,
          [txId]: { status: "mempool" },
        }));
        return;
      }
      if (!res.ok) {
        setTxState((prev) => ({
          ...prev,
          [txId]: {
            status: "error",
            error: `HTTP ${res.status}`,
          },
        }));
        return;
      }
      const body = (await res.json()) as { numConfirmations?: number };
      const n = body?.numConfirmations;
      if (typeof n === "number" && n >= 0) {
        setTxState((prev) => ({
          ...prev,
          [txId]: { status: "confirmed", confirmations: n },
        }));
      } else {
        setTxState((prev) => ({
          ...prev,
          [txId]: { status: "unknown" },
        }));
      }
    } catch (e: any) {
      setTxState((prev) => ({
        ...prev,
        [txId]: {
          status: "error",
          error: e?.message || String(e),
        },
      }));
    }
  }, []);

  useEffect(() => {
    if (entries.length === 0) return;
    let cancelled = false;
    const run = async () => {
      for (const e of entries) {
        if (cancelled) return;
        await refreshOne(e.txId);
      }
    };
    run();
    const iv = setInterval(() => {
      if (!cancelled) {
        entries.forEach((e) => {
          void refreshOne(e.txId);
        });
      }
    }, 12_000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [entries, refreshOne]);

  const statusBadge = useCallback((txId: string) => {
    const s = txState[txId];
    if (!s || s.status === "loading") {
      return (
        <HStack spacing={1}>
          <Spinner size="xs" />
          <Text fontSize="xs">checking…</Text>
        </HStack>
      );
    }
    if (s.status === "mempool") {
      return (
        <Badge colorScheme="orange" fontSize="0.65rem">
          mempool / unconfirmed
        </Badge>
      );
    }
    if (s.status === "confirmed") {
      return (
        <Badge colorScheme="green" fontSize="0.65rem">
          confirmed ({s.confirmations ?? 0}+)
        </Badge>
      );
    }
    if (s.status === "error") {
      return (
        <Badge colorScheme="red" fontSize="0.65rem">
          {s.error?.slice(0, 24) || "error"}
        </Badge>
      );
    }
    return (
      <Badge colorScheme="gray" fontSize="0.65rem">
        unknown
      </Badge>
    );
  }, [txState]);

  const border =
    colorMode === "light" ? "gray.200" : "whiteAlpha.300";

  if (!ergoAddress) return null;

  return (
    <Box
      borderWidth="1px"
      borderRadius="md"
      p={4}
      borderColor={border}
    >
      <Stack spacing={3}>
        <HStack justify="space-between" align="flex-start">
          <Box>
            <Heading size="sm">Ergo transaction activity</Heading>
            <Text fontSize="xs" opacity={0.75} mt={1}>
              Successful broadcasts from this page (vault sign-and-submit or
              Nautilus EIP-12). Each row polls the public Explorer:{" "}
              <strong>404</strong> on <Code fontSize="xs">/transactions/{"{id}"}</Code>{" "}
              usually means the tx is still in the mempool. Nautilus also keeps
              its own history inside the extension.
            </Text>
          </Box>
          {entries.length > 0 && (
            <Button
              size="xs"
              variant="ghost"
              colorScheme="red"
              onClick={() => clearErgoTxActivity()}
            >
              Clear list
            </Button>
          )}
        </HStack>

        {entries.length === 0 ? (
          <Alert status="info" borderRadius="md" variant="subtle">
            <AlertIcon />
            <AlertDescription fontSize="sm">
              No recorded txs yet. After you send ERG from the vault or submit
              a game move, successful broadcasts appear here with a mempool /
              confirmed status.
            </AlertDescription>
          </Alert>
        ) : (
          <Table size="sm" variant="simple">
            <Thead>
              <Tr>
                <Th px={1}>When</Th>
                <Th px={1}>What</Th>
                <Th px={1}>Status</Th>
                <Th px={1} isNumeric>
                  Links
                </Th>
              </Tr>
            </Thead>
            <Tbody>
              {entries.map((e) => (
                <Tr key={e.txId}>
                  <Td px={1} verticalAlign="top" whiteSpace="nowrap">
                    <Text fontSize="xs">{formatAge(e.submittedAt)}</Text>
                  </Td>
                  <Td px={1} verticalAlign="top">
                    <Text fontSize="xs">{e.label}</Text>
                    <Code fontSize="10px" wordBreak="break-all" display="block" mt={1}>
                      {e.txId}
                    </Code>
                  </Td>
                  <Td px={1} verticalAlign="top">
                    {statusBadge(e.txId)}
                  </Td>
                  <Td px={1} verticalAlign="top" textAlign="right">
                    <Stack spacing={1} align="flex-end">
                      <Link
                        href={`${EXPLORER_TX}${e.txId}`}
                        isExternal
                        fontSize="xs"
                      >
                        Explorer
                      </Link>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => removeErgoTxActivity(e.txId)}
                      >
                        Remove
                      </Button>
                    </Stack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}

        <Divider />
        <Text fontSize="xs" opacity={0.65}>
          Vault address (for your reference):{" "}
          <Code fontSize="xs">{ergoAddress}</Code>
        </Text>
      </Stack>
    </Box>
  );
};
