import React, { useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  Stack,
  Text,
  useColorMode,
} from "@chakra-ui/react";
import {
  applySuperMove,
  initialSuperGame,
  isLegalSuperMove,
  type SuperGame,
  superStatusOf,
} from "../../lib/games/superTicTacToeLogic";
import SuperTicTacToeBoard from "./SuperTicTacToeBoard";

/**
 * Ultimate (Super) Tic Tac Toe — local two-player, same browser.
 * Nine nested boards; your move picks the next sub-board for your opponent.
 */
export const SuperTicTacToePage: React.FC = () => {
  const { colorMode } = useColorMode();
  const [game, setGame] = useState<SuperGame>(() => initialSuperGame());

  const status = superStatusOf(game);

  const onPlay = (subIndex: number, cellIndex: number) => {
    if (!isLegalSuperMove(game, subIndex, cellIndex)) return;
    if (status.kind === "won" || status.kind === "drawn") return;
    setGame(applySuperMove(game, subIndex, cellIndex));
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
  } else {
    statusLabel = `Turn: ${status.turn}`;
    statusColor = "purple";
  }

  const constraintHint =
    game.constraintSub === null
      ? "You may play in any open mini-board."
      : `You must play in mini-board ${game.constraintSub + 1} (highlighted).`;

  return (
    <Box p={{ base: 4, md: 6 }} maxW="720px" mx="auto">
      <Stack spacing={5}>
        <Stack spacing={1}>
          <Heading size="lg">xoxo · Super Tic Tac Toe</Heading>
          <Text fontSize="sm" opacity={0.8}>
            Win three mini-boards in a row on the big grid. After each move, your
            opponent must play in the mini-board matching your cell — unless that
            board is already finished, then they get a free move anywhere.
          </Text>
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
                {constraintHint} This game is offline only (no wallet or chain),
                like practice mode on the classic page — but with nested boards
                and stricter rules.
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
      </Stack>
    </Box>
  );
};

export default SuperTicTacToePage;
