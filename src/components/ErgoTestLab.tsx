import React, { useState } from "react";
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Code,
  Divider,
  Flex,
  Heading,
  HStack,
  Icon,
  Input,
  Stack,
  Text,
  VStack,
  useColorMode,
  useToast,
} from "@chakra-ui/react";
import { CheckCircleIcon, WarningIcon } from "@chakra-ui/icons";
import {
  runAllTests,
  runSignVerify,
  TestLabResult,
} from "../lib/ergoTestLab";
import {
  ErgoSecretBytes,
  unlockWithPasskey,
} from "../lib/ergoKeyVault";
import { VaultRecord } from "../lib/vaultStorage";

interface Props {
  vault: VaultRecord;
}

const ResultRow: React.FC<{ r: TestLabResult }> = ({ r }) => {
  const { colorMode } = useColorMode();
  return (
    <Flex
      direction="column"
      borderWidth="1px"
      borderRadius="md"
      borderColor={
        r.ok
          ? colorMode === "light"
            ? "green.300"
            : "green.500"
          : colorMode === "light"
          ? "red.300"
          : "red.500"
      }
      bg={
        r.ok
          ? colorMode === "light"
            ? "green.50"
            : "rgba(72, 187, 120, 0.08)"
          : colorMode === "light"
          ? "red.50"
          : "rgba(245, 101, 101, 0.08)"
      }
      p={3}
    >
      <HStack justify="space-between">
        <HStack>
          <Icon
            as={r.ok ? CheckCircleIcon : WarningIcon}
            color={r.ok ? "green.500" : "red.500"}
          />
          <Text fontWeight="semibold" fontSize="sm">
            {r.name}
          </Text>
        </HStack>
        <HStack>
          <Badge colorScheme={r.ok ? "green" : "red"}>
            {r.ok ? "PASS" : "FAIL"}
          </Badge>
          <Text fontSize="xs" opacity={0.6}>
            {r.durationMs} ms
          </Text>
        </HStack>
      </HStack>
      {r.details && (
        <Code
          mt={2}
          p={2}
          fontSize="xs"
          whiteSpace="pre-wrap"
          wordBreak="break-all"
          variant="subtle"
        >
          {r.details}
        </Code>
      )}
    </Flex>
  );
};

export const ErgoTestLab: React.FC<Props> = ({ vault }) => {
  const { colorMode } = useColorMode();
  const toast = useToast();
  const [message, setMessage] = useState("Hello from Ergo + Dynamic.xyz!");
  const [includeDryRun, setIncludeDryRun] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TestLabResult[] | null>(null);

  const [singleMessage, setSingleMessage] = useState("");
  const [singleResult, setSingleResult] = useState<TestLabResult | null>(null);
  const [singleRunning, setSingleRunning] = useState(false);

  const handleRunAll = async () => {
    setRunning(true);
    setResults(null);
    let secret: ErgoSecretBytes | null = null;
    try {
      secret = await unlockWithPasskey(vault);
      const out = await runAllTests(secret, vault.ergoAddress, {
        message,
        includeDryRun,
      });
      setResults(out);
      const passed = out.filter((r) => r.ok).length;
      toast({
        title: `Ran ${out.length} tests`,
        description: `${passed} passed, ${out.length - passed} failed.`,
        status: passed === out.length ? "success" : "warning",
        duration: 4000,
        isClosable: true,
      });
    } catch (err: any) {
      toast({
        title: "Test lab failed to run",
        description: err?.message || String(err),
        status: "error",
        duration: 6000,
        isClosable: true,
      });
    } finally {
      secret?.wipe();
      setRunning(false);
    }
  };

  const handleSignSingle = async () => {
    if (!singleMessage.trim()) {
      toast({ title: "Type something to sign first", status: "warning" });
      return;
    }
    setSingleRunning(true);
    setSingleResult(null);
    let secret: ErgoSecretBytes | null = null;
    try {
      secret = await unlockWithPasskey(vault);
      const r = await runSignVerify(secret, vault.ergoAddress, singleMessage);
      setSingleResult(r);
    } catch (err: any) {
      toast({
        title: "Sign failed",
        description: err?.message || String(err),
        status: "error",
        duration: 6000,
        isClosable: true,
      });
    } finally {
      secret?.wipe();
      setSingleRunning(false);
    }
  };

  return (
    <Box
      borderWidth="1px"
      borderRadius="md"
      borderColor={colorMode === "light" ? "gray.200" : "whiteAlpha.300"}
      p={4}
    >
      <VStack align="stretch" spacing={4}>
        <HStack justify="space-between">
          <Heading size="sm">Ergo test lab</Heading>
          <Badge variant="subtle" colorScheme="purple">
            self-test
          </Badge>
        </HStack>
        <Text fontSize="xs" opacity={0.75}>
          Exercises the vault end-to-end without spending any ERG.
          Each test triggers one passkey prompt at the start; results
          are signed locally with sigma-rust and verified in the same
          process.
        </Text>

        <Stack spacing={3}>
          <Heading size="xs" textTransform="uppercase" opacity={0.7}>
            Run battery
          </Heading>
          <Input
            placeholder="Message to sign"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            fontSize="sm"
          />
          <Checkbox
            isChecked={includeDryRun}
            onChange={(e) => setIncludeDryRun(e.target.checked)}
          >
            <Text fontSize="sm">
              Also build + sign a 0.001 ERG self-send (not submitted —
              requires the address to have at least one UTXO)
            </Text>
          </Checkbox>
          <Button
            colorScheme="purple"
            onClick={handleRunAll}
            isLoading={running}
            loadingText="Running…"
          >
            Run all tests
          </Button>
        </Stack>

        {results && (
          <VStack align="stretch" spacing={2}>
            {results.map((r, i) => (
              <ResultRow key={i} r={r} />
            ))}
          </VStack>
        )}

        <Divider />

        <Stack spacing={3}>
          <Heading size="xs" textTransform="uppercase" opacity={0.7}>
            Sign an arbitrary message
          </Heading>
          <Text fontSize="xs" opacity={0.75}>
            Type any string and we'll produce an Ergo P2PK Schnorr
            proof for it, then verify the proof against your vault
            address. Useful as a "prove you control this address"
            challenge.
          </Text>
          <Input
            placeholder="e.g. 'gm wagmi 2026-04-29'"
            value={singleMessage}
            onChange={(e) => setSingleMessage(e.target.value)}
            fontSize="sm"
          />
          <Button onClick={handleSignSingle} isLoading={singleRunning}>
            Sign + verify
          </Button>
          {singleResult && <ResultRow r={singleResult} />}
        </Stack>
      </VStack>
    </Box>
  );
};

export default ErgoTestLab;
