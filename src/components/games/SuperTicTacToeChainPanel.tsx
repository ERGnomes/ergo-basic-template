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
  SimpleGrid,
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
  findCurrentSuperBoxForGame,
} from "../../lib/games/superTicTacToeDiscovery";
import {
  getSuperGameP2SAddress,
  superChainStateToGame,
  type SuperChainGameState,
} from "../../lib/games/superTicTacToeContract";
import {
  applySuperMove,
  isLegalSuperMove,
  superMetaFull,
  superStatusOf,
  superWinner,
  totalMoves,
  type SuperBoard,
  type SuperGame,
} from "../../lib/games/superTicTacToeLogic";
import { CELL_O, CELL_X } from "../../lib/games/ticTacToeLogic";
import {
  buildSuperCancelGameTx,
  buildSuperClaimWinTx,
  buildSuperCreateGameTx,
  buildSuperDrawSplitTx,
  buildSuperJoinGameTx,
  buildSuperMoveTx,
  getSuperPlayerAddresses,
} from "../../lib/games/superTicTacToeTx";
import { signAndSubmit } from "../../lib/games/signAndSubmit";
import { pubKeyHexFromAddress } from "../../lib/games/pubkey";
import { RECOMMENDED_MIN_FEE_VALUE } from "@fleet-sdk/core";
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

const potNano = (g: DiscoveredSuperGame) => BigInt(g.box.value);

const splitAfterFee = (pot: bigint) => {
  const fee = RECOMMENDED_MIN_FEE_VALUE;
  const after = pot - fee;
  if (after <= BigInt(0)) return null;
  const half = after / BigInt(2);
  const rem = after % BigInt(2);
  return { fee, toP1: half + rem, toP2: half };
};

const outcomeLabel = (g: DiscoveredSuperGame): string => {
  if (g.phase === "open") return "Open seat";
  if (g.phase === "ongoing") {
    const sg = superChainStateToGame(g.state);
    const st = superStatusOf(sg);
    return st.kind === "ongoing" ? `Live · ${st.turn} to move` : g.phase;
  }
  if (g.phase === "won") {
    const w = superWinner(g.state.boards);
    if (w === CELL_X) return "X won meta (claim)";
    if (w === CELL_O) return "O won meta (claim)";
    return "Won (claim)";
  }
  return "Draw (split)";
};

const prizeSummary = (g: DiscoveredSuperGame): string => {
  const pot = potNano(g);
  if (g.phase === "open") {
    return `Creator locked ≈ ${formatErg(pot)} ERG; join matches wager.`;
  }
  if (g.phase === "ongoing") {
    return `Pot ≈ ${formatErg(pot)} ERG · winner takes all; draw → ~50/50 after fee.`;
  }
  if (g.phase === "won") {
    const w = superWinner(g.state.boards);
    const who = w === CELL_X ? "X" : w === CELL_O ? "O" : "Winner";
    return `${who} can claim ≈ ${formatErg(pot)} ERG (pot − fee).`;
  }
  const sp = splitAfterFee(pot);
  if (!sp) return "Pot too small to split after fee.";
  return `Each ≈ ${formatErg(sp.toP2)} / ${formatErg(sp.toP1)} ERG (fee ${formatErg(sp.fee)}).`;
};

const historyPrizeSummary = (h: SuperGameHistorySnapshot): string => {
  const pot = BigInt(h.box.value);
  if (h.phase === "won") {
    const w = superWinner(h.state.boards);
    const who = w === CELL_X ? "X" : w === CELL_O ? "O" : "Winner";
    return `${who} claimed ≈ ${formatErg(pot)} ERG (final box value).`;
  }
  if (h.phase === "drawn") {
    const sp = splitAfterFee(pot);
    if (!sp) return "Draw settled (see tx).";
    return `Split ≈ ${formatErg(sp.toP2)} + ${formatErg(sp.toP1)} ERG after fee.`;
  }
  return `—`;
};

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
  const [historyInspect, setHistoryInspect] = useState<SuperGameHistorySnapshot | null>(
    null
  );
  const [watchGame, setWatchGame] = useState<DiscoveredSuperGame | null>(null);

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
        fetchRecentSuperGameHistory(40).catch(() => [] as SuperGameHistorySnapshot[]),
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
    const period = pending.length > 0 ? 8_000 : 25_000;
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
          follow: {
            p1PubKeyHex: activeGame.state.p1PubKeyHex,
            p2PubKeyHex: activeGame.state.p1PubKeyHex,
            wagerNanoErg: activeGame.state.wagerNanoErg.toString(),
          },
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

  const handleClaimWin = async (gameOverride?: DiscoveredSuperGame | null) => {
    const g = gameOverride ?? activeGame;
    if (!g || !ergoAddress || !myPubKey) return;
    await withBusy("Building claim transaction…", async () => {
      try {
        const tx = await buildSuperClaimWinTx({
          currentGameBox: g.box,
          currentGameState: g.state,
          winnerAddress: ergoAddress,
          winnerPubKeyHex: myPubKey,
        });
        const ok = await signAndSubmitTx(tx, {
          kind: "claim",
          spentBoxId: g.box.boxId,
          predicted: null,
          predictedPhase: "spent",
          follow: {
            p1PubKeyHex: g.state.p1PubKeyHex,
            p2PubKeyHex: g.state.p2PubKeyHex,
            wagerNanoErg: g.state.wagerNanoErg.toString(),
          },
          description: `Claiming xoxo pot ${formatErg(BigInt(g.box.value))} ERG`,
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

  const handleDrawSplit = async (gameOverride?: DiscoveredSuperGame | null) => {
    const g = gameOverride ?? activeGame;
    if (!g || !ergoAddress || !myPubKey) return;
    await withBusy("Building draw split transaction…", async () => {
      try {
        const addrs = getSuperPlayerAddresses(g.state);
        if (!addrs.p2) {
          toast({ title: "Opponent address unknown", status: "error" });
          return;
        }
        const tx = await buildSuperDrawSplitTx({
          currentGameBox: g.box,
          currentGameState: g.state,
          p1Address: addrs.p1,
          p2Address: addrs.p2,
          signerPubKeyHex: myPubKey,
        });
        const ok = await signAndSubmitTx(tx, {
          kind: "draw",
          spentBoxId: g.box.boxId,
          predicted: null,
          predictedPhase: "spent",
          follow: {
            p1PubKeyHex: g.state.p1PubKeyHex,
            p2PubKeyHex: g.state.p2PubKeyHex,
            wagerNanoErg: g.state.wagerNanoErg.toString(),
          },
          description: "xoxo draw — split pot (needs both signatures)",
        });
        if (ok) {
          toast({
            title: "Your signature is attached",
            description:
              "Your opponent must sign the same draw split in Nautilus to merge both halves.",
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

  const pendingBoxIds = useMemo(
    () => new Set(pending.map((p) => p.spentBoxId).filter(Boolean) as string[]),
    [pending]
  );

  const displayGame: SuperGame | null = activeGame
    ? superChainStateToGame(activeGame.state)
    : null;
  const chainStatus = displayGame ? superStatusOf(displayGame) : null;
  const metaW = activeGame ? superWinner(activeGame.state.boards) : null;
  const iAmP1Active =
    !!activeGame && !!myPubKey && myPubKey === activeGame.state.p1PubKeyHex;
  const iAmP2Active =
    !!activeGame && !!myPubKey && myPubKey === activeGame.state.p2PubKeyHex;
  const canClaimSuperActive =
    !!activeGame &&
    activeGame.phase === "won" &&
    metaW !== null &&
    ((metaW === CELL_X && iAmP1Active) || (metaW === CELL_O && iAmP2Active));
  const canDrawSuperActive =
    !!activeGame && activeGame.phase === "drawn" && (iAmP1Active || iAmP2Active);

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
    <Stack spacing={6}>
      <Stack spacing={1}>
        <Heading size="md">Live xoxo</Heading>
        <Text fontSize="sm" opacity={0.75}>
          Active games on this contract refresh automatically. Pots and outcomes are
          read from the chain; final payouts follow the closing transaction on Explorer.
        </Text>
      </Stack>

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
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
              <Box
                p={3}
                borderRadius="md"
                borderWidth="1px"
                borderColor={colorMode === "light" ? "gray.200" : "whiteAlpha.300"}
              >
                <Text fontSize="xs" opacity={0.7} textTransform="uppercase">
                  Pot (locked)
                </Text>
                <Text fontWeight="bold">{formatErg(BigInt(activeGame.box.value))} ERG</Text>
              </Box>
              <Box
                p={3}
                borderRadius="md"
                borderWidth="1px"
                borderColor={colorMode === "light" ? "gray.200" : "whiteAlpha.300"}
              >
                <Text fontSize="xs" opacity={0.7} textTransform="uppercase">
                  Wager (each)
                </Text>
                <Text fontWeight="bold">{formatErg(activeGame.state.wagerNanoErg)} ERG</Text>
              </Box>
              <Box
                p={3}
                borderRadius="md"
                borderWidth="1px"
                borderColor={colorMode === "light" ? "gray.200" : "whiteAlpha.300"}
              >
                <Text fontSize="xs" opacity={0.7} textTransform="uppercase">
                  Prize rule
                </Text>
                <Text fontSize="sm">
                  {activeGame.phase === "ongoing" && "Winner takes full pot (− fee)."}
                  {activeGame.phase === "won" && "Claim sends pot to meta-winner."}
                  {activeGame.phase === "drawn" && "Co-sign split ~50/50 after fee."}
                  {activeGame.phase === "open" && "Join doubles pot for play."}
                </Text>
              </Box>
            </SimpleGrid>
            <Text fontSize="xs" opacity={0.65}>
              {prizeSummary(activeGame)}
            </Text>
            <Flex justify="center" overflowX="auto">
              <SuperTicTacToeBoard
                game={displayGame}
                onPlay={(s, c) => void handleMove(s, c)}
                disabledReason={moveDisabledReason}
              />
            </Flex>
            <HStack flexWrap="wrap" spacing={2}>
              {activeGame.phase === "drawn" && (
                <Alert status="info" borderRadius="md" fontSize="sm">
                  <AlertIcon />
                  <AlertDescription>
                    Meta draw: each player taps &quot;Sign draw split&quot; so Nautilus can
                    merge both signatures (50/50 after fee). Vault-only needs off-app
                    co-signing.
                  </AlertDescription>
                </Alert>
              )}
              {canDrawSuperActive && (
                <Button
                  size="sm"
                  colorScheme="purple"
                  onClick={() => void handleDrawSplit()}
                  isDisabled={busy}
                >
                  Sign draw split
                </Button>
              )}
              {activeGame.phase === "open" && myPubKey === activeGame.state.p1PubKeyHex && (
                <Button size="sm" variant="outline" onClick={handleCancel} isDisabled={busy}>
                  Cancel open game
                </Button>
              )}
              {canClaimSuperActive && (
                <Button
                  size="sm"
                  colorScheme="green"
                  onClick={() => void handleClaimWin()}
                  isDisabled={busy}
                >
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
            <HStack justify="space-between" flexWrap="wrap" gap={2}>
              <Stack spacing={0}>
                <Heading size="sm">Active games</Heading>
                <Text fontSize="xs" opacity={0.65}>
                  Join or watch any row; pots update after each confirmation.
                </Text>
              </Stack>
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
                      <Th>Outcome</Th>
                      <Th>Pot</Th>
                      <Th>Wager</Th>
                      <Th>Prize</Th>
                      <Th>X</Th>
                      <Th>O</Th>
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
                      const wMeta = superWinner(g.state.boards);
                      const canClaimLobby =
                        g.phase === "won" &&
                        (iAmP1 || iAmP2) &&
                        wMeta !== null &&
                        ((wMeta === CELL_X && iAmP1) || (wMeta === CELL_O && iAmP2));
                      const canDrawLobby =
                        g.phase === "drawn" && (iAmP1 || iAmP2) && !optimistic;
                      const sg = superChainStateToGame(g.state);
                      const st = superStatusOf(sg);
                      const showWatch =
                        g.phase === "ongoing" ||
                        g.phase === "won" ||
                        g.phase === "drawn";
                      return (
                        <Tr key={g.box.boxId}>
                          <Td fontSize="xs" maxW="140px">
                            <HStack spacing={1} flexWrap="wrap">
                              <Badge fontSize="0.65rem">
                                {g.phase === "ongoing" && st.kind === "ongoing"
                                  ? `turn ${st.turn}`
                                  : outcomeLabel(g)}
                              </Badge>
                              {(optimistic || inflight) && (
                                <Badge colorScheme="yellow" fontSize="0.65rem">
                                  pending
                                </Badge>
                              )}
                            </HStack>
                          </Td>
                          <Td fontSize="xs">{formatErg(BigInt(g.box.value))}</Td>
                          <Td fontSize="xs">{formatErg(g.state.wagerNanoErg)}</Td>
                          <Td fontSize="xs" maxW="200px">
                            {prizeSummary(g)}
                          </Td>
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
                              <Text opacity={0.5}>—</Text>
                            )}
                          </Td>
                          <Td>
                            <HStack spacing={1} flexWrap="wrap">
                              {showWatch && (
                                <Button size="xs" variant="ghost" onClick={() => setWatchGame(g)}>
                                  Watch
                                </Button>
                              )}
                              {canJoin && (
                                <Button size="xs" onClick={() => void handleJoin(g)}>
                                  Join
                                </Button>
                              )}
                              {(iAmP1 || iAmP2) && g.phase === "ongoing" && (
                                <Button size="xs" variant="outline" onClick={() => setActiveGame(g)}>
                                  Play
                                </Button>
                              )}
                              {g.phase === "open" && iAmP1 && (
                                <Button size="xs" variant="ghost" onClick={() => setActiveGame(g)}>
                                  Manage
                                </Button>
                              )}
                              {canClaimLobby && (
                                <Button
                                  size="xs"
                                  colorScheme="green"
                                  onClick={() => void handleClaimWin(g)}
                                  isDisabled={busy}
                                >
                                  Claim
                                </Button>
                              )}
                              {canDrawLobby && (
                                <Button
                                  size="xs"
                                  colorScheme="purple"
                                  onClick={() => void handleDrawSplit(g)}
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

          {gameHistory.length > 0 && (
            <Stack spacing={2}>
              <Stack spacing={0}>
                <Heading size="sm">Recently ended</Heading>
                <Text fontSize="xs" opacity={0.65}>
                  Last on-chain snapshot before the closing tx — who won and pot size at settlement.
                </Text>
              </Stack>
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>Block</Th>
                    <Th>Result</Th>
                    <Th>Pot at end</Th>
                    <Th>Wager</Th>
                    <Th>Payout</Th>
                    <Th>Winner / split</Th>
                    <Th></Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {gameHistory.slice(0, 15).map((h) => {
                    const addrs = getSuperPlayerAddresses(h.state);
                    const w = superWinner(h.state.boards);
                    const who =
                      h.phase === "won"
                        ? w === CELL_X
                          ? "X (creator)"
                          : w === CELL_O
                            ? "O (joiner)"
                            : "—"
                        : h.phase === "drawn"
                          ? "50 / 50"
                          : "—";
                    return (
                      <Tr key={h.spentTransactionId}>
                        <Td fontSize="xs">{h.settlementHeight}</Td>
                        <Td fontSize="xs">
                          <Badge>{h.phase}</Badge>
                        </Td>
                        <Td fontSize="xs">{formatErg(BigInt(h.box.value))}</Td>
                        <Td fontSize="xs">{formatErg(h.state.wagerNanoErg)}</Td>
                        <Td fontSize="xs" maxW="220px">
                          {historyPrizeSummary(h)}
                        </Td>
                        <Td fontSize="xs">
                          <Text>{who}</Text>
                          <Text fontSize="0.65rem" opacity={0.7}>
                            {truncAddr(addrs.p1)} vs{" "}
                            {addrs.p2 ? truncAddr(addrs.p2) : "—"}
                          </Text>
                        </Td>
                        <Td>
                          <HStack spacing={1}>
                            <Button
                              as="a"
                              size="xs"
                              variant="link"
                              href={`${EXPLORER_TX}${h.spentTransactionId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Tx
                            </Button>
                            <Button size="xs" variant="outline" onClick={() => setHistoryInspect(h)}>
                              Board
                            </Button>
                          </HStack>
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
            </Stack>
          )}
        </>
      )}

      <SuperXoxoWatchModal
        game={watchGame}
        onClose={() => setWatchGame(null)}
      />

      <SuperXoxoFinishedModal
        row={historyInspect}
        onClose={() => setHistoryInspect(null)}
        contractAddress={contractAddress}
      />
    </Stack>
  );
};

interface SuperXoxoWatchModalProps {
  game: DiscoveredSuperGame | null;
  onClose: () => void;
}

const WATCH_POLL_MS = 4000;

const SuperXoxoWatchModal: React.FC<SuperXoxoWatchModalProps> = ({ game, onClose }) => {
  const [snap, setSnap] = useState<DiscoveredSuperGame | null>(null);
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    if (game) {
      setSnap(game);
      setLastSynced(null);
      setSyncError(null);
    } else {
      setSnap(null);
    }
  }, [game]);

  useEffect(() => {
    if (!game) return undefined;
    const { p1PubKeyHex, p2PubKeyHex, wagerNanoErg } = game.state;
    let cancelled = false;

    const poll = async () => {
      try {
        const latest = await findCurrentSuperBoxForGame(
          p1PubKeyHex,
          p2PubKeyHex,
          wagerNanoErg
        );
        if (cancelled) return;
        setSyncError(null);
        setSnap((prev) => (latest ? latest : prev ?? game));
        setLastSynced(Date.now());
      } catch (e: any) {
        if (!cancelled) {
          setSyncError(e?.message || String(e));
        }
      }
    };

    void poll();
    const id = window.setInterval(() => void poll(), WATCH_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [game]);

  if (!game) return null;

  const view = snap ?? game;
  const g = superChainStateToGame(view.state);
  const st = superStatusOf(g);
  const addrs = getSuperPlayerAddresses(view.state);

  return (
    <Modal isOpen onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <HStack justify="space-between" pr={8}>
            <Text>Watch game</Text>
            <Badge colorScheme="cyan" variant="subtle">
              Live · {WATCH_POLL_MS / 1000}s refresh
            </Badge>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            {syncError && (
              <Alert status="warning" borderRadius="md" size="sm">
                <AlertIcon />
                <AlertDescription fontSize="xs">
                  Could not refresh: {syncError}
                </AlertDescription>
              </Alert>
            )}
            <HStack flexWrap="wrap" gap={2}>
              <Badge>{outcomeLabel(view)}</Badge>
              <Text fontSize="xs" opacity={0.7}>
                Pot {formatErg(BigInt(view.box.value))} ERG · wager{" "}
                {formatErg(view.state.wagerNanoErg)} each
              </Text>
            </HStack>
            {lastSynced !== null && (
              <Text fontSize="xs" opacity={0.55}>
                Last chain sync: {new Date(lastSynced).toLocaleTimeString()}
              </Text>
            )}
            <Text fontSize="sm" opacity={0.85}>
              {prizeSummary(view)}
            </Text>
            <Text fontSize="xs">
              <strong>X:</strong> <Code fontSize="xs">{truncAddr(addrs.p1)}</Code>
              {" · "}
              <strong>O:</strong>{" "}
              {addrs.p2 ? <Code fontSize="xs">{truncAddr(addrs.p2)}</Code> : "—"}
            </Text>
            <Flex justify="center" overflowX="auto">
              <SuperTicTacToeBoard game={g} readOnly />
            </Flex>
            <Alert status="info" borderRadius="md" fontSize="sm">
              <AlertIcon />
              <AlertDescription>
                This view re-fetches the contract UTXO for this match every {WATCH_POLL_MS / 1000} seconds
                (same <Code fontSize="xs">p1 + p2 + wager</Code> identity as on-chain play). After each move
                confirms (~1–3 minutes), the board and pot update automatically. If the game was claimed or
                fully settled, the last on-chain snapshot stays visible until you close.
              </AlertDescription>
            </Alert>
            {st.kind === "ongoing" && (
              <Text fontSize="xs" opacity={0.75}>
                Read-only. To move, connect as a player and use <strong>Play</strong> in the table.
              </Text>
            )}
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button onClick={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

interface SuperXoxoFinishedModalProps {
  row: SuperGameHistorySnapshot | null;
  onClose: () => void;
  contractAddress: string;
}

const SuperXoxoFinishedModal: React.FC<SuperXoxoFinishedModalProps> = ({
  row,
  onClose,
  contractAddress,
}) => {
  if (!row) return null;
  const addrs = getSuperPlayerAddresses(row.state);
  const g = superChainStateToGame(row.state);
  const st = superStatusOf(g);
  const label =
    row.phase === "open"
      ? "Cancelled"
      : row.phase === "won"
        ? "Won (claimed)"
        : row.phase === "drawn"
          ? "Draw"
          : row.phase;

  return (
    <Modal isOpen onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Finished xoxo</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <HStack>
              <Badge
                colorScheme={
                  row.phase === "won" ? "green" : row.phase === "drawn" ? "gray" : "orange"
                }
              >
                {label}
              </Badge>
              <Text fontSize="xs" opacity={0.7}>
                Block {row.settlementHeight}
              </Text>
            </HStack>
            <Text fontSize="sm" opacity={0.85}>
              Last on-chain box before the closing transaction (not every intermediate
              move).
            </Text>
            <Flex justify="center" overflowX="auto">
              <SuperTicTacToeBoard game={g} readOnly />
            </Flex>
            <Stack spacing={1} fontSize="sm">
              <Text>
                <strong>Outcome:</strong>{" "}
                {row.phase === "won" && superWinner(row.state.boards) === CELL_X && "X won meta"}
                {row.phase === "won" && superWinner(row.state.boards) === CELL_O && "O won meta"}
                {row.phase === "drawn" && "Draw (co-signed split)"}
                {row.phase === "open" && "Cancelled"}
              </Text>
              <Text>
                <strong>Pot at settlement:</strong> {formatErg(BigInt(row.box.value))} ERG
              </Text>
              <Text>
                <strong>Payout note:</strong> {historyPrizeSummary(row)}
              </Text>
              <Text>
                <strong>Wager (each):</strong> {formatErg(row.state.wagerNanoErg)} ERG
              </Text>
              <Text>
                <strong>X:</strong> <Code fontSize="xs">{truncAddr(addrs.p1)}</Code>
              </Text>
              <Text>
                <strong>O:</strong>{" "}
                {addrs.p2 ? (
                  <Code fontSize="xs">{truncAddr(addrs.p2)}</Code>
                ) : (
                  "—"
                )}
              </Text>
              {st.kind === "ongoing" && (
                <Text fontSize="xs" opacity={0.75}>
                  Turn at snapshot: <strong>{st.turn}</strong>
                </Text>
              )}
              <Text fontSize="xs" wordBreak="break-all">
                <strong>Contract:</strong> <Code fontSize="xs">{truncAddr(contractAddress)}</Code>
              </Text>
              <Button
                as="a"
                size="xs"
                variant="link"
                href={`${EXPLORER_TX}${row.spentTransactionId}`}
                target="_blank"
                rel="noopener noreferrer"
                alignSelf="flex-start"
              >
                Closing transaction
              </Button>
            </Stack>
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button onClick={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default SuperTicTacToeChainPanel;
