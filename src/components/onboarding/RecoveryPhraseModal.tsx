import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Code,
  HStack,
  Heading,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Stack,
  Text,
  useClipboard,
  useColorMode,
  useToast,
} from "@chakra-ui/react";
import { CheckIcon, CopyIcon } from "@chakra-ui/icons";

interface Props {
  isOpen: boolean;
  phrase: string;
  /** Called only after the user confirms by typing the right two words. */
  onConfirmed: () => void;
}

const NUM_CHALLENGE_WORDS = 2;

const pickChallengeIndices = (totalWords: number): number[] => {
  // Guard: never loop if there aren't enough words to satisfy the
  // challenge (e.g. when the modal is rendered with an empty phrase
  // before it's actually shown).
  if (totalWords < NUM_CHALLENGE_WORDS) {
    return Array.from({ length: totalWords }, (_, i) => i);
  }
  const indices = new Set<number>();
  while (indices.size < NUM_CHALLENGE_WORDS) {
    indices.add(Math.floor(Math.random() * totalWords));
  }
  return Array.from(indices).sort((a, b) => a - b);
};

/**
 * Modal forces the user through the BIP-39 backup ceremony before
 * letting them dismiss:
 *
 *   1. Show all 24 words in a grid (numbered).
 *   2. Force a "Copy to clipboard" or "I've written these down" click.
 *   3. Re-prompt the user to type two specific words (positional, e.g.
 *      word #5 and word #17) back from memory / their notes.
 *   4. Only then unlock the "Continue" button.
 *
 * This isn't perfect — a determined user can still skip by reading
 * the words off the screen — but it filters out the "I'll save it
 * later" failure mode that loses funds.
 */
export const RecoveryPhraseModal: React.FC<Props> = ({
  isOpen,
  phrase,
  onConfirmed,
}) => {
  const { colorMode } = useColorMode();
  const toast = useToast();
  const { hasCopied, onCopy } = useClipboard(phrase);
  const [step, setStep] = useState<"display" | "verify">("display");
  const [confirmedWritten, setConfirmedWritten] = useState(false);

  const words = useMemo(() => phrase.trim().split(/\s+/), [phrase]);
  const challengeIndices = useMemo(
    () => pickChallengeIndices(words.length),
    [words.length]
  );
  const [inputs, setInputs] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!isOpen) {
      setStep("display");
      setConfirmedWritten(false);
      setInputs({});
    }
  }, [isOpen]);

  const allMatch = challengeIndices.every(
    (i) =>
      (inputs[i] || "").trim().toLowerCase() === (words[i] || "").toLowerCase()
  );

  const handleConfirm = () => {
    if (!allMatch) {
      toast({
        title: "Words don't match",
        description: "Double-check your written copy and try again.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
      return;
    }
    onConfirmed();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        // intentionally no-op — closing requires explicit confirmation
      }}
      closeOnEsc={false}
      closeOnOverlayClick={false}
      size="2xl"
      isCentered
    >
      <ModalOverlay backdropFilter="blur(2px)" />
      <ModalContent>
        <ModalHeader>
          {step === "display"
            ? "Save your recovery phrase"
            : "Verify your recovery phrase"}
        </ModalHeader>
        <ModalBody>
          {step === "display" ? (
            <Stack spacing={4}>
              <Alert status="warning" borderRadius="md">
                <AlertIcon />
                <Box>
                  <AlertTitle>This is the only backup you have.</AlertTitle>
                  <AlertDescription fontSize="sm">
                    Anyone with these 24 words can spend your ERG.
                    Write them down on paper — do not screenshot, do
                    not email yourself, do not paste them into a notes
                    app. We will not show them again.
                  </AlertDescription>
                </Box>
              </Alert>
              <SimpleGrid columns={{ base: 2, sm: 4 }} spacing={2}>
                {words.map((word, i) => (
                  <HStack
                    key={`${i}-${word}`}
                    p={2}
                    borderWidth="1px"
                    borderRadius="md"
                    spacing={2}
                  >
                    <Text fontSize="xs" opacity={0.6} w="20px">
                      {i + 1}.
                    </Text>
                    <Code variant="subtle" fontSize="sm">
                      {word}
                    </Code>
                  </HStack>
                ))}
              </SimpleGrid>
              <HStack>
                <Button
                  size="sm"
                  leftIcon={hasCopied ? <CheckIcon /> : <CopyIcon />}
                  onClick={onCopy}
                  variant="outline"
                >
                  {hasCopied ? "Copied — now paste into a password manager" : "Copy to clipboard"}
                </Button>
              </HStack>
              <HStack
                p={3}
                borderRadius="md"
                bg={
                  colorMode === "light"
                    ? "blackAlpha.50"
                    : "whiteAlpha.100"
                }
              >
                <Input
                  type="checkbox"
                  size="sm"
                  w="auto"
                  checked={confirmedWritten}
                  onChange={(e) => setConfirmedWritten(e.target.checked)}
                />
                <Text fontSize="sm">
                  I've saved these 24 words somewhere I can find them later.
                </Text>
              </HStack>
            </Stack>
          ) : (
            <Stack spacing={4}>
              <Text fontSize="sm">
                Type two words from your phrase to confirm you saved
                them. (Position-based — these are the {NUM_CHALLENGE_WORDS}{" "}
                we picked at random.)
              </Text>
              {challengeIndices.map((i) => (
                <Stack key={i} spacing={1}>
                  <Heading size="xs">Word #{i + 1}</Heading>
                  <Input
                    placeholder={`The ${ordinal(i + 1)} word in your phrase`}
                    value={inputs[i] || ""}
                    onChange={(e) =>
                      setInputs((p) => ({ ...p, [i]: e.target.value }))
                    }
                    fontFamily="mono"
                    autoComplete="off"
                  />
                </Stack>
              ))}
              {Object.keys(inputs).length === NUM_CHALLENGE_WORDS && !allMatch && (
                <Text fontSize="xs" color="red.400">
                  Doesn't match yet — re-check your written copy.
                </Text>
              )}
            </Stack>
          )}
        </ModalBody>
        <ModalFooter>
          {step === "display" ? (
            <Button
              colorScheme="blue"
              onClick={() => setStep("verify")}
              isDisabled={!confirmedWritten}
            >
              I've saved them — verify
            </Button>
          ) : (
            <HStack>
              <Button variant="ghost" onClick={() => setStep("display")}>
                Show phrase again
              </Button>
              <Button
                colorScheme="blue"
                onClick={handleConfirm}
                isDisabled={!allMatch}
              >
                Confirm & continue
              </Button>
            </HStack>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

const ordinal = (n: number): string => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export default RecoveryPhraseModal;
