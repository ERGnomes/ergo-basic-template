import React, { forwardRef, useImperativeHandle } from 'react';
import {
  Button,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Icon,
  Flex,
  Text,
  VStack,
  Image,
  Tooltip,
} from "@chakra-ui/react";
import { FaWallet, FaAngleDown } from 'react-icons/fa';
import { 
  formatTokenAmount
} from '../../utils/ergo';
import { useWallet } from '../../context/WalletContext';

export interface WalletData {
  isConnected: boolean;
  ergBalance: string;
  tokens: any[];
  walletStatus: string;
}

export const WalletConnector = forwardRef<() => void, {}>((props, ref) => {
  const { walletData, connectToWallet, disconnectFromWallet } = useWallet();
  const { isConnected, ergBalance, tokens, walletStatus } = walletData;

  // Function to get placeholder image for tokens without images
  const getPlaceholderImage = (tokenId: string, name: string) => {
    try {
      const hash = tokenId.substring(0, 6);
      const safeText = name && name.length > 0 
        ? name.charAt(0).replace(/[^\w\s]/gi, '') // Remove special characters
        : 'T'; // Default to 'T' for Token if name is empty or only has special chars
      
      return `https://via.placeholder.com/40/${hash}?text=${encodeURIComponent(safeText || 'T')}`;
    } catch (e) {
      // Fallback to a safe placeholder with no text if encoding fails
      return `https://via.placeholder.com/40/${tokenId.substring(0, 6)}`;
    }
  };

  // Expose connect method via ref
  useImperativeHandle(ref, () => connectToWallet);

  return (
    <Menu closeOnSelect={false}>
      <MenuButton
        as={Button}
        rightIcon={<Icon as={FaAngleDown} />}
        leftIcon={<Icon as={FaWallet} />}
        variant="ergnome"
        size="md"
      >
        {isConnected ? `${ergBalance} ERG` : 'Connect Wallet'}
      </MenuButton>
      <MenuList borderWidth="1px" borderColor="ergnome.blue" boxShadow="lg">
        {!isConnected ? (
          <MenuItem onClick={connectToWallet} icon={<Icon as={FaWallet} color="ergnome.blue" />}>
            Connect Nautilus Wallet
          </MenuItem>
        ) : (
          <>
            <MenuItem closeOnSelect={false}>
              <Flex align="center" justify="space-between" w="100%">
                <Text fontWeight="bold">Status:</Text>
                <Text color="ergnome.green">{walletStatus}</Text>
              </Flex>
            </MenuItem>
            <MenuItem closeOnSelect={false}>
              <Flex align="center" justify="space-between" w="100%">
                <Text fontWeight="bold">ERG Balance:</Text>
                <Text color="ergnome.yellow">{ergBalance} ERG</Text>
              </Flex>
            </MenuItem>
            {tokens.length > 0 && (
              <MenuItem closeOnSelect={false}>
                <VStack align="flex-start" spacing={3} w="100%">
                  <Text fontWeight="bold" color="ergnome.purple">Your NFTs & Tokens:</Text>
                  {tokens.slice(0, 5).map((token) => (
                    <Flex key={token.tokenId} justify="space-between" w="100%" align="center">
                      <Flex align="center">
                        <Image 
                          src={token.imageUrl || getPlaceholderImage(token.tokenId, token.name)}
                          alt={token.name}
                          boxSize="24px"
                          borderRadius="sm"
                          mr={2}
                          objectFit="cover"
                          fallbackSrc={getPlaceholderImage(token.tokenId, token.name)}
                        />
                        <Tooltip label={token.name} placement="top" hasArrow>
                          <Text fontSize="sm" isTruncated maxW="120px">{token.name}</Text>
                        </Tooltip>
                      </Flex>
                      <Text fontSize="sm" color="ergnome.orange" fontWeight="bold">
                        {formatTokenAmount(token.amount, token.decimals)}
                      </Text>
                    </Flex>
                  ))}
                  {tokens.length > 5 && (
                    <Text fontSize="sm" color="ergnome.blue" alignSelf="center">
                      +{tokens.length - 5} more tokens
                    </Text>
                  )}
                </VStack>
              </MenuItem>
            )}
            <MenuItem onClick={disconnectFromWallet} closeOnSelect={true}>
              Disconnect Wallet
            </MenuItem>
          </>
        )}
      </MenuList>
    </Menu>
  );
}); 