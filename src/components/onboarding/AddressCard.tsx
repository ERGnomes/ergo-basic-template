import React, { useState } from "react";
import {
  Box,
  Button,
  Code,
  Collapse,
  Flex,
  HStack,
  Icon,
  IconButton,
  Link,
  Stack,
  Text,
  Tooltip,
  useClipboard,
  useColorMode,
} from "@chakra-ui/react";
import { CheckIcon, CopyIcon, ExternalLinkIcon } from "@chakra-ui/icons";
import { QRCodeSVG } from "qrcode.react";

interface Props {
  address: string;
  /** Optional context badge ("Ergo P2PK · Mainnet", "Nautilus", etc.). */
  badge?: string;
  /** Render the truncated form in-place; full form expands on click. */
  truncate?: boolean;
}

const truncateAddr = (addr: string, head = 8, tail = 6): string => {
  if (addr.length <= head + tail + 1) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
};

/**
 * One-stop component for displaying an Ergo address with the actions
 * a user actually wants on first run: copy, view-on-explorer, and a
 * QR code they can scan from a phone wallet or exchange.
 *
 * Designed to drop into any existing layout — keeps width fluid and
 * doesn't open modals so the page stays scannable.
 */
export const AddressCard: React.FC<Props> = ({
  address,
  badge = "Ergo P2PK · Mainnet",
  truncate = true,
}) => {
  const { colorMode } = useColorMode();
  const { hasCopied, onCopy } = useClipboard(address);
  const [showQr, setShowQr] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const explorerUrl = `https://explorer.ergoplatform.com/en/addresses/${encodeURIComponent(
    address
  )}`;

  const accentBorder =
    colorMode === "light" ? "ergnome.blueAccent.light" : "ergnome.blue";

  return (
    <Box
      borderWidth="1px"
      borderRadius="md"
      borderColor={accentBorder}
      p={3}
      w="100%"
    >
      <Stack spacing={2}>
        <HStack justify="space-between" align="center">
          <HStack spacing={2}>
            <Text fontSize="xs" opacity={0.7}>
              {badge}
            </Text>
          </HStack>
          <HStack spacing={1}>
            <Tooltip label={hasCopied ? "Copied!" : "Copy address"}>
              <IconButton
                aria-label="Copy address"
                size="sm"
                variant="ghost"
                icon={hasCopied ? <CheckIcon color="green.400" /> : <CopyIcon />}
                onClick={onCopy}
              />
            </Tooltip>
            <Tooltip label={showQr ? "Hide QR" : "Show QR"}>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowQr((s) => !s)}
              >
                QR
              </Button>
            </Tooltip>
            <Tooltip label="View on Ergo Explorer">
              <IconButton
                aria-label="View on Ergo Explorer"
                size="sm"
                variant="ghost"
                as={Link}
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                icon={<ExternalLinkIcon />}
              />
            </Tooltip>
          </HStack>
        </HStack>

        <Box>
          <Code
            wordBreak="break-all"
            whiteSpace={showFull || !truncate ? "pre-wrap" : "nowrap"}
            overflow="hidden"
            textOverflow={showFull || !truncate ? undefined : "ellipsis"}
            fontSize="sm"
            cursor="pointer"
            onClick={() => setShowFull((s) => !s)}
            display="block"
            w="100%"
          >
            {showFull || !truncate ? address : truncateAddr(address, 12, 10)}
          </Code>
          {truncate && (
            <Text fontSize="xs" opacity={0.6} mt={1}>
              {showFull ? "Click to truncate" : "Click to reveal full address"}
            </Text>
          )}
        </Box>

        <Collapse in={showQr} animateOpacity>
          <Flex justify="center" py={3}>
            <Box
              p={3}
              bg="white"
              borderRadius="md"
              boxShadow="sm"
              borderWidth="1px"
              borderColor={accentBorder}
            >
              <QRCodeSVG
                value={address}
                size={192}
                level="M"
                includeMargin={false}
              />
            </Box>
          </Flex>
        </Collapse>
      </Stack>
    </Box>
  );
};

export default AddressCard;
