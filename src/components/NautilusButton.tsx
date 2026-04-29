import React, { useState } from "react";
import { Button, useToast, HStack, Text, Code } from "@chakra-ui/react";
import { FaWallet } from "react-icons/fa";

/**
 * Direct Nautilus (EIP-12) connect button.
 *
 * This intentionally does NOT go through Dynamic — Dynamic.xyz does not
 * ship a Nautilus connector out of the box. Wiring Nautilus into Dynamic
 * properly would require forking `@dynamic-labs/wallet-connectors` and
 * implementing a Custom Wallet Connector that translates Dynamic's
 * `WalletConnector` interface to Nautilus's EIP-12 dApp API. That is
 * tracked as a follow-up; for now, we use Nautilus directly so users
 * who already have it installed can connect with one click.
 *
 * EIP-12 reference: https://github.com/ergoplatform/eips/blob/master/eip-0012.md
 */
export const NautilusButton: React.FC<{
  onConnected?: (address: string) => void;
}> = ({ onConnected }) => {
  const [connecting, setConnecting] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const toast = useToast();

  const connect = async () => {
    setConnecting(true);
    try {
      const w = window as any;
      if (!w.ergoConnector || !w.ergoConnector.nautilus) {
        toast({
          title: "Nautilus not detected",
          description:
            "Install the Nautilus extension and reload, then try again.",
          status: "warning",
          duration: 5000,
          isClosable: true,
        });
        return;
      }

      const granted = await w.ergoConnector.nautilus.connect();
      if (!granted) {
        toast({
          title: "Connection rejected",
          description: "The Nautilus user rejected the connection request.",
          status: "info",
          duration: 4000,
          isClosable: true,
        });
        return;
      }

      // EIP-12 surface lives on `window.ergo` after a successful connect.
      const ergo = w.ergo;
      const change = await ergo.get_change_address();
      setAddress(change);
      onConnected?.(change);

      toast({
        title: "Nautilus connected",
        description: `Change address: ${change.slice(0, 10)}…`,
        status: "success",
        duration: 4000,
        isClosable: true,
      });
    } catch (err: any) {
      toast({
        title: "Nautilus connect failed",
        description: err?.message || String(err),
        status: "error",
        duration: 6000,
        isClosable: true,
      });
    } finally {
      setConnecting(false);
    }
  };

  return (
    <HStack spacing={3} align="center">
      <Button
        onClick={connect}
        leftIcon={<FaWallet />}
        colorScheme="orange"
        variant="outline"
        isLoading={connecting}
        loadingText="Connecting…"
      >
        {address ? "Nautilus connected" : "Connect Nautilus"}
      </Button>
      {address && (
        <Text fontSize="xs" maxW="240px" isTruncated title={address}>
          <Code>{address}</Code>
        </Text>
      )}
    </HStack>
  );
};
