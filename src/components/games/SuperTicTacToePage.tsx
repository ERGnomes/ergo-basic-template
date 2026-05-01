import React, { useState } from "react";
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
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
 * xoxo page: live on-chain viewer (always); local practice collapsed under accordion.
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
    <Box p={{ base: 4, md: 6 }} maxW="1100px" mx="auto">
      <Stack spacing={5}>
        <Stack spacing={1}>
          <Heading size="lg">xoxo · Super Tic Tac Toe</Heading>
          <Text fontSize="sm" opacity={0.8}>
            On-chain Ultimate Tic Tac Toe: wagered games, live lobby, and recent
            settlements. Win three mini-boards in a row on the meta grid; each move
            picks your opponent&apos;s next sub-board unless it is already finished.
          </Text>
          <Button as={RouterLink} to="/games/tic-tac-toe" size="sm" variant="link" alignSelf="flex-start">
            Classic 3×3 on-chain tic-tac-toe →
          </Button>
        </Stack>

        <SuperTicTacToeChainPanel />

        <Accordion allowToggle reduceMotion>
          <AccordionItem
            borderWidth="1px"
            borderRadius="md"
            borderColor={colorMode === "light" ? "gray.200" : "whiteAlpha.300"}
          >
            <h2>
              <AccordionButton py={3} _expanded={{ bg: colorMode === "light" ? "gray.50" : "whiteAlpha.50" }}>
                <Box flex="1" textAlign="left">
                  <HStack spacing={2}>
                    <Text fontWeight="semibold">Practice xoxo²</Text>
                    <Badge colorScheme={statusColor}>{statusLabel}</Badge>
                  </HStack>
                  <Text fontSize="xs" opacity={0.65} mt={1}>
                    Offline two-player at this browser — no wallet, no ERG.
                  </Text>
                </Box>
                <AccordionIcon />
              </AccordionButton>
            </h2>
            <AccordionPanel pb={4} pt={0}>
              <Stack spacing={4}>
                <Alert status="info" borderRadius="md" fontSize="sm">
                  <AlertIcon />
                  <AlertDescription>
                    {constraintHint} Use this only to learn the UI or rules; real prizes
                    and opponents are in the live section above
                    {ergoAddress ? "" : " (connect a wallet to create or join games)"}.
                  </AlertDescription>
                </Alert>
                <Flex justify="center" overflowX="auto">
                  <SuperTicTacToeBoard game={game} onPlay={onPlay} />
                </Flex>
                <HStack justify="center">
                  <Button size="sm" variant="outline" onClick={reset}>
                    Reset practice board
                  </Button>
                </HStack>
              </Stack>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
      </Stack>
    </Box>
  );
};

export default SuperTicTacToePage;
