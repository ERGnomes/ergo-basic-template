import React from "react";
import {
  Box,
  Button,
  SimpleGrid,
  Text,
  useColorMode,
} from "@chakra-ui/react";
import {
  META_DRAW,
  type SuperGame,
  isLegalSuperMove,
  metaOutcomeOfSub,
} from "../../lib/games/superTicTacToeLogic";
import {
  CELL_EMPTY,
  CELL_O,
  CELL_X,
  isLegalMove,
} from "../../lib/games/ticTacToeLogic";

interface Props {
  game: SuperGame;
  onPlay?: (subIndex: number, cellIndex: number) => void;
  disabledReason?: string | null;
  readOnly?: boolean;
}

const subBorder = (colorMode: string, highlight: boolean) =>
  highlight ? "2px solid" : "1px solid";

const subBorderColor = (colorMode: string, highlight: boolean) => {
  if (highlight) {
    return colorMode === "light" ? "ergnome.blueAccent.light" : "ergnome.blue";
  }
  return colorMode === "light" ? "gray.200" : "whiteAlpha.300";
};

/**
 * 9× nested 3×3 Ultimate Tic Tac Toe board. Highlights the forced mini-board
 * when `game.constraintSub` is set.
 */
export const SuperTicTacToeBoard: React.FC<Props> = ({
  game,
  onPlay,
  disabledReason = null,
  readOnly = false,
}) => {
  const { colorMode } = useColorMode();

  return (
    <SimpleGrid columns={3} spacing={2} maxW="min(96vw, 520px)">
      {game.boards.map((sub, subIdx) => {
        const meta = metaOutcomeOfSub(sub);
        const forced = game.constraintSub === subIdx;
        const subDecided = meta !== CELL_EMPTY;

        return (
          <Box
            key={subIdx}
            p={1.5}
            borderRadius="md"
            borderWidth={subBorder(colorMode, forced && !subDecided)}
            borderColor={subBorderColor(colorMode, forced && !subDecided)}
            sx={
              forced && !subDecided
                ? {
                    boxShadow:
                      colorMode === "light"
                        ? "0 0 0 3px rgba(66, 153, 225, 0.45)"
                        : "0 0 0 3px rgba(65, 157, 217, 0.5)",
                  }
                : undefined
            }
          >
            {subDecided ? (
              <Box
                minH="140px"
                display="flex"
                alignItems="center"
                justifyContent="center"
                borderRadius="sm"
                bg={colorMode === "light" ? "gray.50" : "whiteAlpha.50"}
              >
                {meta === META_DRAW ? (
                  <Text fontSize="2xl" fontWeight="bold" opacity={0.65}>
                    =
                  </Text>
                ) : (
                  <Text
                    fontSize="5xl"
                    fontWeight="bold"
                    color={meta === CELL_X ? "blue.400" : "orange.400"}
                  >
                    {meta === CELL_X ? "X" : "O"}
                  </Text>
                )}
              </Box>
            ) : (
              <SimpleGrid columns={3} spacing={1}>
                {sub.map((cell, cellIdx) => {
                  if (readOnly) {
                    return (
                      <Box
                        key={cellIdx}
                        minH="42px"
                        minW="42px"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        fontSize="xl"
                        fontWeight="bold"
                        borderWidth="1px"
                        borderRadius="sm"
                        borderColor={
                          colorMode === "light" ? "gray.200" : "whiteAlpha.300"
                        }
                        color={
                          cell === CELL_X
                            ? "blue.400"
                            : cell === CELL_O
                              ? "orange.400"
                              : "gray.400"
                        }
                      >
                        {cell === CELL_X ? "X" : cell === CELL_O ? "O" : ""}
                      </Box>
                    );
                  }
                  const legal = isLegalSuperMove(game, subIdx, cellIdx);
                  const disabled = !legal || !!disabledReason;
                  const innerLegal = isLegalMove(sub, cellIdx);
                  return (
                    <Button
                      key={cellIdx}
                      minH="42px"
                      minW="42px"
                      h="auto"
                      p={1}
                      fontSize="xl"
                      fontWeight="bold"
                      variant="outline"
                      onClick={() => onPlay && onPlay(subIdx, cellIdx)}
                      isDisabled={disabled}
                      title={disabledReason || undefined}
                      color={
                        cell === CELL_X
                          ? "blue.400"
                          : cell === CELL_O
                            ? "orange.400"
                            : undefined
                      }
                      borderWidth="1px"
                      borderColor={
                        innerLegal && !disabledReason && game.constraintSub === subIdx
                          ? colorMode === "light"
                            ? "ergnome.blueAccent.light"
                            : "ergnome.blue"
                          : undefined
                      }
                    >
                      {cell === CELL_X ? "X" : cell === CELL_O ? "O" : ""}
                    </Button>
                  );
                })}
              </SimpleGrid>
            )}
          </Box>
        );
      })}
    </SimpleGrid>
  );
};

export default SuperTicTacToeBoard;
