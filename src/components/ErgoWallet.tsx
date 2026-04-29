import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Code,
  Divider,
  Heading,
  HStack,
  Input,
  Spinner,
  Stack,
  Text,
  VStack,
  useColorMode,
  useToast,
} from "@chakra-ui/react";
import {
  DynamicWidget,
  useDynamicContext,
} from "@dynamic-labs/sdk-react-core";
import { isEthereumWallet } from "@dynamic-labs/ethereum";
import {
  deriveErgoAddress,
  signErgoTx,
  DerivedErgoIdentity,
  DynamicPrimaryWalletLike,
} from "../lib/ergoFromDynamic";
import { NautilusButton } from "./NautilusButton";

const ERGO_API = "https://api.ergoplatform.com/api/v1";
const NANOERG_PER_ERG = 1_000_000_000;
const DEFAULT_FEE_NANOERG = 1_100_000;

interface ErgoBalance {
  nanoErgs: string;
  tokens: Array<{ tokenId: string; amount: string; name?: string; decimals?: number }>;
}

const fetchBalance = async (address: string): Promise<ErgoBalance | null> => {
  const res = await fetch(
    `${ERGO_API}/addresses/${encodeURIComponent(address)}/balance/total`
  );
  if (!res.ok) return null;
  const json = await res.json();
  const confirmed = json?.confirmed ?? json;
  const nanoErgs = confirmed?.nanoErgs ?? "0";
  const tokens = (confirmed?.tokens || []).map((t: any) => ({
    tokenId: t.tokenId,
    amount: String(t.amount),
    name: t.name,
    decimals: t.decimals,
  }));
  return { nanoErgs: String(nanoErgs), tokens };
};

const formatErg = (nano: string | number) => {
  const n = typeof nano === "string" ? BigInt(nano) : BigInt(Math.floor(nano));
  const whole = n / BigInt(NANOERG_PER_ERG);
  const frac = n % BigInt(NANOERG_PER_ERG);
  return `${whole}.${frac.toString().padStart(9, "0")}`;
};

export const ErgoWallet: React.FC = () => {
  const { colorMode } = useColorMode();
  const toast = useToast();
  const { primaryWallet, user } = useDynamicContext();

  const [identity, setIdentity] = useState<DerivedErgoIdentity | null>(null);
  const [deriving, setDeriving] = useState(false);
  const [balance, setBalance] = useState<ErgoBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [amountErg, setAmountErg] = useState("");
  const [sending, setSending] = useState(false);
  const [lastTxResult, setLastTxResult] = useState<string | null>(null);

  // We type-narrow to the EVM wallet shape we depend on.
  const evmWallet = useMemo<DynamicPrimaryWalletLike | null>(() => {
    if (!primaryWallet) return null;
    if (!isEthereumWallet(primaryWallet)) return null;
    return primaryWallet as unknown as DynamicPrimaryWalletLike;
  }, [primaryWallet]);

  // Auto-derive once the user is logged in with an EVM-capable wallet.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!evmWallet || identity || deriving) return;
      setDeriving(true);
      try {
        const derived = await deriveErgoAddress(evmWallet);
        if (!cancelled) setIdentity(derived);
      } catch (err: any) {
        if (!cancelled) {
          toast({
            title: "Could not derive Ergo address",
            description: err?.message || String(err),
            status: "error",
            duration: 6000,
            isClosable: true,
          });
        }
      } finally {
        if (!cancelled) setDeriving(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evmWallet]);

  // Refresh balance whenever the derived address changes.
  useEffect(() => {
    if (!identity) {
      setBalance(null);
      return;
    }
    let cancelled = false;
    setBalanceLoading(true);
    fetchBalance(identity.ergoAddress)
      .then((b) => {
        if (!cancelled) setBalance(b);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setBalanceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [identity]);

  const handleRefreshBalance = async () => {
    if (!identity) return;
    setBalanceLoading(true);
    try {
      const b = await fetchBalance(identity.ergoAddress);
      setBalance(b);
    } finally {
      setBalanceLoading(false);
    }
  };

  const handleSendErg = async () => {
    if (!identity || !evmWallet) return;
    if (!recipient.trim()) {
      toast({ title: "Recipient required", status: "warning" });
      return;
    }
    const amountFloat = parseFloat(amountErg);
    if (!isFinite(amountFloat) || amountFloat <= 0) {
      toast({ title: "Enter a positive ERG amount", status: "warning" });
      return;
    }
    setSending(true);
    setLastTxResult(null);

    try {
      const amountNano = BigInt(Math.floor(amountFloat * NANOERG_PER_ERG));

      // Build the unsigned transaction with Fleet SDK using the Explorer's
      // current UTXO set for the derived address.
      const utxoRes = await fetch(
        `${ERGO_API}/boxes/unspent/byAddress/${encodeURIComponent(identity.ergoAddress)}?limit=50`
      );
      if (!utxoRes.ok) throw new Error("Failed to fetch unspent boxes");
      const utxoJson = await utxoRes.json();
      const inputs = (utxoJson.items || []) as any[];
      if (inputs.length === 0) throw new Error("No unspent boxes at derived address");

      const heightRes = await fetch(`${ERGO_API}/blocks?limit=1`);
      const heightJson = await heightRes.json();
      const currentHeight: number =
        heightJson?.items?.[0]?.height || heightJson?.[0]?.height || 0;

      const fleet = await import("@fleet-sdk/core");
      const { TransactionBuilder, OutputBuilder, RECOMMENDED_MIN_FEE_VALUE } =
        fleet as any;

      const fee =
        typeof RECOMMENDED_MIN_FEE_VALUE !== "undefined"
          ? RECOMMENDED_MIN_FEE_VALUE
          : DEFAULT_FEE_NANOERG;

      const builder = new TransactionBuilder(currentHeight)
        .from(inputs)
        .to(new OutputBuilder(amountNano, recipient.trim()))
        .sendChangeTo(identity.ergoAddress)
        .payFee(fee);

      const unsignedTx = builder.build().toEIP12Object();

      const { signedTxJson } = await signErgoTx(evmWallet, unsignedTx, inputs);

      // Best-effort submit via Explorer. Will likely fail because Ergo
      // P2PK proofs are Schnorr, not raw ECDSA — see the caveat in
      // `lib/ergoFromDynamic.ts`. We surface the error to the UI.
      const submitRes = await fetch(`${ERGO_API}/mempool/transactions/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signedTxJson),
      });

      const submitText = await submitRes.text();
      if (!submitRes.ok) {
        setLastTxResult(`HTTP ${submitRes.status}: ${submitText}`);
        toast({
          title: "Submit rejected (expected for stub Schnorr proof)",
          description:
            "See the Tier 3 caveat in lib/ergoFromDynamic.ts — connect Nautilus to actually broadcast.",
          status: "warning",
          duration: 8000,
          isClosable: true,
        });
      } else {
        setLastTxResult(submitText);
        toast({
          title: "Submitted",
          description: submitText.slice(0, 80),
          status: "success",
          duration: 6000,
          isClosable: true,
        });
        handleRefreshBalance();
      }
    } catch (err: any) {
      toast({
        title: "Send failed",
        description: err?.message || String(err),
        status: "error",
        duration: 8000,
        isClosable: true,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Box
      maxW="780px"
      mx="auto"
      mt={6}
      p={6}
      borderRadius="lg"
      borderWidth="1px"
      borderColor={colorMode === "light" ? "gray.200" : "whiteAlpha.300"}
    >
      <VStack align="stretch" spacing={5}>
        <Heading size="md">Sign in with Dynamic.xyz</Heading>
        <Text fontSize="sm" opacity={0.8}>
          Ergo is a Dynamic Tier 3 chain — there is no native Ergo connector.
          We sign in with the embedded EVM wallet, then deterministically
          derive an Ergo P2PK address from its secp256k1 public key. See
          <Code mx={1}>src/lib/ergoFromDynamic.ts</Code> for details.
        </Text>

        <DynamicWidget />

        {primaryWallet && !evmWallet && (
          <Text color="orange.400" fontSize="sm">
            The connected primary wallet is not an EVM-capable wallet, so we
            cannot derive an Ergo address from it. Try logging in with email
            (which provisions a Dynamic embedded EVM wallet).
          </Text>
        )}

        {evmWallet && (
          <Stack spacing={3}>
            <Heading size="sm">Derived Ergo identity</Heading>
            {deriving ? (
              <HStack>
                <Spinner size="sm" />
                <Text fontSize="sm">Asking your wallet to sign…</Text>
              </HStack>
            ) : identity ? (
              <Stack spacing={1} fontSize="sm">
                <Text>
                  <strong>Ergo address:</strong>
                </Text>
                <Code wordBreak="break-all">{identity.ergoAddress}</Code>
                <Text mt={2}>
                  <strong>Compressed pubkey:</strong>
                </Text>
                <Code wordBreak="break-all" fontSize="xs">
                  {identity.compressedPublicKeyHex}
                </Code>
              </Stack>
            ) : (
              <Text fontSize="sm" opacity={0.7}>
                Sign the derivation message to reveal your Ergo address.
              </Text>
            )}

            {identity && (
              <>
                <HStack justify="space-between" mt={2}>
                  <Heading size="sm">Balance</Heading>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={handleRefreshBalance}
                    isLoading={balanceLoading}
                  >
                    Refresh
                  </Button>
                </HStack>
                {balanceLoading && !balance ? (
                  <Spinner size="sm" />
                ) : balance ? (
                  <Stack spacing={1} fontSize="sm">
                    <Text>
                      <strong>{formatErg(balance.nanoErgs)}</strong> ERG
                    </Text>
                    {balance.tokens.length > 0 && (
                      <Text fontSize="xs" opacity={0.8}>
                        {balance.tokens.length} token
                        {balance.tokens.length === 1 ? "" : "s"} held
                      </Text>
                    )}
                  </Stack>
                ) : (
                  <Text fontSize="sm" opacity={0.7}>
                    Could not load balance.
                  </Text>
                )}

                <Divider my={2} />

                <Heading size="sm">Send ERG</Heading>
                <Stack spacing={2}>
                  <Input
                    placeholder="Recipient Ergo address (9...)"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    fontFamily="mono"
                    fontSize="sm"
                  />
                  <Input
                    placeholder="Amount (ERG)"
                    type="number"
                    step="0.001"
                    value={amountErg}
                    onChange={(e) => setAmountErg(e.target.value)}
                    fontSize="sm"
                  />
                  <Button
                    colorScheme="blue"
                    onClick={handleSendErg}
                    isLoading={sending}
                    loadingText="Building & signing…"
                  >
                    Build, sign & broadcast
                  </Button>
                  {lastTxResult && (
                    <Code
                      wordBreak="break-all"
                      whiteSpace="pre-wrap"
                      fontSize="xs"
                      p={2}
                    >
                      {lastTxResult}
                    </Code>
                  )}
                  <Text fontSize="xs" color="orange.400">
                    Heads up: a Tier 3 raw-ECDSA proof is not a valid Ergo
                    Schnorr proof, so the broadcast step is expected to be
                    rejected by the network until a real signer is wired in.
                    Use Nautilus below for a fully functional path.
                  </Text>
                </Stack>
              </>
            )}
          </Stack>
        )}

        <Divider />

        <Stack spacing={2}>
          <Heading size="sm">Or connect Nautilus directly</Heading>
          <Text fontSize="sm" opacity={0.8}>
            If you already have an Ergo wallet, skip Dynamic and connect
            Nautilus over EIP-12. A native Dynamic Custom Wallet Connector
            for Nautilus is a follow-up task.
          </Text>
          <NautilusButton />
        </Stack>

        {user?.email && (
          <Text fontSize="xs" opacity={0.6}>
            Logged in as <Code>{user.email}</Code>
          </Text>
        )}
      </VStack>
    </Box>
  );
};

export default ErgoWallet;
