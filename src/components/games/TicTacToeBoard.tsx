import React from "react";
import {
  Box,
  Button,
  SimpleGrid,
  useColorMode,
} from "@chakra-ui/react";
import {
  Board,
  CELL_EMPTY,
  CELL_O,
  CELL_X,
  isLegalMove,
} from "../../lib/games/ticTacToeLogic";

interface Props {
  board: Board;
  onPlay?: (cell: number) => void;
  disabledReason?: string | null;
  highlightMovable?: boolean;
}

/**
 * Pure-UI 3x3 board. `onPlay` is invoked with a cell index 0..8 when
 * the local player clicks an empty cell. `disabledReason` is a tooltip
 * shown over the disabled buttons ("Waiting for opponent", etc).
 */
export const TicTacToeBoard: React.FC<Props> = ({
  board,
  onPlay,
  disabledReason = null,
  highlightMovable = true,
}) => {
  const { colorMode } = useColorMode();

  return (
    <SimpleGrid columns={3} spacing={2} maxW="360px">
      {board.map((cell, idx) => {
        const legal = isLegalMove(board, idx);
        const disabled = !legal || !!disabledReason;
        return (
          <Button
            key={idx}
            w="110px"
            h="110px"
            fontSize="48px"
            fontWeight="bold"
            variant="outline"
            onClick={() => onPlay && onPlay(idx)}
            isDisabled={disabled}
            title={disabledReason || undefined}
            color={cell === CELL_X ? "blue.400" : cell === CELL_O ? "orange.400" : undefined}
            borderWidth="2px"
            borderColor={
              highlightMovable && legal && !disabledReason
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
  );
};

export default TicTacToeBoard;
