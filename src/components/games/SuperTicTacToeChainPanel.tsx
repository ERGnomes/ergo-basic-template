import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  Flex,
  Heading,
  HStack,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
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
  useToast,
} from "@chakra-ui/react";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useWallet } from "../../context/WalletContext";
import {
  DiscoveredSuperGame,
  SuperGameHistorySnapshot,
  fetchAllSuperGames,
  fetchRecentSuperGameHistory,
} from "../../lib/games/superTicTacToeDiscovery";
import {
  getSuperGameP2SAddress,
  superChainStateToGame,
  type SuperChainGameState,
} from "../../lib/games/superTicTacToeContract";
import {
  applySuperMove,
  isLegalSuperMove,
  superStatusOf,
  superWinner,
  totalMoves,
  type SuperBoard,
  type SuperGame,
} from "../../lib/games/superTicTacToeLogic";
import {
  buildSuperCancelGameTx,
  buildSuperClaimWinTx,
  buildSuperCreateGameTx,
  buildSuperJoinGameTx,
  buildSuperMoveTx,
  getSuperPlayerAddresses,
} from "../../lib/games/superTicTacToeTx";
import { signAndSubmit } from "../../lib/games/signAndSubmit";
import { pubKeyHexFromAddress } from "../../lib/games/pubkey";
import {
  findExistingVault,
  unlockWithPasskey,
  ErgoSecretBytes,
} from "../../lib/ergoKeyVault";
import { recordErgoTxActivity } from "../../lib/ergoTxActivity";
import {
  PendingSuperTx,
  SUPER_STUCK_AFTER_MS,
  addPendingSuperTx,
  getPendingSuperTxs,
  reconcilePendingSuper,
  removePendingSuperTx,
  subscribePendingSuper,
} from "../../lib/games/pendingSuperTx";
import SuperTicTacToeBoard from "./SuperTicTacToeBoard";

const NANO_PER_ERG = 1_000_000_000;
const MIN_WAGER_ERG = 0.01;
const DEFAULT_WAGER_ERG = 0.1;
const EXPLORER_TX = "https://explorer.ergoplatform.com/en/transactions/";

const formatErg = (nano: bigint | number | string) => {
  const n = typeof nano === "bigint" ? nano : BigInt(Math.floor(Number(nano)));
  const whole = n / BigInt(NANO_PER_ERG);
  const frac = n % BigInt(NANO_PER_ERG);
  return `${whole}.${frac.toString().padStart(9, "0").replace(/0+$/, "") || "0"}`;
};

const truncAddr = (a: string) =>
  a.length > 20 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a;

type SigningKind = "nautilus" | "vault" | null;

const tripleKey = (s: SuperChainGameState) =>
  `${s.p1PubKeyHex}|${s.p2PubKeyHex}|${s.wagerNanoErg.toString()}`;

export const SuperTicTacToeChainPanel: React.FC = () => {
  const toast = useToast();
  const { colorMode } = useColorMode();
  const { user } = useDynamicContext();
  const { ergoAddress, source } = useWallet();

  const [games, setGames] = useState<DiscoveredSuperGame[]>([]);
  const [gameHistory, setGameHistory] = useState<SuperGameHistorySnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeGame, setActiveGame] = useState<DiscoveredSuperGame | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [wagerErg, setWagerErg] = useState(DEFAULT_WAGER_ERG);
  const [myPubKey, setMyPubKey] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingSuperTx[]>(() => getPendingSuperTxs());

  useEffect(() => {
    const unsub = subscribePendingSuper(() => setPending(getPendingSuperTxs()));
    return unsub;
  }, []);

  useEffect(() => {
    if (!ergoAddress) {
      setMyPubKey(null);
      return;
    }
    let cancelled = false;
    pubKeyHexFromAddress(ergoAddress)
      .then((pk) => {
        if (!cancelled) setMyPubKey(pk);
      })
      .catch(() => {
        if (!cancelled) setMyPubKey(null);
      });
    return () => {
      cancelled = true;
    };
  }, [ergoAddress]);

  const signingKind: SigningKind = useMemo(() => {
    if (source === "dynamic-nautilus" || source === "nautilus-direct") {
      return "nautilus";
    }
    if (source === "vault") return "vault";
    return null;
  }, [source]);

  const contractAddress = useMemo(() => getSuperGameP2SAddress(), []);

  const refreshGames = useCallback(async () => {
    setRefreshing(true);
    try {
      const [out, hist] = await Promise.all([
        fetchAllSuperGames(),
        fetchRecentSuperGameHistory(25).catch(() => [] as SuperGameHistorySnapshot[]),
      ]);
      setGames(out);
      setGameHistory(hist);
      const unspentBoxIds = new Set(out.map((g) => g.box.boxId));
      const unspentTriples = new Set(out.map((g) => tripleKey(g.state)));
      reconcilePendingSuper({ unspentBoxIds, unspentTriples });
    } catch (err: any) {
      toast({
        title: "Couldn't fetch xoxo games",
        description: err?.message || String(err),
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setLoading(true);
    refreshGames();
  }, [refreshGames]);

  useEffect(() => {
    const period = pending.length > 0 ? 5_000 : 15_000;
    const iv = setInterval(refreshGames, period);
    return () => clearInterval(iv);
  }, [refreshGames, pending.length]);

  const projectedGames: DiscoveredSuperGame[] = useMemo(() => {
    const byTriple = new Map<string, DiscoveredSuperGame>();
    for (const g of games) {
      byTriple.set(tripleKey(g.state), g);
    }
    for (const p of pending) {
      if (!p.predicted || !p.follow) continue;
      const wagerBig = BigInt(p.follow.wagerNanoErg);
      const key = `${p.follow.p1PubKeyHex}|${p.follow.p2PubKeyHex}|${wagerBig.toString()}`;
      const existing = byTriple.get(key);
      const st: SuperChainGameState = {
        boards: p.predicted.boards,
        constraintSub: p.predicted.constraintSub,
        p1PubKeyHex: p.predicted.p1PubKeyHex,
        p2PubKeyHex: p.predicted.p2PubKeyHex,
        wagerNanoErg: wagerBig,
      };
      const overlay: DiscoveredSuperGame = existing
        ? {
            box: existing.box,
            state: st,
            phase:
              p.predictedPhase === "spent" ? existing.phase : p.predictedPhase,
            isJoined: p.predicted.p1PubKeyHex !== p.predicted.p2PubKeyHex,
          }
        : {
            box: {
              boxId: `pending:${p.id}`,
              value: (
                BigInt(p.predicted.wagerNanoErg) + BigInt(3_000_000)
              ).toString(),
            },
            state: st,
            phase: p.predictedPhase === "spent" ? "open" : p.predictedPhase,
            isJoined: p.predicted.p1PubKeyHex !== p.predicted.p2PubKeyHex,
          };
      byTriple.set(key, overlay);
    }
    return Array.from(byTriple.values());
  }, [games, pending]);

  useEffect(() => {
    if (!activeGame) return;
    const followed = projectedGames.find(
      (g) => tripleKey(g.state) === tripleKey(activeGame.state)
    );
    if (followed && followed !== activeGame) setActiveGame(followed);
  }, [projectedGames, activeGame]);

  const signAndSubmitTx = async (
    prepared: { unsignedEip12: any; inputBoxes: any[] },
    pendingTemplate: Omit<PendingSuperTx, "id" | "submittedAt"> | null
  ): Promise<boolean> => {
    const doSubmit = async (): Promise<{ ok: boolean; txId?: string; text: string }> => {
      if (signingKind === "nautilus") {
        const res = await signAndSubmit({
          kind: "nautilus",
          unsignedEip12: prepared.unsignedEip12,
        });
        return { ok: res.ok, txId: res.txId, text: res.responseText };
      }
      if (signingKind === "vault") {
        if (!user) return { ok: false, text: "Not logged in." };
        const vault = findExistingVault(user as any);
        if (!vault) {
          return {
            ok: false,
            text: "No vault on this device. Use Dynamic login with email first.",
          };
        }
        let secret: ErgoSecretBytes | null = null;
        try {
          secret = await unlockWithPasskey(vault);
          const res = await signAndSubmit({
            kind: "vault",
            unsignedEip12: prepared.unsignedEip12,
            inputBoxes: prepared.inputBoxes,
            secret,
          });
          return { ok: res.ok, txId: res.txId, text: res.responseText };
        } finally {
          secret?.wipe();
        }
      }
      return { ok: false, text: "No wallet connected." };
    };

    try {
      const res = await doSubmit();
      if (!res.ok) {
        toast({
          title: "Submit rejected",
          description: res.text.slice(0, 220),
          status: "error",
          duration: 8000,
          isClosable: true,
        });
        return false;
      }
      if (pendingTemplate && res.txId) {
        const submittedAt = Date.now();
        addPendingSuperTx({
          ...pendingTemplate,
          id: res.txId,
          submittedAt,
        });
        recordErgoTxActivity({
          txId: res.txId,
          label: `xoxo · ${pendingTemplate.description}`,
          submittedAt,
        });
      }
      toast({
        title: "Submitted to mempool",
        description: res.txId
          ? `tx ${res.txId.slice(0, 10)}… — confirmation ~1–3 min`
          : "Waiting for confirmation.",
        status: "success",
        duration: 5000,
        isClosable: true,
      });
      return true;
    } catch (err: any) {
      toast({
        title: "Signing failed",
        description: err?.message || String(err),
        status: "error",
        duration: 6000,
        isClosable: true,
      });
      return false;
    }
  };

  const withBusy = async <T,>(label: string, fn: () => Promise<T>): Promise<T> => {
    setBusy(true);
    setBusyLabel(label);
    try {
      return await fn();
    } finally {
      setBusy(false);
      setBusyLabel(null);
    }
  };

  const handleCreate = async () => {
    if (!ergoAddress || !myPubKey) return;
    if (wagerErg < MIN_WAGER_ERG) {
      toast({ title: `Minimum wager is ${MIN_WAGER_ERG} ERG`, status: "warning" });
      return;
    }
    await withBusy("Building create-game transaction…", async () => {
      try {
        const wagerNanoErg = BigInt(Math.floor(wagerErg * NANO_PER_ERG));
        const tx = await buildSuperCreateGameTx({
          creatorAddress: ergoAddress,
          creatorPubKeyHex: myPubKey,
          wagerNanoErg,
        });
        const emptyBoards = [
          [0, 0, 0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0, 0, 0],
        ] as unknown as SuperBoard;
        const pendingTemplate: Omit<PendingSuperTx, "id" | "submittedAt"> = {
          kind: "create",
          spentBoxId: null,
          predicted: {
            boards: emptyBoards,
            constraintSub: null,
            p1PubKeyHex: myPubKey,
            p2PubKeyHex: myPubKey,
            wagerNanoErg: wagerNanoErg.toString(),
          },
          predictedPhase: "open",
          follow: {
            p1PubKeyHex: myPubKey,
            p2PubKeyHex: myPubKey,
            wagerNanoErg: wagerNanoErg.toString(),
          },
          description: `Creating xoxo game · ${wagerErg} ERG wager`,
        };
        const ok = await signAndSubmitTx(tx, pendingTemplate);
        if (ok) setTimeout(refreshGames, 3000);
      } catch (err: any) {
        toast({
          title: "Couldn't build transaction",
          description: err?.message || String(err),
          status: "error",
          duration: 6000,
          isClosable: true,
        });
      }
    });
  };

  const handleJoin = async (game: DiscoveredSuperGame) => {
    if (!ergoAddress || !myPubKey) return;
    await withBusy("Building join transaction…", async () => {
      try {
        const tx = await buildSuperJoinGameTx({
          currentGameBox: game.box,
          currentGameState: game.state,
          joinerAddress: ergoAddress,
          joinerPubKeyHex: myPubKey,
        });
        const pendingTemplate: Omit<PendingSuperTx, "id" | "submittedAt"> = {
          kind: "join",
          spentBoxId: game.box.boxId,
          predicted: {
            boards: game.state.boards,
            constraintSub: game.state.constraintSub,
            p1PubKeyHex: game.state.p1PubKeyHex,
            p2PubKeyHex: myPubKey,
            wagerNanoErg: game.state.wagerNanoErg.toString(),
          },
          predictedPhase: "ongoing",
          follow: {
            p1PubKeyHex: game.state.p1PubKeyHex,
            p2PubKeyHex: myPubKey,
            wagerNanoErg: game.state.wagerNanoErg.toString(),
          },
          description: `Joining xoxo · ${formatErg(game.state.wagerNanoErg)} ERG`,
        };
        const ok = await signAndSubmitTx(tx, pendingTemplate);
        if (ok) {
          setActiveGame({
            ...game,
            state: { ...game.state, p2PubKeyHex: myPubKey },
            isJoined: true,
            phase: "ongoing",
          });
          setTimeout(refreshGames, 3000);
        }
      } catch (err: any) {
        toast({
          title: "Couldn't join",
          description: err?.message || String(err),
          status: "error",
          duration: 6000,
          isClosable: true,
        });
      }
    });
  };

  const handleMove = async (subIndex: number, cellIndex: number) => {
    if (!activeGame || !ergoAddress || !myPubKey) return;
    await withBusy("Building move transaction…", async () => {
      try {
        const tx = await buildSuperMoveTx({
          currentGameBox: activeGame.box,
          currentGameState: activeGame.state,
          moverAddress: ergoAddress,
          moverPubKeyHex: myPubKey,
          subIndex,
          cellIndex,
        });
        const g = superChainStateToGame(activeGame.state);
        const predicted = applySuperMove(g, subIndex, cellIndex);
        const pendingTemplate: Omit<PendingSuperTx, "id" | "submittedAt"> = {
          kind: "move",
          spentBoxId: activeGame.box.boxId,
          predicted: {
            boards: predicted.boards,
            constraintSub: predicted.constraintSub,
            p1PubKeyHex: activeGame.state.p1PubKeyHex,
            p2PubKeyHex: activeGame.state.p2PubKeyHex,
            wagerNanoErg: activeGame.state.wagerNanoErg.toString(),
          },
          predictedPhase: "ongoing",
          follow: {
            p1PubKeyHex: activeGame.state.p1PubKeyHex,
            p2PubKeyHex: activeGame.state.p2PubKeyHex,
            wagerNanoErg: activeGame.state.wagerNanoErg.toString(),
          },
          description: `xoxo move sub ${subIndex + 1} cell ${cellIndex + 1}`,
        };
        const ok = await signAndSubmitTx(tx, pendingTemplate);
        if (ok) setTimeout(refreshGames, 3000);
      } catch (err: any) {
        toast({
          title: "Couldn't play move",
          description: err?.message || String(err),
          status: "error",
          duration: 6000,
          isClosable: true,
        });
      }
    });
  };

  const handleCancel = async () => {
    if (!activeGame || !ergoAddress || !myPubKey) return;
    await withBusy("Building cancel transaction…", async () => {
      try {
        const tx = await buildSuperCancelGameTx({
          currentGameBox: activeGame.box,
          currentGameState: activeGame.state,
          creatorAddress: ergoAddress,
          creatorPubKeyHex: myPubKey,
        });
        const ok = await signAndSubmitTx(tx, {
          kind: "cancel",
          spentBoxId: activeGame.box.boxId,
          predicted: null,
          predictedPhase: "spent",
          follow: null,
          description: "Cancelling open xoxo game",
        });
        if (ok) {
          setActiveGame(null);
          setTimeout(refreshGames, 3000);
        }
      } catch (err: any) {
        toast({
          title: "Couldn't cancel",
          description: err?.message || String(err),
          status: "error",
          duration: 6000,
          isClosable: true,
        });
      }
    });
  };

  const handleClaimWin = async () => {
    if (!activeGame || !ergoAddress || !myPubKey) return;
    await withBusy("Building claim transaction…", async () => {
      try {
        const tx = await buildSuperClaimWinTx({
          currentGameBox: activeGame.box,
          currentGameState: activeGame.state,
          winnerAddress: ergoAddress,
          winnerPubKeyHex: myPubKey,
        });
        const ok = await signAndSubmitTx(tx, {
          kind: "claim",
          spentBoxId: activeGame.box.boxId,
          predicted: null,
          predictedPhase: "spent",
          follow: null,
          description: `Claiming xoxo pot ${formatErg(BigInt(activeGame.box.value))} ERG`,
        });
        if (ok) {
          setTimeout(refreshGames, 3000);
          setTimeout(() => setActiveGame(null), 5000);
        }
      } catch (err: any) {
        toast({
          title: "Couldn't claim",
          description: err?.message || String(err),
          status: "error",
          duration: 6000,
          isClosable: true,
        });
      }
    });
  };

  const pendingBoxIds = useMemo(
    () => new Set(pending.map((p) => p.spentBoxId).filter(Boolean) as string[]),
    [pending]
  );

  const displayGame: SuperGame | null = activeGame
    ? superChainStateToGame(activeGame.state)
    : null;
  const chainStatus = displayGame ? superStatusOf(displayGame) : null;
  const metaW = activeGame ? superWinner(activeGame.state.boards) : null;

  const myTurn =
    activeGame &&
    myPubKey &&
    activeGame.state.p1PubKeyHex !== activeGame.state.p2PubKeyHex
      ? (totalMoves(activeGame.state.boards) % 2 === 0
          ? myPubKey === activeGame.state.p1PubKeyHex
          : myPubKey === activeGame.state.p2PubKeyHex)
      : false;

  let moveDisabledReason: string | null = null;
  if (activeGame) {
    if (activeGame.phase !== "ongoing") moveDisabledReason = "Game not in progress";
    else if (!myTurn) moveDisabledReason = "Waiting for opponent";
  }

  return (
    <Stack spacing={5}>
      <Alert status="warning" borderRadius="md">
        <AlertIcon />
        <Stack spacing={1}>
          <AlertTitle>Unaudited xoxo contract</AlertTitle>
          <AlertDescription fontSize="sm">
            Separate ErgoTree from classic tic-tac-toe. Same economics: wager,
            join, moves, winner claim, draw requires co-sign. No abandonment
            timeout.
          </AlertDescription>
        </Stack>
      </Alert>

      <Text fontSize="xs" opacity={0.65}>
        Contract (P2S): <Code fontSize="xs">{truncAddr(contractAddress)}</Code>
      </Text>

      {pending.length > 0 && (
        <Stack spacing={2}>
          {pending.map((p) => {
            const elapsed = Date.now() - p.submittedAt;
            const stuck = elapsed > SUPER_STUCK_AFTER_MS;
            return (
              <Alert
                key={p.id}
                status={stuck ? "warning" : "info"}
                borderRadius="md"
                variant="left-accent"
              >
                <AlertIcon />
                <Stack spacing={1} flex="1">
                  <HStack justify="space-between">
                    <Text fontWeight="semibold" fontSize="sm">
                      {p.description}
                    </Text>
                    <Button
                      as="a"
                      size="xs"
                      variant="outline"
                      href={`${EXPLORER_TX}${p.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Explorer
                    </Button>
                  </HStack>
                  <Button
                    size="xs"
                    variant="ghost"
                    alignSelf="flex-start"
                    onClick={() => removePendingSuperTx(p.id)}
                  >
                    Dismiss
                  </Button>
                </Stack>
              </Alert>
            );
          })}
          <Button size="xs" variant="ghost" onClick={refreshGames}>
            Refresh chain state
          </Button>
        </Stack>
      )}

      {busy && (
        <Alert status="info" borderRadius="md">
          <Spinner size="sm" mr={3} />
          <AlertDescription fontSize="sm">
            {busyLabel || "Working…"}
          </AlertDescription>
        </Alert>
      )}

      {activeGame && displayGame && chainStatus ? (
        <Box
          borderWidth="1px"
          borderRadius="md"
          p={4}
          borderColor={colorMode === "light" ? "gray.200" : "whiteAlpha.300"}
        >
          <Stack spacing={4}>
            <HStack justify="space-between" flexWrap="wrap">
              <Heading size="sm">Active xoxo (on-chain)</Heading>
              <Badge>
                {chainStatus.kind === "ongoing"
                  ? `Turn: ${chainStatus.turn}`
                  : chainStatus.kind === "won"
                    ? `Won: ${chainStatus.winner}`
                    : chainStatus.kind}
              </Badge>
            </HStack>
            <Text fontSize="xs" opacity={0.75}>
              Pot: {formatErg(BigInt(activeGame.box.value))} ERG · wager each:{" "}
              {formatErg(activeGame.state.wagerNanoErg)} ERG
            </Text>
            <Flex justify="center" overflowX="auto">
              <SuperTicTacToeBoard
                game={displayGame}
                onPlay={(s, c) => void handleMove(s, c)}
                disabledReason={moveDisabledReason}
              />
            </Flex>
            <HStack flexWrap="wrap" spacing={2}>
              {activeGame.phase === "open" && myPubKey === activeGame.state.p1PubKeyHex && (
                <Button size="sm" variant="outline" onClick={handleCancel} isDisabled={busy}>
                  Cancel open game
                </Button>
              )}
              {metaW !== null && activeGame.phase === "won" && (
                <Button size="sm" colorScheme="green" onClick={handleClaimWin} isDisabled={busy}>
                  Claim win
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setActiveGame(null)}>
                Back to lobby
              </Button>
            </HStack>
          </Stack>
        </Box>
      ) : (
        <>
          <Box
            borderWidth="1px"
            borderRadius="md"
            p={4}
            borderColor={colorMode === "light" ? "gray.200" : "whiteAlpha.300"}
          >
            <Stack spacing={3}>
              <Heading size="sm">Create on-chain xoxo</Heading>
              <HStack flexWrap="wrap">
                <Text fontSize="sm" minW="90px">
                  Wager (ERG)
                </Text>
                <NumberInput
                  value={wagerErg}
                  min={MIN_WAGER_ERG}
                  step={0.01}
                  maxW="160px"
                  onChange={(_, n) => {
                    if (Number.isFinite(n)) setWagerErg(n);
                  }}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
                <Button colorScheme="blue" onClick={handleCreate} isLoading={busy} isDisabled={!myPubKey}>
                  Create game
                </Button>
              </HStack>
            </Stack>
          </Box>

          <Divider />

          <Stack spacing={3}>
            <HStack justify="space-between">
              <Heading size="sm">xoxo lobby</Heading>
              <Button size="sm" variant="ghost" onClick={refreshGames} isLoading={refreshing}>
                Refresh
              </Button>
            </HStack>
            {loading ? (
              <Flex justify="center" py={4}>
                <Spinner />
              </Flex>
            ) : projectedGames.length === 0 ? (
              <Text fontSize="sm" opacity={0.7}>
                No Ultimate games on this contract yet. Create one above.
              </Text>
            ) : (
              <Box overflowX="auto">
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th>Status</Th>
                      <Th>Wager</Th>
                      <Th>Pot</Th>
                      <Th>Creator</Th>
                      <Th></Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {projectedGames.map((g) => {
                      const addrs = getSuperPlayerAddresses(g.state);
                      const iAmP1 = myPubKey === g.state.p1PubKeyHex;
                      const iAmP2 = myPubKey === g.state.p2PubKeyHex;
                      const optimistic = g.box.boxId.startsWith("pending:");
                      const inflight = pendingBoxIds.has(g.box.boxId);
                      const canJoin =
                        g.phase === "open" &&
                        !iAmP1 &&
                        !!myPubKey &&
                        !optimistic &&
                        !inflight;
                      const sg = superChainStateToGame(g.state);
                      const st = superStatusOf(sg);
                      return (
                        <Tr key={g.box.boxId}>
                          <Td>
                            <HStack spacing={1}>
                              <Badge>
                                {g.phase === "ongoing" && st.kind === "ongoing"
                                  ? `turn ${st.turn}`
                                  : g.phase}
                              </Badge>
                              {(optimistic || inflight) && (
                                <Badge colorScheme="yellow">pending</Badge>
                              )}
                            </HStack>
                          </Td>
                          <Td fontSize="xs">{formatErg(g.state.wagerNanoErg)}</Td>
                          <Td fontSize="xs">{formatErg(BigInt(g.box.value))}</Td>
                          <Td fontSize="xs">
                            <Code>{truncAddr(addrs.p1)}</Code>
                            {iAmP1 && <Badge ml={1}>you</Badge>}
                          </Td>
                          <Td>
                            <HStack spacing={1}>
                              {canJoin && (
                                <Button size="xs" onClick={() => void handleJoin(g)}>
                                  Join
                                </Button>
                              )}
                              {(iAmP1 || iAmP2) && g.phase === "ongoing" && (
                                <Button size="xs" variant="outline" onClick={() => setActiveGame(g)}>
                                  Open
                                </Button>
                              )}
                              {g.phase === "open" && iAmP1 && (
                                <Button size="xs" variant="ghost" onClick={() => setActiveGame(g)}>
                                  Manage
                                </Button>
                              )}
                            </HStack>
                          </Td>
                        </Tr>
                      );
                    })}
                  </Tbody>
                </Table>
              </Box>
            )}
          </Stack>

          {gameHistory.length > 0 && (
            <Stack spacing={2}>
              <Heading size="sm">Recent finished xoxo</Heading>
              <Text fontSize="xs" opacity={0.65}>
                Last box snapshot before closing tx (not full move replay).
              </Text>
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>Phase</Th>
                    <Th>Block</Th>
                    <Th>Tx</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {gameHistory.slice(0, 10).map((h) => (
                    <Tr key={h.spentTransactionId}>
                      <Td>{h.phase}</Td>
                      <Td>{h.settlementHeight}</Td>
                      <Td>
                        <Button
                          as="a"
                          size="xs"
                          variant="link"
                          href={`${EXPLORER_TX}${h.spentTransactionId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {h.spentTransactionId.slice(0, 10)}…
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
};

export default SuperTicTacToeChainPanel;
