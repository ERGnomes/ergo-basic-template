import React, { useState, forwardRef, useImperativeHandle } from 'react';
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
} from "@chakra-ui/react";
import { FaWallet, FaAngleDown } from 'react-icons/fa';
import { 
  connectWallet, 
  disconnectWallet, 
  formatErgAmount, 
  getTokensFromUtxos,
  formatTokenAmount 
} from '../../utils/ergo';

declare global {
  interface Window {
    ergoConnector: any;
  }
}
declare var ergo: any;

interface WalletConnectorProps {
  onWalletConnect: (data: WalletData) => void;
  onWalletDisconnect: () => void;
}

export interface WalletData {
  isConnected: boolean;
  ergBalance: string;
  tokens: any[];
  walletStatus: string;
}

export const WalletConnector = forwardRef<() => void, WalletConnectorProps>(({ 
  onWalletConnect, 
  onWalletDisconnect 
}, ref) => {
  const [walletStatus, setWalletStatus] = useState('Not connected');
  const [ergBalance, setErgBalance] = useState('0');
  const [tokens, setTokens] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  let connected: any;

  async function handleConnectWallet(): Promise<void> { 
    try {
      connected = await connectWallet();
      if (connected) {
        setWalletStatus('Connected');
        setIsConnected(true);
        
        // Get UTXOs
        const utxos = await ergo.get_utxos();
        
        // Calculate ERG balance
        const totalErg = utxos.reduce((acc: number, utxo: any) => {
          return acc + parseInt(utxo.value);
        }, 0);
        
        const formattedErgBalance = formatErgAmount(totalErg);
        setErgBalance(formattedErgBalance);

        // Get all tokens
        const tokenArray = await getTokensFromUtxos(utxos);
        setTokens(tokenArray);
        
        // Notify parent component
        onWalletConnect({
          isConnected: true,
          ergBalance: formattedErgBalance,
          tokens: tokenArray,
          walletStatus: 'Connected'
        });
      }
    } catch (error: any) {
      console.error('Error connecting to wallet:', error);
      setWalletStatus('Error: ' + error.message);
      setIsConnected(false);
    }
  }

  async function handleDisconnectWallet(): Promise<void> {
    try {
      await disconnectWallet();
      setWalletStatus('Disconnected');
      setIsConnected(false);
      setErgBalance('0');
      setTokens([]);
      onWalletDisconnect();
    } catch (error: any) {
      console.error('Error disconnecting wallet:', error);
      setWalletStatus('Error disconnecting: ' + error.message);
    }
  }

  // Expose connect method via ref
  useImperativeHandle(ref, () => handleConnectWallet);

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
          <MenuItem onClick={handleConnectWallet} icon={<Icon as={FaWallet} color="ergnome.blue" />}>
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
                <VStack align="flex-start" spacing={2} w="100%">
                  <Text fontWeight="bold" color="ergnome.purple">Your NFTs & Tokens:</Text>
                  {tokens.slice(0, 5).map((token) => (
                    <Flex key={token.tokenId} justify="space-between" w="100%">
                      <Text fontSize="sm" isTruncated maxW="150px">{token.name}:</Text>
                      <Text fontSize="sm" color="ergnome.orange">
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
            <MenuItem onClick={handleDisconnectWallet} closeOnSelect={true}>
              Disconnect Wallet
            </MenuItem>
          </>
        )}
      </MenuList>
    </Menu>
  );
}); 