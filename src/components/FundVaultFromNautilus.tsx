import React, { useState, useEffect } from "react";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Code,
  Heading,
  Input,
  Stack,
  Text,
  useToast,
} from "@chakra-ui/react";
import { buildSendErgUnsigned } from "../lib/ergoSigning";
import { signAndSubmit } from "../lib/games/signAndSubmit";
import { recordErgoTxActivity } from "../lib/ergoTxActivity";

const NANOERG_PER_ERG = 1_000_000_000;

const formatErg = (nano: string) => {
  const n = BigInt(nano);
  const whole = n / BigInt(NANOERG_PER_ERG);
  const frac = n % BigInt(NANOERG_PER_ERG);
  return `${whole}.${frac.toString().padStart(9, "0").replace(/0+$/, "") || "0"}`;
};

interface Props {
  /** Passkey vault Ergo address (from metadata); required to show the panel. */
  vaultAddress: string | null;
  /** User is logged into Dynamic (email/social). */
  dynamicUserPresent: boolean;
}

/**
 * When the user has both Dynamic (vault known) and Nautilus as primary inside
 * Dynamic, offer a one-step "fund vault" that builds a send tx from Nautilus's
 * change address to the vault address and signs via EIP-12.
 */
export const FundVaultFromNautilus: React.FC<Props> = ({
  vaultAddress,
  dynamicUserPresent,
}) => {
  const toast = useToast();
  const [nautilusAddr, setNautilusAddr] = useState<string | null>(null);
  const [nautilusNano, setNautilusNano] = useState<string | null>(null);
  const [amountErg, setAmountErg] = useState("0.1");
  const [funding, setFunding] = useState(false);

  // Poll for window.ergo so we pick up Nautilus after the user selects it in the widget.
  useEffect(() => {
    if (!dynamicUserPresent || !vaultAddress) return;
    const tick = () => {
      void (async () => {
        try {
          const w = window as any;
          if (!w.ergo?.get_change_address) {
            setNautilusAddr(null);
            setNautilusNano(null);
            return;
          }
          const addr = await w.ergo.get_change_address();
          setNautilusAddr(addr);
          const res = await fetch(
            `https://api.ergoplatform.com/api/v1/addresses/${encodeURIComponent(addr)}/balance/total`
          );
          if (!res.ok) {
            setNautilusNano(null);
            return;
          }
          const j = await res.json();
          const conf = j?.confirmed ?? j;
          setNautilusNano(String(conf?.nanoErgs ?? "0"));
        } catch {
          setNautilusAddr(null);
          setNautilusNano(null);
        }
      })();
    };
    tick();
    const iv = setInterval(tick, 2500);
    return () => clearInterval(iv);
  }, [dynamicUserPresent, vaultAddress]);

  if (!dynamicUserPresent || !vaultAddress) return null;

  const handleFund = async () => {
    const w = window as any;
    if (!w.ergo?.sign_tx) {
      toast({
        title: "Nautilus not connected",
        description: "Pick Nautilus in the Dynamic widget first.",
        status: "warning",
        duration: 5000,
      });
      return;
    }
    const from = await w.ergo.get_change_address();
    const amt = parseFloat(amountErg);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast({
        title: "Invalid amount",
        description: "Enter a positive ERG amount.",
        status: "warning",
      });
      return;
    }
    const nano = BigInt(Math.floor(amt * NANOERG_PER_ERG));
    setFunding(true);
    try {
      const prepared = await buildSendErgUnsigned({
        fromAddress: from,
        toAddress: vaultAddress,
        amountNanoErg: nano,
      });
      const res = await signAndSubmit({
        kind: "nautilus",
        unsignedEip12: prepared.unsignedEip12,
      });
      if (res.ok && res.txId) {
        recordErgoTxActivity({
          txId: res.txId,
          label: `Fund passkey vault from Nautilus (${amt} ERG)`,
          submittedAt: Date.now(),
        });
        toast({
          title: "Submitted",
          description: `tx ${res.txId.slice(0, 12)}…`,
          status: "success",
          duration: 5000,
        });
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
      <Heading size="sm">Fund passkey vault from Nautilus</Heading>
      <Text fontSize="sm" opacity={0.85}>
        If you use <strong>Nautilus</strong> inside Dynamic for Ergo signing but
        also have an <strong>email + passkey vault</strong>, you can move ERG from
        your Nautilus change address to the vault address in one transaction
        (Nautilus will prompt to sign).
      </Text>
      {!nautilusAddr && (
        <Alert status="info" borderRadius="md">
          <AlertIcon />
          <Box>
            <AlertTitle fontSize="sm">Connect Nautilus in the widget first</AlertTitle>
            <AlertDescription fontSize="xs">
              Open the Dynamic widget above, choose Nautilus, then return here —
              this panel detects <Code fontSize="xs">window.ergo</Code>.
            </AlertDescription>
          </Box>
        </Alert>
      )}
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
          <Input
            type="number"
            step="0.01"
            min={0.001}
            value={amountErg}
            onChange={(e) => setAmountErg(e.target.value)}
            maxW="200px"
            fontSize="sm"
            placeholder="Amount (ERG)"
          />
          <Button
            colorScheme="teal"
            size="sm"
            onClick={() => void handleFund()}
            isLoading={funding}
            loadingText="Building & signing…"
            isDisabled={!nautilusAddr}
          >
            Send ERG to vault (Nautilus signs)
          </Button>
        </>
      )}
    </Stack>
  );
};
