import React from "react";
import {
  Box,
  Heading,
  HStack,
  Link,
  SimpleGrid,
  Stack,
  Tag,
  Text,
  useColorMode,
} from "@chakra-ui/react";
import { ExternalLinkIcon } from "@chakra-ui/icons";
import { AddressCard } from "./AddressCard";

interface Props {
  address: string;
}

interface SourceLink {
  name: string;
  description: string;
  url: string;
  tag?: string;
}

const EXCHANGES: SourceLink[] = [
  {
    name: "KuCoin",
    description: "Centralized exchange — buy ERG with USD/USDT.",
    url: "https://www.kucoin.com/trade/ERG-USDT",
    tag: "CEX",
  },
  {
    name: "Mexc",
    description: "Centralized exchange — buy ERG with USDT.",
    url: "https://www.mexc.com/exchange/ERG_USDT",
    tag: "CEX",
  },
  {
    name: "Gate.io",
    description: "Centralized exchange — buy ERG.",
    url: "https://www.gate.io/trade/ERG_USDT",
    tag: "CEX",
  },
  {
    name: "Spectrum Finance",
    description: "On-chain DEX — swap into ERG from another chain.",
    url: "https://app.spectrum.fi/",
    tag: "DEX",
  },
  {
    name: "Rosen Bridge",
    description: "Bridge ERG / native tokens from Cardano, Bitcoin, Ethereum.",
    url: "https://app.rosen.tech/",
    tag: "Bridge",
  },
];

const COMMUNITY: SourceLink[] = [
  {
    name: "Ergo Discord",
    description: "Active community — many people will tip you a small amount of ERG to get started.",
    url: "https://discord.gg/ergo-platform-668903786361651200",
    tag: "Community",
  },
  {
    name: "Sigmanauts Telegram",
    description: "Ergo grant program; new community members welcome.",
    url: "https://t.me/Sigmanauts",
    tag: "Community",
  },
  {
    name: "ergoplatform.org",
    description: "Official site with the latest list of where to get ERG.",
    url: "https://ergoplatform.org/en/get-erg/",
    tag: "Docs",
  },
];

const SourceList: React.FC<{ items: SourceLink[] }> = ({ items }) => (
  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
    {items.map((item) => (
      <Link
        key={item.url}
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        _hover={{ textDecoration: "none" }}
      >
        <Box
          p={3}
          borderRadius="md"
          borderWidth="1px"
          _hover={{ bg: "blackAlpha.50" }}
        >
          <HStack justify="space-between" align="flex-start">
            <Stack spacing={1}>
              <HStack>
                <Text fontWeight="semibold">{item.name}</Text>
                {item.tag && (
                  <Tag size="sm" variant="subtle">
                    {item.tag}
                  </Tag>
                )}
              </HStack>
              <Text fontSize="sm" opacity={0.8}>
                {item.description}
              </Text>
            </Stack>
            <ExternalLinkIcon opacity={0.6} />
          </HStack>
        </Box>
      </Link>
    ))}
  </SimpleGrid>
);

/**
 * Renders when the user has a wallet but a zero balance — gives them
 * concrete next steps to fund it. We deliberately do NOT redirect /
 * iframe any of these — the user has to click out, which is the safer
 * default for an onboarding template.
 */
export const HowToGetErg: React.FC<Props> = ({ address }) => {
  const { colorMode } = useColorMode();
  return (
    <Box
      w="100%"
      p={5}
      borderRadius="lg"
      borderWidth="2px"
      borderColor={
        colorMode === "light" ? "ergnome.yellowAccent.light" : "ergnome.yellow"
      }
      bg={colorMode === "light" ? "ergnome.cardBg.light" : "ergnome.cardBg.dark"}
    >
      <Stack spacing={4}>
        <Stack spacing={1}>
          <Heading size="md">No ERG yet?</Heading>
          <Text fontSize="sm" opacity={0.85}>
            Your Ergo wallet is empty. Send any amount of ERG (even
            0.01) to the address below and refresh — the dashboard
            will populate immediately.
          </Text>
        </Stack>

        <AddressCard address={address} />

        <Stack spacing={2}>
          <Heading size="sm" mt={2}>
            Where to get ERG
          </Heading>
          <SourceList items={EXCHANGES} />
        </Stack>

        <Stack spacing={2}>
          <Heading size="sm">Need help? Ask the community</Heading>
          <SourceList items={COMMUNITY} />
        </Stack>
      </Stack>
    </Box>
  );
};

export default HowToGetErg;
