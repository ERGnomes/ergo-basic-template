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
  HStack,
  Heading,
  Input,
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
  VStack,
  useColorMode,
  useToast,
} from "@chakra-ui/react";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useWallet } from "../../context/WalletContext";
import {
  Board,
  CELL_EMPTY,
  statusOf,
} from "../../lib/games/ticTacToeLogic";
import {
  getGameP2SAddress,
} from "../../lib/games/ticTacToeContract";
import {
  DiscoveredGame,
  fetchAllGames,
  findCurrentBoxForGame,
} from "../../lib/games/ticTacToeDiscovery";
import {
  buildCancelGameTx,
  buildClaimWinTx,
  buildCreateGameTx,
  buildJoinGameTx,
  buildMoveTx,
  getPlayerAddresses,
} from "../../lib/games/ticTacToeTx";
import { signAndSubmit } from "../../lib/games/signAndSubmit";
import { pubKeyHexFromAddress } from "../../lib/games/pubkey";
import { isErgoWallet } from "../../lib/NautilusConnector";
import {
  findExistingVault,
  unlockWithPasskey,
  ErgoSecretBytes,
} from "../../lib/ergoKeyVault";
import TicTacToeBoard from "./TicTacToeBoard";

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
  const { colorMode } = useColorMode();
  const { primaryWallet, user } = useDynamicContext();
  const { ergoAddress, source } = useWallet();

  const [games, setGames] = useState<DiscoveredGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeGame, setActiveGame] = useState<DiscoveredGame | null>(null);
  const [busy, setBusy] = useState(false);
  const [wagerErg, setWagerErg] = useState<number>(DEFAULT_WAGER_ERG);
  const [myPubKey, setMyPubKey] = useState<string | null>(null);

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
      const out = await fetchAllGames();
      setGames(out);
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

  // Initial + polling fetch.
  useEffect(() => {
    setLoading(true);
    refreshGames();
    const iv = setInterval(refreshGames, 15_000);
    return () => clearInterval(iv);
  }, [refreshGames]);

  // Keep the active game in sync as the chain advances.
  useEffect(() => {
    if (!activeGame) return;
    const match = games.find((g) => g.box.boxId === activeGame.box.boxId);
    if (match) {
      if (match !== activeGame) setActiveGame(match);
      return;
    }
    // Box was spent — the next box has a new id. Try to follow by
    // matching the (p1, p2, wager) triple.
    const followed = games.find(
      (g) =>
        g.state.p1PubKeyHex === activeGame.state.p1PubKeyHex &&
        g.state.p2PubKeyHex === activeGame.state.p2PubKeyHex &&
        g.state.wagerNanoErg === activeGame.state.wagerNanoErg
    );
    if (followed) setActiveGame(followed);
    // else: the game has been fully resolved and no unspent box remains.
    // We leave activeGame pointing at the last known state so the
    // winner-claim / drained result is visible in the UI.
  }, [games, activeGame]);

  // ------------------------------------------------------------------
  // Signing helper: wraps unlock-if-vault + signAndSubmit.
  // ------------------------------------------------------------------
  const signAndSubmitTx = async (prepared: {
    unsignedEip12: any;
    inputBoxes: any[];
  }): Promise<boolean> => {
    if (signingKind === "nautilus") {
      const res = await signAndSubmit({
        kind: "nautilus",
        unsignedEip12: prepared.unsignedEip12,
      });
      if (!res.ok) {
        toast({
          title: "Submit rejected",
          description: res.responseText.slice(0, 220),
          status: "error",
          duration: 8000,
          isClosable: true,
        });
        return false;
      }
      toast({
        title: "Submitted",
        description: `Tx ${res.txId?.slice(0, 12) ?? ""}…`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });
      return true;
    }
    if (signingKind === "vault") {
      if (!user) {
        toast({ title: "Not logged in", status: "warning" });
        return false;
      }
      const vault = findExistingVault(user as any);
      if (!vault) {
        toast({
          title: "No vault on this device",
          description:
            "Provision your vault on /dynamic before playing a game with the email path.",
          status: "warning",
          duration: 6000,
          isClosable: true,
        });
        return false;
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
        if (!res.ok) {
          toast({
            title: "Submit rejected",
            description: res.responseText.slice(0, 220),
            status: "error",
            duration: 8000,
            isClosable: true,
          });
          return false;
        }
        toast({
          title: "Submitted",
          description: `Tx ${res.txId?.slice(0, 12) ?? ""}…`,
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
      } finally {
        secret?.wipe();
      }
    }
    toast({
      title: "No wallet connected",
      description: "Sign in with Dynamic (or connect Nautilus) first.",
      status: "warning",
      duration: 4000,
    });
    return false;
  };

  // ------------------------------------------------------------------
  // Action handlers.
  // ------------------------------------------------------------------

  const handleCreate = async () => {
    if (!ergoAddress || !myPubKey) return;
    if (wagerErg < MIN_WAGER_ERG) {
      toast({ title: `Minimum wager is ${MIN_WAGER_ERG} ERG`, status: "warning" });
      return;
    }
    setBusy(true);
    try {
      const wagerNanoErg = BigInt(Math.floor(wagerErg * NANO_PER_ERG));
      const tx = await buildCreateGameTx({
        creatorAddress: ergoAddress,
        creatorPubKeyHex: myPubKey,
        wagerNanoErg,
      });
      const ok = await signAndSubmitTx(tx);
      if (ok) {
        // Give the mempool a second and refresh.
        setTimeout(refreshGames, 3000);
      }
    } catch (err: any) {
      toast({
        title: "Couldn't build transaction",
        description: err?.message || String(err),
        status: "error",
        duration: 6000,
        isClosable: true,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async (game: DiscoveredGame) => {
    if (!ergoAddress || !myPubKey) return;
    setBusy(true);
    try {
      const tx = await buildJoinGameTx({
        currentGameBox: game.box,
        currentGameState: game.state,
        joinerAddress: ergoAddress,
        joinerPubKeyHex: myPubKey,
      });
      const ok = await signAndSubmitTx(tx);
      if (ok) {
        setActiveGame(game);
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
    } finally {
      setBusy(false);
    }
  };

  const handleMove = async (cell: number) => {
    if (!activeGame || !ergoAddress || !myPubKey) return;
    setBusy(true);
    try {
      const tx = await buildMoveTx({
        currentGameBox: activeGame.box,
        currentGameState: activeGame.state,
        moverAddress: ergoAddress,
        moverPubKeyHex: myPubKey,
        cell,
      });
      const ok = await signAndSubmitTx(tx);
      if (ok) setTimeout(refreshGames, 3000);
    } catch (err: any) {
      toast({
        title: "Couldn't play move",
        description: err?.message || String(err),
        status: "error",
        duration: 6000,
        isClosable: true,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!activeGame || !ergoAddress || !myPubKey) return;
    setBusy(true);
    try {
      const tx = await buildCancelGameTx({
        currentGameBox: activeGame.box,
        currentGameState: activeGame.state,
        creatorAddress: ergoAddress,
        creatorPubKeyHex: myPubKey,
      });
      const ok = await signAndSubmitTx(tx);
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
    } finally {
      setBusy(false);
    }
  };

  const handleClaimWin = async () => {
    if (!activeGame || !ergoAddress || !myPubKey) return;
    setBusy(true);
    try {
      const tx = await buildClaimWinTx({
        currentGameBox: activeGame.box,
        currentGameState: activeGame.state,
        winnerAddress: ergoAddress,
        winnerPubKeyHex: myPubKey,
      });
      const ok = await signAndSubmitTx(tx);
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
    } finally {
      setBusy(false);
    }
  };

  // ------------------------------------------------------------------
  // Render.
  // ------------------------------------------------------------------

  if (!ergoAddress) {
    return (
      <Box maxW="780px" mx="auto" mt={8} p={6}>
        <Alert status="info" borderRadius="md">
          <AlertIcon />
          <AlertDescription>
            Sign in with Dynamic (or connect Nautilus) from the dashboard
            before playing a tic-tac-toe game.
          </AlertDescription>
        </Alert>
      </Box>
    );
  }

  return (
    <Box maxW="900px" mx="auto" mt={6} p={6}>
      <VStack align="stretch" spacing={5}>
        <Stack spacing={1}>
          <Heading size="lg">Ergo Tic-Tac-Toe</Heading>
          <Text fontSize="sm" opacity={0.8}>
            Every move is a real on-chain transaction. Games are
            discovered by scanning unspent boxes at the contract
            address.
          </Text>
          <Text fontSize="xs" opacity={0.6}>
            Contract: <Code fontSize="xs">{truncAddr(contractAddress)}</Code>
          </Text>
        </Stack>

        <Alert status="warning" borderRadius="md">
          <AlertIcon />
          <Stack spacing={1}>
            <AlertTitle>Unaudited smart contract</AlertTitle>
            <AlertDescription fontSize="sm">
              This contract has not been professionally audited. It
              enforces strict two-player turns, winner-takes-all, and
              creator-cancel, but it has NO abandonment timeout — if
              your opponent stops playing, your wager is stuck until
              they sign again. Test with tiny wagers first.
            </AlertDescription>
          </Stack>
        </Alert>

        {activeGame ? (
          <ActiveGameView
            game={activeGame}
            myPubKey={myPubKey}
            busy={busy}
            onMove={handleMove}
            onCancel={handleCancel}
            onClaimWin={handleClaimWin}
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
            <GameList
              games={games}
              loading={loading}
              refreshing={refreshing}
              myPubKey={myPubKey}
              onRefresh={refreshGames}
              onJoin={handleJoin}
              onOpen={setActiveGame}
              busy={busy}
            />
          </>
        )}
      </VStack>
    </Box>
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
  busy: boolean;
}

const GameList: React.FC<GameListProps> = ({
  games,
  loading,
  refreshing,
  myPubKey,
  onRefresh,
  onJoin,
  onOpen,
  busy,
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
        <Text fontSize="sm" opacity={0.7}>
          No games yet. Be the first to create one!
        </Text>
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
                const canJoin =
                  g.phase === "open" && !iAmP1 && !!myPubKey;
                return (
                  <Tr key={g.box.boxId}>
                    <Td>
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
  onMove: (cell: number) => void;
  onCancel: () => void;
  onClaimWin: () => void;
  onBack: () => void;
}

const ActiveGameView: React.FC<ActiveViewProps> = ({
  game,
  myPubKey,
  busy,
  onMove,
  onCancel,
  onClaimWin,
  onBack,
}) => {
  const { colorMode } = useColorMode();
  const status = statusOf(game.state.board, !game.isJoined);
  const iAmP1 = myPubKey === game.state.p1PubKeyHex;
  const iAmP2 = myPubKey !== null && myPubKey === game.state.p2PubKeyHex;
  const mySymbol = iAmP1 ? "X" : iAmP2 ? "O" : null;
  const addrs = getPlayerAddresses(game.state);

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
    disabledReason = "Submitting…";
  }

  const canClaimWin =
    status.kind === "won" &&
    ((status.winner === "X" && iAmP1) || (status.winner === "O" && iAmP2));
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
            {status.kind === "ongoing" ? `turn: ${status.turn}` : status.kind}
          </Badge>
        </HStack>

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
          {status.kind === "drawn" && (
            <Alert status="info" borderRadius="md" maxW="420px">
              <AlertIcon />
              <AlertDescription fontSize="sm">
                Draw. Phase-1 contract requires both players to co-sign
                to split the pot; that's not yet wired in the UI.
                Contact your opponent off-chain.
              </AlertDescription>
            </Alert>
          )}
        </HStack>
      </VStack>
    </Box>
  );
};

export default TicTacToePage;
