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
  applyMove,
  Board,
  EMPTY_BOARD,
  isLegalMove,
  statusOf,
} from "../../lib/games/ticTacToeLogic";
import TicTacToeBoard from "./TicTacToeBoard";

/**
 * Local-only tic-tac-toe for testing the game UI without any
 * blockchain interaction. No wallet, no transactions, no wager —
 * just two seats at the same browser taking turns.
 *
 * Useful for:
 *   * Verifying the 3x3 board UI renders and accepts moves.
 *   * Walking someone through the turn-order / win-detection logic
 *     before they commit a real wager.
 *   * Developing the UI in a browser where the passkey vault
 *     isn't supported (e.g. Firefox today).
 */
export const TicTacToePractice: React.FC = () => {
  const { colorMode } = useColorMode();
  const [board, setBoard] = useState<Board>(EMPTY_BOARD);

  const status = statusOf(board, false);

  const onPlay = (cell: number) => {
    if (!isLegalMove(board, cell)) return;
    if (status.kind === "won" || status.kind === "drawn") return;
    setBoard(applyMove(board, cell));
  };

  const reset = () => setBoard(EMPTY_BOARD);

  let statusLabel: string;
  let statusColor: string;
  if (status.kind === "won") {
    statusLabel = `${status.winner} wins`;
    statusColor = "green";
  } else if (status.kind === "drawn") {
    statusLabel = "Draw";
    statusColor = "gray";
  } else if (status.kind === "ongoing") {
    statusLabel = `turn: ${status.turn}`;
    statusColor = "purple";
  } else {
    statusLabel = "open";
    statusColor = "blue";
  }

  return (
    <Box
      borderWidth="1px"
      borderRadius="md"
      p={5}
      borderColor={colorMode === "light" ? "gray.200" : "whiteAlpha.300"}
    >
      <Stack spacing={4}>
        <HStack justify="space-between" align="center">
          <Stack spacing={0}>
            <Heading size="sm">Practice mode</Heading>
            <Text fontSize="xs" opacity={0.7}>
              Local-only. No wallet, no ERG, no transaction — two seats at
              this browser taking turns.
            </Text>
          </Stack>
          <Badge colorScheme={statusColor}>{statusLabel}</Badge>
        </HStack>

        <Alert status="info" borderRadius="md" fontSize="sm">
          <AlertIcon />
          <AlertDescription>
            Use this to test the UI or to walk a teammate through the
            rules. A real on-chain game requires two different wallets
            (you can't join your own open game).
          </AlertDescription>
        </Alert>

        <Flex justify="center">
          <TicTacToeBoard board={board} onPlay={onPlay} />
        </Flex>

        <HStack justify="center">
          <Button size="sm" variant="outline" onClick={reset}>
            Reset practice board
          </Button>
        </HStack>
      </Stack>
    </Box>
  );
};

export default TicTacToePractice;
