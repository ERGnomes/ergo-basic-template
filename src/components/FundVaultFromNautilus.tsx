import React, { useState, useCallback } from "react";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Code,
  Divider,
  Heading,
  HStack,
  Input,
  Stack,
  Text,
  Spinner,
  useToast,
} from "@chakra-ui/react";
import { buildSendErgUnsigned } from "../lib/ergoSigning";
import { signAndSubmit } from "../lib/games/signAndSubmit";
import { recordErgoTxActivity } from "../lib/ergoTxActivity";
import {
  fetchAddressBalance,
  type ExplorerTokenSummary,
} from "../utils/ergoExplorer";
import { shortenTokenId } from "../utils/ergo";

const NANOERG_PER_ERG = 1_000_000_000;

const formatErg = (nano: string) => {
  const n = BigInt(nano);
  const whole = n / BigInt(NANOERG_PER_ERG);
  const frac = n % BigInt(NANOERG_PER_ERG);
  return `${whole}.${frac.toString().padStart(9, "0").replace(/0+$/, "") || "0"}`;
};

const WALLET_TOKEN_LIST_CAP = 200;

const applyWalletTokenSelection = (t: ExplorerTokenSummary) => {
  return {
    tokenId: t.tokenId,
    tokenAmount: t.amount === "1" ? "1" : t.amount,
  };
};

interface Props {
  /** Passkey vault Ergo address (from metadata); required to show the panel. */
  vaultAddress: string | null;
  /** User is logged into Dynamic (email/social). */
  dynamicUserPresent: boolean;
}

const disconnectNautilus = () => {
  const w = window as any;
  try {
    w.ergoConnector?.nautilus?.disconnect?.();
  } catch {
    // ignore
  }
};

/**
 * Fund the Dynamic email vault from **traditional Nautilus** (EIP-12
 * `ergoConnector.nautilus.connect()`), independent of whether Nautilus
 * appears inside the Dynamic widget.
 */
export const FundVaultFromNautilus: React.FC<Props> = ({
  vaultAddress,
  dynamicUserPresent,
}) => {
  const toast = useToast();
  const [nautilusAddr, setNautilusAddr] = useState<string | null>(null);
  const [nautilusNano, setNautilusNano] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [amountErg, setAmountErg] = useState("0.1");
  const [tokenId, setTokenId] = useState("");
  const [tokenAmount, setTokenAmount] = useState("1");
  const [funding, setFunding] = useState(false);
  const [walletTokens, setWalletTokens] = useState<ExplorerTokenSummary[]>([]);
  const [walletTokensLoading, setWalletTokensLoading] = useState(false);

  const refreshNautilusFromExplorer = useCallback(async (addr: string) => {
    setWalletTokensLoading(true);
    try {
      const bal = await fetchAddressBalance(addr);
      if (!bal) {
        setNautilusNano(null);
        setWalletTokens([]);
        return;
      }
      setNautilusNano(bal.nanoErgs);
      setWalletTokens(bal.tokens);
    } catch {
      setNautilusNano(null);
      setWalletTokens([]);
    } finally {
      setWalletTokensLoading(false);
    }
  }, []);

  const handleConnectNautilus = async () => {
    const w = window as any;
    if (!w.ergoConnector?.nautilus) {
      toast({
        title: "Nautilus not detected",
        description: "Install the Nautilus extension and reload this page.",
        status: "warning",
        duration: 6000,
        isClosable: true,
      });
      return;
    }
    setConnecting(true);
    try {
      const granted = await w.ergoConnector.nautilus.connect();
      if (!granted) {
        toast({
          title: "Connection rejected",
          description: "Approve the connection in Nautilus to continue.",
          status: "info",
          duration: 4000,
        });
        return;
      }
      if (!w.ergo?.get_change_address) {
        throw new Error("Connected but window.ergo is not available.");
      }
      const addr = await w.ergo.get_change_address();
      setNautilusAddr(addr);
      await refreshNautilusFromExplorer(addr);
      toast({
        title: "Nautilus connected",
        description: `Signing with ${addr.slice(0, 10)}…`,
        status: "success",
        duration: 3000,
      });
    } catch (e: any) {
      toast({
        title: "Nautilus connect failed",
        description: e?.message || String(e),
        status: "error",
        duration: 7000,
      });
      setNautilusAddr(null);
      setNautilusNano(null);
      setWalletTokens([]);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnectNautilus = () => {
    disconnectNautilus();
    setNautilusAddr(null);
    setNautilusNano(null);
    setWalletTokens([]);
    toast({ title: "Nautilus disconnected", status: "info", duration: 2000 });
  };

  if (!dynamicUserPresent || !vaultAddress) return null;

  const handleFund = async () => {
    const w = window as any;
    if (!w.ergo?.sign_tx) {
      toast({
        title: "Nautilus not connected",
        description: "Use “Connect Nautilus (EIP-12)” below — this path does not use the Dynamic widget.",
        status: "warning",
        duration: 6000,
      });
      return;
    }
    const from = await w.ergo.get_change_address();
    const tid = tokenId.trim();
    let tokens: Array<{ tokenId: string; amount: bigint }> | undefined;
    if (tid) {
      const rawAmt = tokenAmount.trim() || "1";
      let amt: bigint;
      try {
        amt = BigInt(rawAmt);
      } catch {
        toast({
          title: "Invalid token amount",
          description: "Use a whole number (e.g. 1 for an NFT).",
          status: "warning",
        });
        return;
      }
      if (amt <= BigInt(0)) {
        toast({ title: "Token amount must be positive", status: "warning" });
        return;
      }
      tokens = [{ tokenId: tid, amount: amt }];
    }

    const amt = parseFloat(amountErg);
    if (!Number.isFinite(amt) || amt < 0) {
      toast({
        title: "Invalid ERG amount",
        description: "Enter zero or more ERG on the recipient box (min box value applies when sending tokens).",
        status: "warning",
      });
      return;
    }
    let nano = BigInt(Math.floor(amt * NANOERG_PER_ERG));
    setFunding(true);
    try {
      const prepared = await buildSendErgUnsigned({
        fromAddress: from,
        toAddress: vaultAddress,
        amountNanoErg: nano,
        tokens,
      });
      const res = await signAndSubmit({
        kind: "nautilus",
        unsignedEip12: prepared.unsignedEip12,
      });
      if (res.ok && res.txId) {
        const label = tid
          ? `Fund vault: token + ERG (${amt} ERG)`
          : `Fund vault from Nautilus (${amt} ERG)`;
        recordErgoTxActivity({
          txId: res.txId,
          label,
          submittedAt: Date.now(),
        });
        toast({
          title: "Submitted",
          description: `tx ${res.txId.slice(0, 12)}…`,
          status: "success",
          duration: 5000,
        });
        await refreshNautilusFromExplorer(from);
      }
      if (!res.ok) {
        toast({
          title: "Submit rejected",
          description: res.responseText?.slice(0, 220) || "Unknown error",
          status: "error",
          duration: 8000,
        });
      }
    } catch (e: any) {
      toast({
        title: "Fund failed",
        description: e?.message || String(e),
        status: "error",
        duration: 8000,
      });
    } finally {
      setFunding(false);
    }
  };

  return (
    <Stack
      borderWidth="1px"
      borderRadius="md"
      p={4}
      spacing={3}
      borderColor="teal.200"
      bg="rgba(45, 212, 191, 0.06)"
    >
      <Heading size="sm">Fund passkey vault from Nautilus (EIP-12)</Heading>
      <Text fontSize="sm" opacity={0.85}>
        This uses the <strong>classic Nautilus dApp connection</strong> (
        <Code fontSize="xs">ergoConnector.nautilus</Code>
        ), not the Dynamic wallet list. Connect below, then send ERG and/or a
        token (e.g. NFT <Code fontSize="xs">tokenId</Code> with amount{" "}
        <Code fontSize="xs">1</Code>) to your vault address shown on this page.
      </Text>

      <Alert status="info" borderRadius="md" variant="subtle">
        <AlertIcon />
        <Box>
          <AlertTitle fontSize="sm">Separate from Dynamic widget wallets</AlertTitle>
          <AlertDescription fontSize="xs">
            Dynamic’s supported-wallet list is separate infrastructure. This flow
            always works when Nautilus is installed, regardless of Dynamic
            connector configuration.
          </AlertDescription>
        </Box>
      </Alert>

      <HStack flexWrap="wrap" spacing={2}>
        <Button
          colorScheme="orange"
          variant="outline"
          size="sm"
          onClick={() => void handleConnectNautilus()}
          isLoading={connecting}
          loadingText="Connecting…"
          isDisabled={Boolean(nautilusAddr)}
        >
          Connect Nautilus (EIP-12)
        </Button>
        {nautilusAddr && (
          <Button size="sm" variant="ghost" onClick={handleDisconnectNautilus}>
            Disconnect Nautilus
          </Button>
        )}
      </HStack>

      {nautilusAddr && (
        <>
          <Text fontSize="xs">
            <strong>From (Nautilus):</strong> <Code fontSize="xs">{nautilusAddr}</Code>
            {nautilusNano !== null && (
              <>
                {" "}
                · <strong>Balance:</strong> {formatErg(nautilusNano)} ERG
              </>
            )}
          </Text>
          <Text fontSize="xs">
            <strong>To (vault):</strong> <Code fontSize="xs">{vaultAddress}</Code>
          </Text>

          <Divider />

          <HStack justify="space-between" align="center" flexWrap="wrap" spacing={2}>
            <Text fontSize="xs" fontWeight="semibold">
              Tokens in this Nautilus address
            </Text>
            <Button
              size="xs"
              variant="ghost"
              isLoading={walletTokensLoading}
              loadingText="Refreshing…"
              onClick={() => void refreshNautilusFromExplorer(nautilusAddr)}
            >
              Refresh from Explorer
            </Button>
          </HStack>
          {walletTokensLoading && walletTokens.length === 0 ? (
            <HStack spacing={2} fontSize="xs" opacity={0.8}>
              <Spinner size="xs" />
              <Text>Loading confirmed balances…</Text>
            </HStack>
          ) : walletTokens.length === 0 ? (
            <Text fontSize="xs" opacity={0.75}>
              No tokens found on-chain for this address (ERG-only transfer is fine). If you
              just received assets, use Refresh or wait for confirmation.
            </Text>
          ) : (
            <Box
              borderWidth="1px"
              borderRadius="md"
              maxH="200px"
              overflowY="auto"
              p={1}
              borderColor="whiteAlpha.300"
            >
              <Stack spacing={1}>
                {walletTokens.slice(0, WALLET_TOKEN_LIST_CAP).map((t) => {
                  const label = t.name?.trim() || shortenTokenId(t.tokenId, 6, 6);
                  const selected = tokenId.trim() === t.tokenId;
                  return (
                    <Button
                      key={t.tokenId}
                      size="xs"
                      variant={selected ? "solid" : "ghost"}
                      colorScheme={selected ? "teal" : "gray"}
                      justifyContent="flex-start"
                      whiteSpace="normal"
                      h="auto"
                      py={1}
                      px={2}
                      fontWeight="normal"
                      onClick={() => {
                        const sel = applyWalletTokenSelection(t);
                        setTokenId(sel.tokenId);
                        setTokenAmount(sel.tokenAmount);
                      }}
                    >
                      <Text as="span" fontSize="xs" textAlign="left">
                        <strong>{label}</strong>
                        <Text as="span" fontFamily="mono" opacity={0.85} display="block">
                          × {t.amount}
                        </Text>
                      </Text>
                    </Button>
                  );
                })}
              </Stack>
              {walletTokens.length > WALLET_TOKEN_LIST_CAP && (
                <Text fontSize="10px" px={1} pt={1} opacity={0.65}>
                  Showing first {WALLET_TOKEN_LIST_CAP} of {walletTokens.length} tokens. Narrow
                  by pasting an ID below if needed.
                </Text>
              )}
            </Box>
          )}

          <Text fontSize="xs" fontWeight="semibold">
            Optional token / NFT (manual or pick above)
          </Text>
          <Input
            placeholder="Token ID (hex, 64 chars) — leave empty for ERG-only"
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
            fontFamily="mono"
            fontSize="xs"
          />
          <Input
            placeholder="Token amount (default 1 for NFTs)"
            value={tokenAmount}
            onChange={(e) => setTokenAmount(e.target.value)}
            maxW="200px"
            fontSize="sm"
          />

          <Text fontSize="xs" fontWeight="semibold">
            ERG on recipient box
          </Text>
          <Input
            type="number"
            step="0.01"
            min={0}
            value={amountErg}
            onChange={(e) => setAmountErg(e.target.value)}
            maxW="200px"
            fontSize="sm"
            placeholder="ERG (nanoERG output; min enforced if token set)"
          />
          <Text fontSize="10px" opacity={0.65}>
            With a token attached, the builder ensures at least the network minimum
            ERG on the vault output so the box is valid.
          </Text>

          <Button
            colorScheme="teal"
            size="sm"
            onClick={() => void handleFund()}
            isLoading={funding}
            loadingText="Building & signing…"
          >
            {tokenId.trim() ? "Send token + ERG to vault" : "Send ERG to vault"}
          </Button>
        </>
      )}
    </Stack>
  );
};
