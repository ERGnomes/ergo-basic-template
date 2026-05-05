import React from "react";
import {
  Box,
  Container,
  Divider,
  Flex,
  Link,
  Text,
  useColorMode,
} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { githubRepoUrl } from "../../lib/siteBranding";

export const SiteFooter: React.FC = () => {
  const { colorMode } = useColorMode();
  const muted =
    colorMode === "light" ? "gray.600" : "whiteAlpha.700";

  return (
    <Box
      as="footer"
      mt="auto"
      py={8}
      borderTopWidth="1px"
      borderColor={colorMode === "light" ? "gray.200" : "whiteAlpha.200"}
      bg={colorMode === "light" ? "gray.50" : "whiteAlpha.50"}
    >
      <Container maxW="container.xl">
        <Flex
          direction={{ base: "column", md: "row" }}
          gap={4}
          justify="space-between"
          align={{ base: "flex-start", md: "center" }}
        >
          <Box>
            <Text fontSize="sm" fontWeight="semibold" mb={1}>
              For developers
            </Text>
            <Text fontSize="xs" color={muted} maxW="lg">
              MIT-licensed starter: fork, rename via{" "}
              <CodeInline>REACT_APP_SITE_NAME</CodeInline>, strip the games or
              replace contracts — see{" "}
              <Link as={RouterLink} to="/developers" color="ergnome.blue">
                Developer guide
              </Link>
              .
            </Text>
          </Box>
          <Flex wrap="wrap" gap={4} fontSize="sm">
            {githubRepoUrl ? (
              <Link href={githubRepoUrl} isExternal color="ergnome.blue">
                Source on GitHub
              </Link>
            ) : null}
            <Link
              href="https://ergoplatform.org/en/"
              isExternal
              color="ergnome.blue"
            >
              Ergo
            </Link>
            <Link
              href="https://explorer.ergoplatform.com/"
              isExternal
              color="ergnome.blue"
            >
              Explorer
            </Link>
          </Flex>
        </Flex>
        <Divider my={4} />
        <Text fontSize="xs" color={muted}>
          Example contracts are unaudited. This software is provided as-is; see{" "}
          <Link
            href="https://opensource.org/licenses/MIT"
            isExternal
            color="ergnome.blue"
          >
            LICENSE
          </Link>
          .
        </Text>
      </Container>
    </Box>
  );
};

function CodeInline({ children }: { children: React.ReactNode }) {
  const { colorMode } = useColorMode();
  return (
    <Text
      as="span"
      fontFamily="mono"
      fontSize="xs"
      px={1}
      borderRadius="sm"
      bg={colorMode === "light" ? "gray.100" : "whiteAlpha.200"}
    >
      {children}
    </Text>
  );
}
