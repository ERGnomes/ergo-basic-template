import React from "react";
import {
  Box,
  Heading,
  HStack,
  SimpleGrid,
  Stack,
  Text,
  useColorMode,
} from "@chakra-ui/react";

interface Step {
  number: string;
  title: string;
  body: string;
  detail?: string;
}

const STEPS: Step[] = [
  {
    number: "1",
    title: "Sign in with email",
    body:
      "We use Dynamic.xyz for sign-in. Your email is just a login — Dynamic doesn't take custody of your Ergo wallet.",
    detail:
      "If you already have Nautilus installed, you can pick it from the same widget instead.",
  },
  {
    number: "2",
    title: "Secure with a passkey",
    body:
      "On first login your browser will ask you to register a passkey (Touch ID / Windows Hello / Android biometric). The passkey lives on your device and protects your Ergo wallet.",
    detail:
      "We generate a fresh Ergo private key locally, encrypt it with the passkey, and never send it anywhere.",
  },
  {
    number: "3",
    title: "Save your recovery phrase",
    body:
      "We'll show you 24 recovery words exactly once. Write them down on paper. They are the only way to recover your funds if you lose all your devices.",
    detail:
      "Anyone with these 24 words can access your wallet — keep them offline.",
  },
];

export const HowItWorks: React.FC = () => {
  const { colorMode } = useColorMode();
  const accent =
    colorMode === "light" ? "ergnome.blueAccent.light" : "ergnome.blue";

  return (
    <Box w="100%" maxW="900px">
      <Heading
        size="md"
        mb={4}
        color={colorMode === "light" ? "ergnome.heading.light" : "ergnome.heading.dark"}
      >
        How it works
      </Heading>
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
        {STEPS.map((step) => (
          <Box
            key={step.number}
            p={5}
            borderRadius="lg"
            borderWidth="2px"
            borderColor={accent}
            bg={colorMode === "light" ? "ergnome.cardBg.light" : "ergnome.cardBg.dark"}
            display="flex"
            flexDirection="column"
            gap={2}
          >
            <HStack spacing={3}>
              <Box
                w="32px"
                h="32px"
                borderRadius="full"
                bg={accent}
                color="white"
                fontWeight="bold"
                display="flex"
                alignItems="center"
                justifyContent="center"
                flexShrink={0}
              >
                {step.number}
              </Box>
              <Heading size="sm">{step.title}</Heading>
            </HStack>
            <Stack spacing={2} mt={1}>
              <Text fontSize="sm">{step.body}</Text>
              {step.detail && (
                <Text fontSize="xs" opacity={0.75}>
                  {step.detail}
                </Text>
              )}
            </Stack>
          </Box>
        ))}
      </SimpleGrid>
    </Box>
  );
};

export default HowItWorks;
