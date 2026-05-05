import React from "react";
import {
  Box,
  Heading,
  Link,
  ListItem,
  OrderedList,
  Stack,
  Text,
  UnorderedList,
  useColorMode,
} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { githubRepoUrl, siteName } from "../lib/siteBranding";

const DeveloperGuidePage: React.FC = () => {
  const { colorMode } = useColorMode();
  const panelBg =
    colorMode === "light" ? "blue.50" : "whiteAlpha.100";

  return (
    <Box maxW="800px" mx="auto">
      <Stack spacing={6}>
        <Heading size="lg">Developer guide</Heading>
        <Text color="gray.600" _dark={{ color: "whiteAlpha.800" }}>
          This repo is a <strong>starter template</strong> for Ergo browser dApps
          (React, Chakra, Fleet SDK, optional Dynamic.xyz). Use{" "}
          <Text as="span" fontWeight="semibold">
            {siteName}
          </Text>{" "}
          as a reference implementation — then delete or replace pieces you do not
          need.
        </Text>

        <Box
          borderWidth="1px"
          borderRadius="md"
          p={4}
          borderColor="ergnome.blue"
          bg={panelBg}
        >
          <Heading size="sm" mb={2}>
            Spin-off: ERGO.games
          </Heading>
          <Text fontSize="sm" mb={2}>
            Full playbook (GitHub fork, env, domain, launch checklist):{" "}
            <Text as="span" fontFamily="mono" fontSize="xs">
              docs/FORK_ERGO_GAMES.md
            </Text>
            . Example env:{" "}
            <Text as="span" fontFamily="mono" fontSize="xs">
              .env.ergo.games.example
            </Text>
            .
          </Text>
          {githubRepoUrl ? (
            <Link
              href={`${githubRepoUrl.replace(/\/$/, "")}/blob/main/docs/FORK_ERGO_GAMES.md`}
              isExternal
              color="ergnome.blue"
              fontSize="sm"
            >
              Open spin-off guide on GitHub →
            </Link>
          ) : (
            <Text fontSize="xs" opacity={0.8}>
              After you clone, open <code>docs/FORK_ERGO_GAMES.md</code> in the repo
              root.
            </Text>
          )}
        </Box>

        <Box>
          <Heading size="md" mb={2}>
            Fork checklist
          </Heading>
          <OrderedList spacing={2} pl={1}>
            <ListItem>
              Copy <code>.env.example</code> to <code>.env</code> and set{" "}
              <code>REACT_APP_SITE_NAME</code>,{" "}
              <code>REACT_APP_SITE_DESCRIPTION</code>, and optionally{" "}
              <code>REACT_APP_GITHUB_REPO_URL</code> /{" "}
              <code>REACT_APP_SITE_URL</code>.
            </ListItem>
            <ListItem>
              Set <code>REACT_APP_WALLET_PROVIDERS</code> and{" "}
              <code>REACT_APP_DYNAMIC_ENV_ID</code> per{" "}
              <code>SETUP.md</code> in the repository root.
              {githubRepoUrl ? (
                <>
                  {" "}
                  <Link
                    href={`${githubRepoUrl.replace(/\/$/, "")}/blob/main/SETUP.md`}
                    isExternal
                    color="ergnome.blue"
                  >
                    View on GitHub
                  </Link>
                </>
              ) : null}
            </ListItem>
            <ListItem>
              Strip sample features: remove game routes from{" "}
              <code>App.tsx</code>, delete{" "}
              <code>src/components/games/</code> and{" "}
              <code>src/lib/games/</code> if you only want wallet + gallery.
            </ListItem>
            <ListItem>
              Replace example ErgoScript in <code>src/ergoscript/</code>, then
              recompile and paste new ErgoTree hex into the matching{" "}
              <code>*Contract.ts</code> files (see game modules for the pattern).
            </ListItem>
          </OrderedList>
        </Box>

        <Box>
          <Heading size="md" mb={2}>
            On-chain games (reference)
          </Heading>
          <UnorderedList spacing={2}>
            <ListItem>
              <strong>Contracts:</strong> <code>ticTacToe.es</code>,{" "}
              <code>superTicTacToe.es</code>
            </ListItem>
            <ListItem>
              <strong>Encode / decode / addresses:</strong>{" "}
              <code>ticTacToeContract.ts</code>,{" "}
              <code>superTicTacToeContract.ts</code>
            </ListItem>
            <ListItem>
              <strong>Transactions:</strong> <code>ticTacToeTx.ts</code>,{" "}
              <code>superTicTacToeTx.ts</code>
            </ListItem>
            <ListItem>
              <strong>Explorer discovery:</strong>{" "}
              <code>ticTacToeDiscovery.ts</code>,{" "}
              <code>superTicTacToeDiscovery.ts</code>,{" "}
              <code>explorerGql.ts</code> (GraphQL for long ErgoTrees)
            </ListItem>
            <ListItem>
              <strong>Legacy trees:</strong> <code>gameLegacyTrees.ts</code> —
              append old ErgoTree hexes so in-flight boxes stay discoverable after
              you ship a new contract version.
            </ListItem>
          </UnorderedList>
        </Box>

        <Box>
          <Heading size="md" mb={2}>
            Internal demos
          </Heading>
          <Text mb={2}>
            Set <code>REACT_APP_SHOW_DEV_TOOLS=true</code> to show the Rosen /
            metadata test route in the nav. Leave it unset for a clean fork.
          </Text>
        </Box>

        <Box>
          <Heading size="md" mb={2}>
            License
          </Heading>
          <Text>
            MIT — see <code>LICENSE</code> in the repository root. Example game
            contracts are <strong>not audited</strong>; use them only as learning
            material unless you review them yourself.
          </Text>
          {githubRepoUrl ? (
            <Link href={githubRepoUrl} isExternal color="ergnome.blue" mt={2}>
              Open repository →
            </Link>
          ) : null}
        </Box>

        <Link as={RouterLink} to="/" color="ergnome.blue">
          ← Back to dashboard
        </Link>
      </Stack>
    </Box>
  );
};

export default DeveloperGuidePage;
