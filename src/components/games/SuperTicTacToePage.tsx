import React, { useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  HStack,
  Heading,
  Stack,
  Text,
  useColorMode,
} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { useWallet } from "../../context/WalletContext";
import {
  applySuperMove,
  initialSuperGame,
  isLegalSuperMove,
  type SuperGame,
  superStatusOf,
} from "../../lib/games/superTicTacToeLogic";
import SuperTicTacToeBoard from "./SuperTicTacToeBoard";
import SuperTicTacToeChainPanel from "./SuperTicTacToeChainPanel";

/**
 * Ultimate (Super) Tic Tac Toe — local two-player, same browser.
 * Nine nested boards; your move picks the next sub-board for your opponent.
 */
export const SuperTicTacToePage: React.FC = () => {
  const { colorMode } = useColorMode();
  const { ergoAddress } = useWallet();
  const [game, setGame] = useState<SuperGame>(() => initialSuperGame());

  const status = superStatusOf(game);

  const onPlay = (subIndex: number, cellIndex: number) => {
    setGame((prev) => {
      if (!isLegalSuperMove(prev, subIndex, cellIndex)) return prev;
      const s = superStatusOf(prev);
      if (s.kind === "won" || s.kind === "drawn") return prev;
      return applySuperMove(prev, subIndex, cellIndex);
    });
  };

  const reset = () => setGame(initialSuperGame());

  let statusLabel: string;
  let statusColor: string;
  if (status.kind === "won") {
    statusLabel = `${status.winner} wins the meta board`;
    statusColor = "green";
  } else if (status.kind === "drawn") {
    statusLabel = "Draw";
    statusColor = "gray";
  } else if (status.kind === "ongoing") {
    statusLabel = `Turn: ${status.turn}`;
    statusColor = "purple";
  } else {
    statusLabel = "Ready";
    statusColor = "blue";
  }

  const constraintHint =
    game.constraintSub === null
      ? "You may play in any open mini-board."
      : `You must play in mini-board ${game.constraintSub + 1} (highlighted).`;

  return (
    <Box p={{ base: 4, md: 6 }} maxW="960px" mx="auto">
      <Stack spacing={5}>
        <Stack spacing={1}>
          <Heading size="lg">xoxo · Super Tic Tac Toe</Heading>
          <Text fontSize="sm" opacity={0.8}>
            Win three mini-boards in a row on the big grid. After each move, your
            opponent must play in the mini-board matching your cell — unless that
            board is already finished, then they get a free move anywhere.
          </Text>
          <Button as={RouterLink} to="/games/tic-tac-toe" size="sm" variant="link" alignSelf="flex-start">
            Classic 3×3 on-chain tic-tac-toe →
          </Button>
        </Stack>

        <Box
          borderWidth="1px"
          borderRadius="md"
          p={5}
          borderColor={colorMode === "light" ? "gray.200" : "whiteAlpha.300"}
        >
          <Stack spacing={4}>
            <HStack justify="space-between" align="center" flexWrap="wrap" gap={2}>
              <Heading size="sm">Local play</Heading>
              <Badge colorScheme={statusColor}>{statusLabel}</Badge>
            </HStack>

            <Alert status="info" borderRadius="md" fontSize="sm">
              <AlertIcon />
              <AlertDescription>
                {constraintHint} Two players at this browser, no wallet. For
                wagered games on Ergo, use the on-chain section below (same flow as
                classic tic-tac-toe: create, join, one tx per move, claim when you
                win the meta board).
              </AlertDescription>
            </Alert>

            <Flex justify="center" overflowX="auto">
              <SuperTicTacToeBoard game={game} onPlay={onPlay} />
            </Flex>

            <HStack justify="center">
              <Button size="sm" variant="outline" onClick={reset}>
                Reset game
              </Button>
            </HStack>
          </Stack>
        </Box>

        <Divider />

        <Stack spacing={3}>
          <Heading size="md">On-chain xoxo</Heading>
          {ergoAddress ? (
            <SuperTicTacToeChainPanel />
          ) : (
            <Alert status="info" borderRadius="md" fontSize="sm">
              <AlertIcon />
              <AlertDescription>
                Connect a wallet from the dashboard to create or join real Ultimate
                games (separate contract from standard 3×3 tic-tac-toe).
              </AlertDescription>
            </Alert>
          )}
        </Stack>
      </Stack>
    </Box>
  );
};

export default SuperTicTacToePage;
