import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Badge,
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
  Textarea,
  VStack,
  useColorMode,
  useToast,
} from "@chakra-ui/react";
import {
  DynamicWidget,
  useDynamicContext,
  useUserUpdateRequest,
} from "@dynamic-labs/sdk-react-core";
import { isEthereumWallet } from "@dynamic-labs/ethereum";
import {
  ErgoSecretBytes,
  attachPasskey,
  findExistingVault,
  provisionVault,
  unlockWithPasskey,
  unlockWithRecoveryPhrase,
  wipeLocalVault,
} from "../lib/ergoKeyVault";
import {
  buildDynamicMetadataPatch,
  buildDynamicMetadataClearPatch,
  saveVaultToLocalStorage,
  VaultRecord,
} from "../lib/vaultStorage";
import { isPlatformAuthenticatorAvailable } from "../lib/passkey";
import { sendErg } from "../lib/ergoSigning";
import { NautilusButton } from "./NautilusButton";

const ERGO_API = "https://api.ergoplatform.com/api/v1";
const NANOERG_PER_ERG = 1_000_000_000;

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

type VaultState =
  | { kind: "idle" }
  | { kind: "needs-login" }
  | { kind: "needs-platform-auth" }
  | { kind: "no-vault" }
  | { kind: "locked"; vault: VaultRecord; passkeyAvailable: boolean }
  | { kind: "unlocked"; vault: VaultRecord }
  | { kind: "unsupported"; reason: string };

export const ErgoWallet: React.FC = () => {
  const { colorMode } = useColorMode();
  const toast = useToast();
  const { primaryWallet, user } = useDynamicContext();
  const { updateUser } = useUserUpdateRequest();

  const [vault, setVault] = useState<VaultRecord | null>(null);
  const [vaultState, setVaultState] = useState<VaultState>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const [showRecoveryPhrase, setShowRecoveryPhrase] = useState<string | null>(null);
  const [recoveryPhraseInput, setRecoveryPhraseInput] = useState("");
  const [showRecoveryUnlock, setShowRecoveryUnlock] = useState(false);

  const [balance, setBalance] = useState<ErgoBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [amountErg, setAmountErg] = useState("");
  const [sending, setSending] = useState(false);
  const [lastSubmit, setLastSubmit] = useState<{ ok: boolean; text: string } | null>(null);

  const isEvm = useMemo(
    () => Boolean(primaryWallet && isEthereumWallet(primaryWallet)),
    [primaryWallet]
  );

  const refreshVaultState = useCallback(async () => {
    if (!user) {
      setVaultState({ kind: "needs-login" });
      setVault(null);
      return;
    }
    const platformOk = await isPlatformAuthenticatorAvailable();
    const found = findExistingVault(user as any);
    setVault(found);
    if (!found) {
      if (!platformOk) {
        setVaultState({
          kind: "unsupported",
          reason:
            "No platform authenticator (Touch ID / Windows Hello / Android biometric) is available in this browser. " +
              "You can still use the Nautilus path below, or open this URL on a device with a passkey.",
        });
      } else {
        setVaultState({ kind: "no-vault" });
      }
    } else {
      setVaultState({
        kind: "locked",
        vault: found,
        passkeyAvailable: Boolean(found.passkey && found.passkeyEncrypted),
      });
    }
  }, [user]);

  useEffect(() => {
    refreshVaultState();
  }, [refreshVaultState]);

  useEffect(() => {
    if (vaultState.kind !== "unlocked") {
      setBalance(null);
      return;
    }
    let cancelled = false;
    setBalanceLoading(true);
    fetchBalance(vaultState.vault.ergoAddress)
      .then((b) => !cancelled && setBalance(b))
      .catch(() => undefined)
      .finally(() => !cancelled && setBalanceLoading(false));
    return () => {
      cancelled = true;
    };
  }, [vaultState]);

  const persistVaultToDynamic = useCallback(
    async (rec: VaultRecord) => {
      try {
        await updateUser({
          metadata: buildDynamicMetadataPatch(
            (user?.metadata as Record<string, unknown> | undefined),
            rec
          ),
        });
      } catch (err: any) {
        // Mirror failure is non-fatal — we still have the local copy.
        toast({
          title: "Vault saved locally only",
          description:
            "Could not mirror the encrypted blob to your Dynamic profile " +
            "(" +
            (err?.message || String(err)) +
            "). Cross-device recovery will be unavailable until the next save.",
          status: "warning",
          duration: 6000,
          isClosable: true,
        });
      }
    },
    [updateUser, user, toast]
  );

  const handleProvision = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const identifier =
        (user as any).email ||
        (user as any).userId ||
        (user as any).id ||
        "ergo-vault-user";
      const display = (user as any).email || "Ergo Vault";
      const { vault: newVault, recoveryPhrase } = await provisionVault(
        identifier,
        display
      );
      setVault(newVault);
      setShowRecoveryPhrase(recoveryPhrase);
      await persistVaultToDynamic(newVault);
      setVaultState({
        kind: "locked",
        vault: newVault,
        passkeyAvailable: Boolean(newVault.passkey),
      });
    } catch (err: any) {
      toast({
        title: "Could not provision vault",
        description: err?.message || String(err),
        status: "error",
        duration: 8000,
        isClosable: true,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleUnlockWithPasskey = async () => {
    if (!vault) return;
    setBusy(true);
    let secret: ErgoSecretBytes | null = null;
    try {
      secret = await unlockWithPasskey(vault);
      setVaultState({ kind: "unlocked", vault });
      // We immediately wipe the secret — sending will re-unlock when needed.
    } catch (err: any) {
      toast({
        title: "Unlock failed",
        description: err?.message || String(err),
        status: "error",
        duration: 6000,
        isClosable: true,
      });
    } finally {
      secret?.wipe();
      setBusy(false);
    }
  };

  const handleUnlockWithRecovery = async () => {
    if (!vault || !recoveryPhraseInput.trim()) return;
    setBusy(true);
    let secret: ErgoSecretBytes | null = null;
    try {
      secret = await unlockWithRecoveryPhrase(vault, recoveryPhraseInput);
      const platformOk = await isPlatformAuthenticatorAvailable();
      if (platformOk && (!vault.passkey || !vault.passkeyEncrypted)) {
        // Re-attach a passkey on this device for next time.
        const identifier =
          (user as any)?.email ||
          (user as any)?.userId ||
          (user as any)?.id ||
          "ergo-vault-user";
        const next = await attachPasskey(
          vault,
          secret,
          identifier,
          (user as any)?.email || "Ergo Vault"
        );
        setVault(next);
        await persistVaultToDynamic(next);
        setVaultState({ kind: "unlocked", vault: next });
      } else {
        setVaultState({ kind: "unlocked", vault });
      }
      setShowRecoveryUnlock(false);
      setRecoveryPhraseInput("");
      toast({ title: "Recovered", status: "success", duration: 3000 });
    } catch (err: any) {
      toast({
        title: "Recovery failed",
        description: err?.message || String(err),
        status: "error",
        duration: 6000,
        isClosable: true,
      });
    } finally {
      secret?.wipe();
      setBusy(false);
    }
  };

  const handleSendErg = async () => {
    if (vaultState.kind !== "unlocked" || !vault) return;
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
    setLastSubmit(null);
    let secret: ErgoSecretBytes | null = null;
    try {
      secret = await unlockWithPasskey(vault);
      const result = await sendErg({
        fromAddress: vault.ergoAddress,
        toAddress: recipient.trim(),
        amountNanoErg: BigInt(Math.floor(amountFloat * NANOERG_PER_ERG)),
        secret,
      });
      setLastSubmit({ ok: result.submitOk, text: result.submitResponse });
      toast({
        title: result.submitOk ? "Submitted" : "Submit rejected",
        description: result.submitOk
          ? `Tx ${result.txId.slice(0, 12)}…`
          : result.submitResponse.slice(0, 100),
        status: result.submitOk ? "success" : "error",
        duration: 6000,
        isClosable: true,
      });
      if (result.submitOk) {
        setRecipient("");
        setAmountErg("");
        setTimeout(() => {
          fetchBalance(vault.ergoAddress).then(setBalance).catch(() => undefined);
        }, 5000);
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
      secret?.wipe();
      setSending(false);
    }
  };

  const handleForgetVault = async () => {
    wipeLocalVault();
    try {
      await updateUser({
        metadata: buildDynamicMetadataClearPatch(
          (user?.metadata as Record<string, unknown> | undefined)
        ),
      });
    } catch {
      // ignore — local clear succeeded.
    }
    setVault(null);
    setShowRecoveryPhrase(null);
    setVaultState(user ? { kind: "no-vault" } : { kind: "needs-login" });
    toast({ title: "Vault forgotten", status: "info", duration: 3000 });
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
          Ergo is a Dynamic Tier 3 chain. We use Dynamic only for email
          login + cross-device storage of an encrypted blob. The actual
          Ergo private key is generated locally, encrypted with a
          hardware-backed passkey (WebAuthn PRF), and only ever
          decrypted in memory while signing a transaction.
        </Text>

        <DynamicWidget />

        {primaryWallet && !isEvm && (
          <Alert status="warning" borderRadius="md">
            <AlertIcon />
            <AlertDescription fontSize="sm">
              The connected primary wallet is not EVM-capable. Sign in
              with email instead so Dynamic provisions an embedded EVM
              wallet — that's what gates access to your encrypted Ergo
              vault.
            </AlertDescription>
          </Alert>
        )}

        {vaultState.kind === "needs-login" && (
          <Text fontSize="sm" opacity={0.7}>
            Sign in above to provision or unlock your Ergo vault.
          </Text>
        )}

        {vaultState.kind === "unsupported" && (
          <Alert status="warning" borderRadius="md">
            <AlertIcon />
            <Box>
              <AlertTitle>Passkey vault unavailable on this browser</AlertTitle>
              <AlertDescription fontSize="sm">{vaultState.reason}</AlertDescription>
            </Box>
          </Alert>
        )}

        {vaultState.kind === "no-vault" && (
          <Stack
            borderWidth="1px"
            borderRadius="md"
            p={4}
            spacing={3}
            borderColor={colorMode === "light" ? "gray.200" : "whiteAlpha.300"}
          >
            <Heading size="sm">Provision your Ergo vault</Heading>
            <Text fontSize="sm" opacity={0.85}>
              We'll generate a fresh Ergo private key in your browser,
              encrypt it with a passkey on this device, and back up an
              encrypted copy plus a 24-word recovery phrase to your
              Dynamic profile. Your browser will prompt you for
              biometrics / device PIN to register the passkey.
            </Text>
            <Button colorScheme="blue" onClick={handleProvision} isLoading={busy}>
              Provision vault with passkey
            </Button>
          </Stack>
        )}

        {showRecoveryPhrase && (
          <Alert
            status="success"
            variant="left-accent"
            borderRadius="md"
            flexDirection="column"
            alignItems="flex-start"
          >
            <HStack>
              <AlertIcon />
              <AlertTitle>Save your recovery phrase NOW</AlertTitle>
            </HStack>
            <AlertDescription fontSize="sm" mt={2}>
              This is the ONLY way to recover your Ergo wallet if you
              lose access to your passkey on every device. Write it down
              physically. We will not show it again.
            </AlertDescription>
            <Code
              w="100%"
              mt={3}
              p={3}
              fontSize="sm"
              whiteSpace="pre-wrap"
              wordBreak="break-word"
            >
              {showRecoveryPhrase}
            </Code>
            <Button mt={3} size="sm" onClick={() => setShowRecoveryPhrase(null)}>
              I've saved it — dismiss
            </Button>
          </Alert>
        )}

        {vaultState.kind === "locked" && (
          <Stack spacing={3}>
            <Heading size="sm">Vault</Heading>
            <Text fontSize="sm">
              <strong>Address:</strong>{" "}
              <Code>{vaultState.vault.ergoAddress}</Code>
            </Text>
            <HStack spacing={3}>
              {vaultState.passkeyAvailable && (
                <Button
                  colorScheme="blue"
                  onClick={handleUnlockWithPasskey}
                  isLoading={busy}
                >
                  Unlock with passkey
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setShowRecoveryUnlock((s) => !s)}
              >
                Use recovery phrase
              </Button>
              <Button variant="ghost" colorScheme="red" onClick={handleForgetVault}>
                Forget vault
              </Button>
            </HStack>
            {showRecoveryUnlock && (
              <Stack spacing={2}>
                <Textarea
                  placeholder="24 recovery words separated by spaces"
                  value={recoveryPhraseInput}
                  onChange={(e) => setRecoveryPhraseInput(e.target.value)}
                  fontFamily="mono"
                  fontSize="sm"
                  rows={3}
                />
                <Button
                  onClick={handleUnlockWithRecovery}
                  isLoading={busy}
                  isDisabled={!recoveryPhraseInput.trim()}
                >
                  Unlock & re-attach passkey
                </Button>
              </Stack>
            )}
          </Stack>
        )}

        {vaultState.kind === "unlocked" && (
          <Stack spacing={3}>
            <HStack justify="space-between">
              <Heading size="sm">Ergo wallet</Heading>
              <Badge colorScheme="green">unlocked</Badge>
            </HStack>
            <Text fontSize="sm">
              <strong>Address:</strong>{" "}
              <Code>{vaultState.vault.ergoAddress}</Code>
            </Text>
            <HStack justify="space-between">
              <Text fontSize="sm">
                <strong>Balance:</strong>{" "}
                {balanceLoading ? (
                  <Spinner size="xs" />
                ) : balance ? (
                  `${formatErg(balance.nanoErgs)} ERG`
                ) : (
                  "—"
                )}
              </Text>
              <Button
                size="xs"
                variant="ghost"
                onClick={() =>
                  fetchBalance(vaultState.vault.ergoAddress).then(setBalance)
                }
              >
                Refresh
              </Button>
            </HStack>

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
                loadingText="Authorizing & signing…"
              >
                Send ERG (passkey will prompt)
              </Button>
              {lastSubmit && (
                <Code
                  whiteSpace="pre-wrap"
                  wordBreak="break-all"
                  fontSize="xs"
                  p={2}
                  colorScheme={lastSubmit.ok ? "green" : "red"}
                >
                  {lastSubmit.text || (lastSubmit.ok ? "(empty 200)" : "")}
                </Code>
              )}
            </Stack>

            <HStack mt={2}>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setVaultState({ kind: "locked", vault: vaultState.vault, passkeyAvailable: true })
                }
              >
                Re-lock
              </Button>
              <Button
                size="sm"
                variant="ghost"
                colorScheme="red"
                onClick={handleForgetVault}
              >
                Forget vault
              </Button>
            </HStack>
          </Stack>
        )}

        <Divider />

        <Stack spacing={2}>
          <Heading size="sm">Or connect Nautilus directly</Heading>
          <Text fontSize="sm" opacity={0.8}>
            If you already have an Ergo wallet, skip Dynamic and connect
            Nautilus over EIP-12.
          </Text>
          <NautilusButton />
        </Stack>

        {(user as any)?.email && (
          <Text fontSize="xs" opacity={0.6}>
            Logged in as <Code>{(user as any).email}</Code>
          </Text>
        )}
      </VStack>
    </Box>
  );
};

export default ErgoWallet;
