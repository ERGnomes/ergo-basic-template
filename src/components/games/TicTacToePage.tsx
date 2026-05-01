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
  FormControl,
  FormLabel,
  HStack,
  Heading,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Spinner,
  Stack,
  Switch,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  useColorMode,
  useClipboard,
  useToast,
} from "@chakra-ui/react";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { Link as RouterLink } from "react-router-dom";
import { useWallet } from "../../context/WalletContext";
import {
  statusOf,
  type Board,
  winnerOf,
  CELL_X,
  CELL_O,
} from "../../lib/games/ticTacToeLogic";
import {
  getGameP2SAddress,
} from "../../lib/games/ticTacToeContract";
import {
  DiscoveredGame,
  fetchAllGames,
  fetchRecentGameHistory,
  GameHistorySnapshot,
} from "../../lib/games/ticTacToeDiscovery";
import {
  buildCancelGameTx,
  buildClaimWinTx,
  buildCreateGameTx,
  buildDrawSplitTx,
  buildJoinGameTx,
  buildMoveTx,
  getPlayerAddresses,
} from "../../lib/games/ticTacToeTx";
import { signAndSubmit } from "../../lib/games/signAndSubmit";
import { pubKeyHexFromAddress } from "../../lib/games/pubkey";
import {
  findExistingVault,
  unlockWithPasskey,
  ErgoSecretBytes,
} from "../../lib/ergoKeyVault";
import TicTacToeBoard from "./TicTacToeBoard";
import TicTacToePractice from "./TicTacToePractice";
import {
  PendingTx,
  STUCK_AFTER_MS,
  addPendingTx,
  getPendingTxs,
  reconcilePending,
  removePendingTx,
  subscribePending,
} from "../../lib/games/pendingTx";
import { applyMove } from "../../lib/games/ticTacToeLogic";
import { recordErgoTxActivity } from "../../lib/ergoTxActivity";
import {
  gameRecordFromHistory,
  stringifyGameRecord,
} from "../../lib/games/ticTacToeGameRecord";

const NANO_PER_ERG = 1_000_000_000;
const MIN_WAGER_ERG = 0.01;
const DEFAULT_WAGER_ERG = 0.1;

const formatErg = (nano: bigint | number | string) => {
  const n = typeof nano === "bigint" ? nano : BigInt(Math.floor(Number(nano)));
  const whole = n / BigInt(NANO_PER_ERG);
  const frac = n % BigInt(NANO_PER_ERG);
  return `${whole}.${frac.toString().padStart(9, "0").replace(/0+$/, "") || "0"}`;
};

const truncAddr = (a: string) =>
  a.length > 20 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a;

type SigningKind = "nautilus" | "vault" | null;

export const TicTacToePage: React.FC = () => {
  const toast = useToast();
  const { user } = useDynamicContext();
  const { ergoAddress, source } = useWallet();

  const [games, setGames] = useState<DiscoveredGame[]>([]);
  const [gameHistory, setGameHistory] = useState<GameHistorySnapshot[]>([]);
  const [historyInspect, setHistoryInspect] = useState<GameHistorySnapshot | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeGame, setActiveGame] = useState<DiscoveredGame | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [wagerErg, setWagerErg] = useState<number>(DEFAULT_WAGER_ERG);
  const [myPubKey, setMyPubKey] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingTx[]>(() => getPendingTxs());
  const [practiceModeOpen, setPracticeModeOpen] = useState(false);

  // Subscribe to pending-tx changes anywhere in the app (cross-tab,
  // in-tab re-renders after add / remove).
  useEffect(() => {
    const unsub = subscribePending(() => setPending(getPendingTxs()));
    return unsub;
  }, []);

  // Tick once a second so elapsed-time displays keep refreshing even
  // if no other state changes.
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const contractAddress = useMemo(() => getGameP2SAddress(), []);

  // Derive the active address' pubkey once connected.
  useEffect(() => {
    let cancelled = false;
    if (!ergoAddress) {
      setMyPubKey(null);
      return;
    }
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

  const refreshGames = useCallback(async () => {
    setRefreshing(true);
    try {
      const [out, hist] = await Promise.all([
        fetchAllGames(),
        fetchRecentGameHistory(40).catch(() => [] as GameHistorySnapshot[]),
      ]);
      setGames(out);
      setGameHistory(hist);
      // Reconcile pending ops against the fresh chain snapshot so
      // confirmed ops disappear automatically.
      const unspentBoxIds = new Set(out.map((g) => g.box.boxId));
      const unspentTriples = new Set(
        out.map(
          (g) =>
            `${g.state.p1PubKeyHex}|${g.state.p2PubKeyHex}|${g.state.wagerNanoErg.toString()}`
        )
      );
      reconcilePending({ unspentBoxIds, unspentTriples });
    } catch (err: any) {
      toast({
        title: "Couldn't fetch games",
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

  // Initial fetch + adaptive polling: every 5s when any pending op is
  // outstanding, every 15s otherwise. This is a read-only Explorer
  // endpoint, well within rate limits.
  useEffect(() => {
    setLoading(true);
    refreshGames();
  }, [refreshGames]);

  useEffect(() => {
    const period = pending.length > 0 ? 5_000 : 15_000;
    const iv = setInterval(refreshGames, period);
    return () => clearInterval(iv);
  }, [refreshGames, pending.length]);

  // Project pending ops on top of the polled chain state so the UI
  // renders the user's optimistic view (their just-submitted move
  // already shows as played, the just-created game appears in the
  // lobby, etc.).
  const projectedGames: DiscoveredGame[] = useMemo(() => {
    // Map keyed by follow-triple so we can update in place.
    const byTriple = new Map<string, DiscoveredGame>();
    const tripleOf = (p1: string, p2: string, w: bigint) =>
      `${p1}|${p2}|${w.toString()}`;

    for (const g of games) {
      byTriple.set(
        tripleOf(g.state.p1PubKeyHex, g.state.p2PubKeyHex, g.state.wagerNanoErg),
        g
      );
    }

    for (const p of pending) {
      if (!p.predicted || !p.follow) continue;
      const wagerBig = BigInt(p.follow.wagerNanoErg);
      const key = tripleOf(p.follow.p1PubKeyHex, p.follow.p2PubKeyHex, wagerBig);
      const existing = byTriple.get(key);
      // Compose an overlay DiscoveredGame: preserve the existing box
      // metadata so "Pot" and Explorer links remain realistic, but
      // overwrite the game state with the predicted next board/phase.
      const overlay: DiscoveredGame = existing
        ? {
            box: existing.box,
            state: {
              board: p.predicted.board,
              p1PubKeyHex: p.predicted.p1PubKeyHex,
              p2PubKeyHex: p.predicted.p2PubKeyHex,
              wagerNanoErg: wagerBig,
            },
            phase:
              p.predictedPhase === "spent" ? existing.phase : p.predictedPhase,
            isJoined:
              p.predicted.p1PubKeyHex !== p.predicted.p2PubKeyHex,
          }
        : {
            // The successor box doesn't exist yet (create case). Fake
            // a placeholder box so the lobby can render it with a
            // "pending" badge.
            box: {
              boxId: `pending:${p.id}`,
              value: (
                BigInt(p.predicted.wagerNanoErg) +
                BigInt(3_000_000) // approx safeMin; purely cosmetic
              ).toString(),
            },
            state: {
              board: p.predicted.board,
              p1PubKeyHex: p.predicted.p1PubKeyHex,
              p2PubKeyHex: p.predicted.p2PubKeyHex,
              wagerNanoErg: wagerBig,
            },
            phase: p.predictedPhase === "spent" ? "open" : p.predictedPhase,
            isJoined:
              p.predicted.p1PubKeyHex !== p.predicted.p2PubKeyHex,
          };
      byTriple.set(key, overlay);
    }

    return Array.from(byTriple.values());
  }, [games, pending]);

  const pendingBoxIdsBeingSpent = useMemo(
    () => new Set(pending.map((p) => p.spentBoxId).filter(Boolean) as string[]),
    [pending]
  );

  // Keep the active game in sync as the chain advances — follows by
  // the (p1, p2, wager) triple so both real and optimistic projections
  // keep the board rendered as expected.
  useEffect(() => {
    if (!activeGame) return;
    const followed = projectedGames.find(
      (g) =>
        g.state.p1PubKeyHex === activeGame.state.p1PubKeyHex &&
        g.state.p2PubKeyHex === activeGame.state.p2PubKeyHex &&
        g.state.wagerNanoErg === activeGame.state.wagerNanoErg
    );
    if (followed && followed !== activeGame) setActiveGame(followed);
    // else: the game has been fully resolved and no unspent box remains.
    // Leave activeGame at its last known state so the claim result
    // stays visible in the UI.
  }, [projectedGames, activeGame]);

  // ------------------------------------------------------------------
  // Signing helper: wraps unlock-if-vault + signAndSubmit, then adds
  // a PendingTx record if the caller supplied `pendingTemplate`.
  // ------------------------------------------------------------------
  const signAndSubmitTx = async (
    prepared: { unsignedEip12: any; inputBoxes: any[] },
    pendingTemplate: Omit<PendingTx, "id" | "submittedAt"> | null
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
            text:
              "No vault on this device. Provision your vault on /dynamic before playing with email.",
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
        addPendingTx({
          ...pendingTemplate,
          id: res.txId,
          submittedAt,
        });
        recordErgoTxActivity({
          txId: res.txId,
          label: `Tic-tac-toe · ${pendingTemplate.description}`,
          submittedAt,
        });
      }
      toast({
        title: "Submitted to mempool",
        description:
          res.txId
            ? `tx ${res.txId.slice(0, 10)}… — waiting for confirmation (1–3 min)`
            : "Waiting for confirmation (1–3 min).",
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

  // ------------------------------------------------------------------
  // Action handlers.
  // ------------------------------------------------------------------

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
        const tx = await buildCreateGameTx({
          creatorAddress: ergoAddress,
          creatorPubKeyHex: myPubKey,
          wagerNanoErg,
        });
        const pendingTemplate: Omit<PendingTx, "id" | "submittedAt"> = {
          kind: "create",
          spentBoxId: null,
          predicted: {
            board: [0, 0, 0, 0, 0, 0, 0, 0, 0] as any,
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
          description: `Creating game with ${wagerErg} ERG wager`,
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

  const handleJoin = async (game: DiscoveredGame) => {
    if (!ergoAddress || !myPubKey) return;
    await withBusy("Building join transaction…", async () => {
      try {
        const tx = await buildJoinGameTx({
          currentGameBox: game.box,
          currentGameState: game.state,
          joinerAddress: ergoAddress,
          joinerPubKeyHex: myPubKey,
        });
        const pendingTemplate: Omit<PendingTx, "id" | "submittedAt"> = {
          kind: "join",
          spentBoxId: game.box.boxId,
          predicted: {
            board: game.state.board,
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
          description: `Joining game for ${formatErg(game.state.wagerNanoErg)} ERG`,
        };
        const ok = await signAndSubmitTx(tx, pendingTemplate);
        if (ok) {
          setActiveGame({
            ...game,
            state: {
              ...game.state,
              p2PubKeyHex: myPubKey,
            },
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

  const handleMove = async (cell: number) => {
    if (!activeGame || !ergoAddress || !myPubKey) return;
    await withBusy("Building move transaction…", async () => {
      try {
        const tx = await buildMoveTx({
          currentGameBox: activeGame.box,
          currentGameState: activeGame.state,
          moverAddress: ergoAddress,
          moverPubKeyHex: myPubKey,
          cell,
        });
        const predictedBoard = applyMove(activeGame.state.board, cell);
        const pendingTemplate: Omit<PendingTx, "id" | "submittedAt"> = {
          kind: "move",
          spentBoxId: activeGame.box.boxId,
          predicted: {
            board: predictedBoard,
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
          description: `Playing cell ${cell + 1}`,
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
        const tx = await buildCancelGameTx({
          currentGameBox: activeGame.box,
          currentGameState: activeGame.state,
          creatorAddress: ergoAddress,
          creatorPubKeyHex: myPubKey,
        });
        const pendingTemplate: Omit<PendingTx, "id" | "submittedAt"> = {
          kind: "cancel",
          spentBoxId: activeGame.box.boxId,
          predicted: null,
          predictedPhase: "spent",
          follow: {
            p1PubKeyHex: activeGame.state.p1PubKeyHex,
            p2PubKeyHex: activeGame.state.p1PubKeyHex,
            wagerNanoErg: activeGame.state.wagerNanoErg.toString(),
          },
          description: `Cancelling game (refund ${formatErg(
            BigInt(activeGame.box.value)
          )} ERG)`,
        };
        const ok = await signAndSubmitTx(tx, pendingTemplate);
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

  const handleClaimWin = async (gameOverride?: DiscoveredGame | null) => {
    const g = gameOverride ?? activeGame;
    if (!g || !ergoAddress || !myPubKey) return;
    await withBusy("Building claim transaction…", async () => {
      try {
        const tx = await buildClaimWinTx({
          currentGameBox: g.box,
          currentGameState: g.state,
          winnerAddress: ergoAddress,
          winnerPubKeyHex: myPubKey,
        });
        const pendingTemplate: Omit<PendingTx, "id" | "submittedAt"> = {
          kind: "claim",
          spentBoxId: g.box.boxId,
          predicted: null,
          predictedPhase: "spent",
          follow: {
            p1PubKeyHex: g.state.p1PubKeyHex,
            p2PubKeyHex: g.state.p2PubKeyHex,
            wagerNanoErg: g.state.wagerNanoErg.toString(),
          },
          description: `Claiming ${formatErg(BigInt(g.box.value))} ERG pot`,
        };
        const ok = await signAndSubmitTx(tx, pendingTemplate);
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

  const handleDrawSplit = async (gameOverride?: DiscoveredGame | null) => {
    const g = gameOverride ?? activeGame;
    if (!g || !ergoAddress || !myPubKey) return;
    await withBusy("Building draw split transaction…", async () => {
      try {
        const addrs = getPlayerAddresses(g.state);
        const p1Addr = addrs.p1;
        const p2Addr = addrs.p2;
        if (!p2Addr) {
          toast({ title: "Opponent address unknown", status: "error" });
          return;
        }
        const tx = await buildDrawSplitTx({
          currentGameBox: g.box,
          currentGameState: g.state,
          p1Address: p1Addr,
          p2Address: p2Addr,
          signerPubKeyHex: myPubKey,
        });
        const pendingTemplate: Omit<PendingTx, "id" | "submittedAt"> = {
          kind: "draw",
          spentBoxId: g.box.boxId,
          predicted: null,
          predictedPhase: "spent",
          follow: {
            p1PubKeyHex: g.state.p1PubKeyHex,
            p2PubKeyHex: g.state.p2PubKeyHex,
            wagerNanoErg: g.state.wagerNanoErg.toString(),
          },
          description: "Draw — split pot (needs both signatures)",
        };
        const ok = await signAndSubmitTx(tx, pendingTemplate);
        if (ok) {
          toast({
            title: "Your signature is attached",
            description:
              "Your opponent must open the same game and sign the same draw split (Nautilus merges signatures when both halves match).",
            status: "info",
            duration: 12000,
            isClosable: true,
          });
          setTimeout(refreshGames, 3000);
        }
      } catch (err: any) {
        toast({
          title: "Couldn't build draw transaction",
          description: err?.message || String(err),
          status: "error",
          duration: 8000,
          isClosable: true,
        });
      }
    });
  };

  // ------------------------------------------------------------------
  // Render.
  // ------------------------------------------------------------------

  // Page shell: header + optional practice board + warnings. The on-chain
  // lobby only layers on top once the user is connected.
  //
  // Note: we don't UA-sniff for Firefox any more — modern Firefox has
  // shipped WebAuthn PRF, and if a specific browser/authenticator
  // combination doesn't support it, the actual PRF call in the vault
  // flow will error with a descriptive message that the UI surfaces.
  const pageHeader = (
    <>
      <Stack spacing={1}>
        <Heading size="lg">Ergo Tic-Tac-Toe</Heading>
        <Text fontSize="sm" opacity={0.8}>
          On-chain multiplayer game. Every move is a real Ergo
          transaction. You need TWO different wallets to play a real
          game — the contract won't let you join your own open game.
        </Text>
        <Button
          as={RouterLink}
          to="/games/xoxo"
          size="sm"
          variant="link"
          alignSelf="flex-start"
        >
          Ultimate (xoxo) on-chain →
        </Button>
        <Text fontSize="xs" opacity={0.6}>
          Contract: <Code fontSize="xs">{truncAddr(contractAddress)}</Code>
        </Text>
      </Stack>

      <Alert status="warning" borderRadius="md">
        <AlertIcon />
        <Stack spacing={1}>
          <AlertTitle>Unaudited smart contract</AlertTitle>
          <AlertDescription fontSize="sm">
            Enforces strict two-player turns, winner-takes-all, and
            creator-cancel, but has NO abandonment timeout — if your
            opponent stops playing, your wager is stuck until they
            sign again. Test with tiny wagers first.
          </AlertDescription>
        </Stack>
      </Alert>

      <Stack spacing={2}>
        <FormControl display="flex" alignItems="center" gap={3}>
          <FormLabel htmlFor="tic-practice-mode" mb={0} fontWeight="medium">
            Show practice mode
          </FormLabel>
          <Switch
            id="tic-practice-mode"
            isChecked={practiceModeOpen}
            onChange={(e) => setPracticeModeOpen(e.target.checked)}
            colorScheme="purple"
          />
        </FormControl>
        <Text fontSize="sm" opacity={0.75}>
          Turn this on to try the board locally — no wallet or ERG. Handy for
          testing the UI or explaining the rules before you wager on-chain.
        </Text>
        {practiceModeOpen ? <TicTacToePractice /> : null}
      </Stack>
    </>
  );

  if (!ergoAddress) {
    return (
      <Box maxW="900px" mx="auto" mt={6} p={6}>
        <VStack align="stretch" spacing={5}>
          {pageHeader}
          <Alert status="info" borderRadius="md">
            <AlertIcon />
            <AlertDescription fontSize="sm">
              Sign in from the <Code>Dashboard</Code> or{" "}
              <Code>Dynamic Login</Code> page (with email or Nautilus)
              to create and join real on-chain games. Enable{" "}
              <strong>Show practice mode</strong> above to try the board
              without a wallet.
            </AlertDescription>
          </Alert>
        </VStack>
      </Box>
    );
  }

  return (
    <Box maxW="900px" mx="auto" mt={6} p={6}>
      <VStack align="stretch" spacing={5}>
        {pageHeader}

        <PendingBanner
          pending={pending}
          busy={busy}
          busyLabel={busyLabel}
          onDismiss={(id) => removePendingTx(id)}
          onRefresh={refreshGames}
        />

        {activeGame ? (
          <ActiveGameView
            game={activeGame}
            myPubKey={myPubKey}
            busy={busy}
            busyLabel={busyLabel}
            pending={pending.filter(
              (p) =>
                p.follow &&
                p.follow.p1PubKeyHex === activeGame.state.p1PubKeyHex &&
                (p.follow.p2PubKeyHex === activeGame.state.p2PubKeyHex ||
                  p.kind === "cancel" ||
                  p.kind === "claim" ||
                  p.kind === "draw")
            )}
            onMove={handleMove}
            onCancel={handleCancel}
            onClaimWin={() => void handleClaimWin()}
            onDrawSplit={() => void handleDrawSplit()}
            onBack={() => setActiveGame(null)}
          />
        ) : (
          <>
            <CreateGameForm
              busy={busy || !myPubKey}
              wagerErg={wagerErg}
              onWagerChange={setWagerErg}
              onCreate={handleCreate}
            />
            <Divider />
            <GameHistoryRail
              history={gameHistory}
              onInspect={setHistoryInspect}
            />
            <FinishedGameModal
              game={historyInspect}
              onClose={() => setHistoryInspect(null)}
              contractAddress={contractAddress}
            />
            <Divider />
            <GameList
              games={projectedGames}
              loading={loading}
              refreshing={refreshing}
              myPubKey={myPubKey}
              onRefresh={refreshGames}
              onJoin={handleJoin}
              onOpen={setActiveGame}
              onClaimFromLobby={(g) => void handleClaimWin(g)}
              onDrawSplitFromLobby={(g) => void handleDrawSplit(g)}
              busy={busy}
              pendingBoxIdsBeingSpent={pendingBoxIdsBeingSpent}
            />
          </>
        )}
      </VStack>
    </Box>
  );
};

// ====================================================================

const EXPLORER_TX_URL = "https://explorer.ergoplatform.com/en/transactions/";

interface GameHistoryRailProps {
  history: GameHistorySnapshot[];
  onInspect: (row: GameHistorySnapshot) => void;
}

const GameHistoryRail: React.FC<GameHistoryRailProps> = ({
  history,
  onInspect,
}) => {
  const { colorMode } = useColorMode();
  const border = colorMode === "light" ? "gray.200" : "whiteAlpha.300";

  const labelFor = (h: GameHistorySnapshot): string => {
    if (h.phase === "open") return "Cancelled (never joined)";
    if (h.phase === "won") return "Won (claimed)";
    if (h.phase === "drawn") return "Draw (archived)";
    return h.phase;
  };

  return (
    <Box borderWidth="1px" borderRadius="md" p={4} borderColor={border}>
      <Stack spacing={2}>
        <Heading size="sm">Recent finished games</Heading>
        <Text fontSize="xs" opacity={0.75}>
          On-chain boxes at this contract that were later spent (cancel,
          claim, etc.). Mid-move spends are hidden so this reads as a
          simple activity log — not every intermediate board state. Use{" "}
          <strong>View board</strong> for the final snapshot;{" "}
          <strong>Copy standard record</strong> exports versioned JSON (
          <Code fontSize="xs">schemaVersion: 1</Code>) for tools or archives.
        </Text>
        {history.length === 0 ? (
          <Text fontSize="sm" opacity={0.6}>
            No archived rows yet, or Explorer returned none. Play a few
            matches and refresh; the list fills from the public indexer
            (no backend).
          </Text>
        ) : (
          <Box overflowX="auto">
            <Table size="sm" variant="simple">
              <Thead>
                <Tr>
                  <Th>Outcome</Th>
                  <Th>Block</Th>
                  <Th>Wager</Th>
                  <Th>Pot (last box)</Th>
                  <Th>Closing tx</Th>
                  <Th></Th>
                </Tr>
              </Thead>
              <Tbody>
                {history.map((h) => (
                  <Tr key={`${h.box.boxId}-${h.spentTransactionId}`}>
                    <Td>
                      <Badge
                        colorScheme={
                          h.phase === "won"
                            ? "green"
                            : h.phase === "drawn"
                            ? "gray"
                            : "orange"
                        }
                      >
                        {labelFor(h)}
                      </Badge>
                    </Td>
                    <Td fontSize="xs">{h.settlementHeight}</Td>
                    <Td fontSize="xs">{formatErg(h.state.wagerNanoErg)}</Td>
                    <Td fontSize="xs">{formatErg(BigInt(h.box.value))}</Td>
                    <Td fontSize="xs">
                      <Button
                        as="a"
                        size="xs"
                        variant="link"
                        href={`${EXPLORER_TX_URL}${h.spentTransactionId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {h.spentTransactionId.slice(0, 10)}…
                      </Button>
                    </Td>
                    <Td>
                      <Button size="xs" onClick={() => onInspect(h)}>
                        View board
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
      </Stack>
    </Box>
  );
};

interface FinishedGameModalProps {
  game: GameHistorySnapshot | null;
  onClose: () => void;
  contractAddress: string;
}

const FinishedGameModal: React.FC<FinishedGameModalProps> = ({
  game,
  onClose,
  contractAddress,
}) => {
  const toast = useToast();
  const recordJson = game
    ? stringifyGameRecord(gameRecordFromHistory(game, contractAddress))
    : "";
  const { onCopy, hasCopied } = useClipboard(recordJson);

  if (!game) return null;

  const addrs = getPlayerAddresses(game.state);
  const st = statusOf(game.state.board, !game.isJoined);
  const label =
    game.phase === "open"
      ? "Cancelled (never joined)"
      : game.phase === "won"
      ? "Won (claimed)"
      : game.phase === "drawn"
      ? "Draw (archived)"
      : "Ongoing (final snapshot)";

  return (
    <Modal isOpen onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Finished game</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <HStack>
              <Badge
                colorScheme={
                  game.phase === "won"
                    ? "green"
                    : game.phase === "drawn"
                    ? "gray"
                    : "orange"
                }
              >
                {label}
              </Badge>
              <Text fontSize="xs" opacity={0.7}>
                Block {game.settlementHeight}
              </Text>
            </HStack>
            <Text fontSize="sm" opacity={0.85}>
              This is the <strong>last on-chain box</strong> before the closing
              transaction — not every intermediate move. For a full replay you
              would index each spend in the chain (future work).
            </Text>
            <Flex justify="center">
              <TicTacToeBoard
                board={game.state.board as Board}
                readOnly
                highlightMovable={false}
              />
            </Flex>
            <Stack spacing={1} fontSize="sm">
              <Text>
                <strong>Wager (each):</strong> {formatErg(game.state.wagerNanoErg)} ERG
              </Text>
              <Text>
                <strong>Pot (this box):</strong> {formatErg(BigInt(game.box.value))} ERG
              </Text>
              <Text>
                <strong>X (creator):</strong>{" "}
                <Code fontSize="xs">{truncAddr(addrs.p1)}</Code>
              </Text>
              <Text>
                <strong>O:</strong>{" "}
                {addrs.p2 ? (
                  <Code fontSize="xs">{truncAddr(addrs.p2)}</Code>
                ) : (
                  <Text as="span" opacity={0.6}>
                    —
                  </Text>
                )}
              </Text>
              {st.kind === "ongoing" && (
                <Text fontSize="xs" opacity={0.75}>
                  Turn at this snapshot: <strong>{st.turn}</strong>
                </Text>
              )}
              <Text fontSize="xs" wordBreak="break-all">
                <strong>Box:</strong> <Code fontSize="xs">{game.box.boxId}</Code>
              </Text>
              <Text fontSize="xs" wordBreak="break-all">
                <strong>Contract:</strong>{" "}
                <Code fontSize="xs">{truncAddr(contractAddress)}</Code>
              </Text>
              <Button
                as="a"
                size="xs"
                variant="link"
                href={`${EXPLORER_TX_URL}${game.spentTransactionId}`}
                target="_blank"
                rel="noopener noreferrer"
                alignSelf="flex-start"
              >
                Closing transaction on Explorer
              </Button>
            </Stack>
          </Stack>
        </ModalBody>
        <ModalFooter gap={2}>
          <Button
            onClick={() => {
              onCopy();
              toast({ title: "Copied game record (JSON)", status: "success", duration: 2000 });
            }}
          >
            {hasCopied ? "Copied" : "Copy standard record (JSON)"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

interface PendingBannerProps {
  pending: PendingTx[];
  busy: boolean;
  busyLabel: string | null;
  onDismiss: (id: string) => void;
  onRefresh: () => void;
}

const formatElapsed = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m}m ${rs}s`;
};

const PendingBanner: React.FC<PendingBannerProps> = ({
  pending,
  busy,
  busyLabel,
  onDismiss,
  onRefresh,
}) => {
  // Nothing to show.
  if (pending.length === 0 && !busy) return null;

  return (
    <Stack spacing={2}>
      {busy && (
        <Alert status="info" borderRadius="md">
          <Spinner size="sm" mr={3} />
          <AlertDescription fontSize="sm">
            {busyLabel || "Working…"} Your wallet may prompt you to sign.
          </AlertDescription>
        </Alert>
      )}
      {pending.map((p) => {
        const elapsed = Date.now() - p.submittedAt;
        const stuck = elapsed > STUCK_AFTER_MS;
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
                <HStack spacing={2}>
                  <Badge colorScheme={stuck ? "yellow" : "blue"}>
                    {formatElapsed(elapsed)}
                  </Badge>
                  <Button
                    as="a"
                    size="xs"
                    variant="outline"
                    href={`${EXPLORER_TX_URL}${p.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Explorer
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => onDismiss(p.id)}
                  >
                    Dismiss
                  </Button>
                </HStack>
              </HStack>
              <Text fontSize="xs" opacity={0.8}>
                {stuck
                  ? "This tx has been in the mempool for a while. Either the network is congested, or it was evicted — click Explorer to check. Your optimistic move will keep showing until the chain catches up; dismiss once you've confirmed the outcome."
                  : "Submitted to the Ergo mempool. Each block is 1–3 minutes; the board will reflect this once it confirms. The lobby polls every 5 seconds while a tx is pending."}
              </Text>
              <Text fontSize="xs" opacity={0.55}>
                txId: <Code fontSize="xs">{p.id.slice(0, 16)}…</Code>
              </Text>
            </Stack>
          </Alert>
        );
      })}
      {pending.length > 0 && (
        <HStack justify="flex-end">
          <Button size="xs" variant="ghost" onClick={onRefresh}>
            Check again now
          </Button>
        </HStack>
      )}
    </Stack>
  );
};

// ====================================================================

interface CreateFormProps {
  busy: boolean;
  wagerErg: number;
  onWagerChange: (v: number) => void;
  onCreate: () => void;
}

const CreateGameForm: React.FC<CreateFormProps> = ({
  busy,
  wagerErg,
  onWagerChange,
  onCreate,
}) => {
  const { colorMode } = useColorMode();
  return (
    <Box
      borderWidth="1px"
      borderRadius="md"
      p={4}
      borderColor={colorMode === "light" ? "gray.200" : "whiteAlpha.300"}
    >
      <Stack spacing={3}>
        <Heading size="sm">Create a new game</Heading>
        <Text fontSize="sm" opacity={0.85}>
          You'll lock your wager into the game contract. A matching
          wager from the joiner is required. Winner takes the whole pot;
          if it ends in a draw both players must co-sign to split.
        </Text>
        <Text fontSize="xs" opacity={0.6}>
          The contract blocks you from joining your own game — to
          actually play, share the lobby URL with someone else (or
          use a second wallet on another device / browser).
        </Text>
        <HStack>
          <Text fontSize="sm" minW="100px">
            Wager (ERG)
          </Text>
          <NumberInput
            value={wagerErg}
            min={MIN_WAGER_ERG}
            step={0.01}
            precision={3}
            maxW="160px"
            onChange={(_, n) => {
              if (Number.isFinite(n)) onWagerChange(n);
            }}
          >
            <NumberInputField />
            <NumberInputStepper>
              <NumberIncrementStepper />
              <NumberDecrementStepper />
            </NumberInputStepper>
          </NumberInput>
          <Button
            colorScheme="blue"
            onClick={onCreate}
            isLoading={busy}
          >
            Create game
          </Button>
        </HStack>
      </Stack>
    </Box>
  );
};

// ====================================================================

interface GameListProps {
  games: DiscoveredGame[];
  loading: boolean;
  refreshing: boolean;
  myPubKey: string | null;
  onRefresh: () => void;
  onJoin: (g: DiscoveredGame) => void;
  onOpen: (g: DiscoveredGame) => void;
  onClaimFromLobby: (g: DiscoveredGame) => void;
  onDrawSplitFromLobby: (g: DiscoveredGame) => void;
  busy: boolean;
  pendingBoxIdsBeingSpent: Set<string>;
}

const GameList: React.FC<GameListProps> = ({
  games,
  loading,
  refreshing,
  myPubKey,
  onRefresh,
  onJoin,
  onOpen,
  onClaimFromLobby,
  onDrawSplitFromLobby,
  busy,
  pendingBoxIdsBeingSpent,
}) => {
  if (loading) {
    return (
      <Flex justify="center" py={4}>
        <Spinner />
      </Flex>
    );
  }
  return (
    <Stack spacing={3}>
      <HStack justify="space-between">
        <Heading size="sm">Games on-chain</Heading>
        <Button size="sm" variant="ghost" onClick={onRefresh} isLoading={refreshing}>
          Refresh
        </Button>
      </HStack>
      {games.length === 0 ? (
        <Stack spacing={2}>
          <Text fontSize="sm" opacity={0.7}>
            No games on-chain yet. Create one with the form above — your
            wager will be locked in the contract until someone else
            joins.
          </Text>
          <Text fontSize="xs" opacity={0.55}>
            To play against yourself for testing, turn on{" "}
            <strong>Show practice mode</strong> at the top of the page.
            The contract requires two different wallets for real games,
            so you'd need Nautilus in one browser and Dynamic email-login
            in another (or two Dynamic accounts).
          </Text>
        </Stack>
      ) : (
        <Box overflowX="auto">
          <Table size="sm" variant="simple">
            <Thead>
              <Tr>
                <Th>Status</Th>
                <Th>Wager</Th>
                <Th>Pot</Th>
                <Th>Creator</Th>
                <Th>Opponent</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <Tbody>
              {games.map((g) => {
                const st = statusOf(g.state.board, !g.isJoined);
                const addrs = getPlayerAddresses(g.state);
                const iAmP1 = myPubKey === g.state.p1PubKeyHex;
                const iAmP2 =
                  myPubKey !== null && myPubKey === g.state.p2PubKeyHex;
                const iAmParticipant = iAmP1 || iAmP2;
                const isOptimistic = g.box.boxId.startsWith("pending:");
                const hasInflightSpend = pendingBoxIdsBeingSpent.has(
                  g.box.boxId
                );
                const canJoin =
                  g.phase === "open" &&
                  !iAmP1 &&
                  !!myPubKey &&
                  !isOptimistic &&
                  !hasInflightSpend;
                const w = winnerOf(g.state.board);
                const canClaimFromLobby =
                  g.phase === "won" &&
                  iAmParticipant &&
                  w !== null &&
                  ((w === CELL_X && iAmP1) || (w === CELL_O && iAmP2));
                const canDrawFromLobby =
                  g.phase === "drawn" && iAmParticipant && !isOptimistic;
                return (
                  <Tr key={g.box.boxId}>
                    <Td>
                      <HStack spacing={1}>
                        <Badge
                          colorScheme={
                            g.phase === "open"
                              ? "blue"
                              : g.phase === "ongoing"
                              ? "purple"
                              : g.phase === "won"
                              ? "green"
                              : "gray"
                          }
                        >
                          {g.phase === "ongoing"
                            ? `turn: ${st.kind === "ongoing" ? st.turn : "?"}`
                            : g.phase}
                        </Badge>
                        {(isOptimistic || hasInflightSpend) && (
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
                    <Td fontSize="xs">
                      {addrs.p2 ? (
                        <>
                          <Code>{truncAddr(addrs.p2)}</Code>
                          {iAmP2 && <Badge ml={1}>you</Badge>}
                        </>
                      ) : (
                        <Text fontSize="xs" opacity={0.5}>
                          —
                        </Text>
                      )}
                    </Td>
                    <Td>
                      <HStack spacing={1}>
                        <Button size="xs" variant="outline" onClick={() => onOpen(g)}>
                          Open
                        </Button>
                        {canJoin && (
                          <Button
                            size="xs"
                            colorScheme="blue"
                            onClick={() => onJoin(g)}
                            isDisabled={busy}
                          >
                            Join
                          </Button>
                        )}
                        {iAmParticipant && g.phase === "ongoing" && (
                          <Button
                            size="xs"
                            colorScheme="purple"
                            onClick={() => onOpen(g)}
                          >
                            Play
                          </Button>
                        )}
                        {canClaimFromLobby && (
                          <Button
                            size="xs"
                            colorScheme="green"
                            onClick={() => onClaimFromLobby(g)}
                            isDisabled={busy}
                          >
                            Claim
                          </Button>
                        )}
                        {canDrawFromLobby && (
                          <Button
                            size="xs"
                            colorScheme="purple"
                            onClick={() => onDrawSplitFromLobby(g)}
                            isDisabled={busy}
                          >
                            Sign draw
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
  );
};

// ====================================================================

interface ActiveViewProps {
  game: DiscoveredGame;
  myPubKey: string | null;
  busy: boolean;
  busyLabel: string | null;
  pending: PendingTx[];
  onMove: (cell: number) => void;
  onCancel: () => void;
  onClaimWin: () => void;
  onDrawSplit: () => void;
  onBack: () => void;
}

const ActiveGameView: React.FC<ActiveViewProps> = ({
  game,
  myPubKey,
  busy,
  busyLabel,
  pending,
  onMove,
  onCancel,
  onClaimWin,
  onDrawSplit,
  onBack,
}) => {
  const { colorMode } = useColorMode();
  const status = statusOf(game.state.board, !game.isJoined);
  const iAmP1 = myPubKey === game.state.p1PubKeyHex;
  const iAmP2 = myPubKey !== null && myPubKey === game.state.p2PubKeyHex;
  const mySymbol = iAmP1 ? "X" : iAmP2 ? "O" : null;
  const addrs = getPlayerAddresses(game.state);

  const hasPendingForThisGame = pending.length > 0;
  const primaryPending =
    pending.find((p) => p.kind === "move") ?? pending[0] ?? null;

  let disabledReason: string | null = null;
  if (status.kind === "open") {
    disabledReason = "Waiting for a second player to join";
  } else if (status.kind === "won") {
    disabledReason = `Game over — ${status.winner} won`;
  } else if (status.kind === "drawn") {
    disabledReason = "Game ended in a draw";
  } else if (!mySymbol) {
    disabledReason = "You are not a participant";
  } else if (status.turn !== mySymbol) {
    disabledReason = `Waiting for ${status.turn}'s move`;
  } else if (busy) {
    disabledReason = busyLabel || "Submitting…";
  } else if (hasPendingForThisGame) {
    disabledReason =
      "Waiting for the previous transaction to confirm (1–3 min)";
  }

  const canClaimWin =
    status.kind === "won" &&
    ((status.winner === "X" && iAmP1) || (status.winner === "O" && iAmP2));
  const canDrawSplit =
    status.kind === "drawn" && (iAmP1 || iAmP2);
  const canCancel = status.kind === "open" && iAmP1;

  return (
    <Box
      borderWidth="1px"
      borderRadius="md"
      p={5}
      borderColor={colorMode === "light" ? "gray.200" : "whiteAlpha.300"}
    >
      <VStack spacing={4} align="stretch">
        <HStack justify="space-between">
          <Button size="sm" variant="ghost" onClick={onBack}>
            ← Lobby
          </Button>
          <Badge
            colorScheme={
              status.kind === "won"
                ? "green"
                : status.kind === "drawn"
                ? "gray"
                : status.kind === "open"
                ? "blue"
                : "purple"
            }
          >
            {status.kind === "ongoing"
              ? hasPendingForThisGame
                ? `turn: ${status.turn} · tx confirming`
                : `turn: ${status.turn}`
              : status.kind}
          </Badge>
        </HStack>

        {hasPendingForThisGame && primaryPending && (
          <Alert status="info" borderRadius="md" variant="subtle" py={2}>
            <AlertIcon />
            <Box>
              <AlertTitle fontSize="sm">
                Last action — waiting for block confirmation
              </AlertTitle>
              <AlertDescription fontSize="xs">
                <strong>{primaryPending.description}</strong> is in the mempool.
                The board shows your optimistic result; the official turn and
                cell unlock update once Ergo includes the transaction (often
                1–3 minutes). Use the blue banner above for Explorer and elapsed
                time.
              </AlertDescription>
            </Box>
          </Alert>
        )}

        <Stack spacing={0.5} fontSize="sm">
          <Text>
            <strong>Wager each:</strong> {formatErg(game.state.wagerNanoErg)} ERG
          </Text>
          <Text>
            <strong>Pot on chain:</strong> {formatErg(BigInt(game.box.value))} ERG
          </Text>
          <Text>
            <strong>X (creator):</strong>{" "}
            <Code fontSize="xs">{truncAddr(addrs.p1)}</Code>
            {iAmP1 && <Badge ml={2}>you</Badge>}
          </Text>
          <Text>
            <strong>O (opponent):</strong>{" "}
            {addrs.p2 ? (
              <>
                <Code fontSize="xs">{truncAddr(addrs.p2)}</Code>
                {iAmP2 && <Badge ml={2}>you</Badge>}
              </>
            ) : (
              <Text as="span" opacity={0.6}>
                waiting…
              </Text>
            )}
          </Text>
        </Stack>

        <Flex justify="center" py={2}>
          <TicTacToeBoard
            board={game.state.board}
            onPlay={onMove}
            disabledReason={disabledReason}
          />
        </Flex>

        <HStack justify="center" spacing={3}>
          {canCancel && (
            <Button
              variant="outline"
              colorScheme="red"
              onClick={onCancel}
              isLoading={busy}
            >
              Cancel & recover wager
            </Button>
          )}
          {canClaimWin && (
            <Button colorScheme="green" onClick={onClaimWin} isLoading={busy}>
              Claim pot ({formatErg(BigInt(game.box.value))} ERG)
            </Button>
          )}
          {canDrawSplit && (
            <Button colorScheme="purple" variant="solid" onClick={onDrawSplit} isLoading={busy}>
              Sign draw split (50/50 + fee)
            </Button>
          )}
        </HStack>
      </VStack>
    </Box>
  );
};

export default TicTacToePage;
