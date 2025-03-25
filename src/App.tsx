import React, { useEffect, useState, useRef } from 'react';
import {
  ChakraProvider,
  Box,
  Flex,
  Grid,
  Text,
  VStack,
  Heading,
  Button,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Icon,
  useDisclosure,
  extendTheme,
  Image,
} from "@chakra-ui/react";
import { FaWallet, FaCoins, FaAngleDown } from 'react-icons/fa';
import { ColorModeSwitcher } from "./ColorModeSwitcher";

import { OutputBuilder, TransactionBuilder } from "@fleet-sdk/core";

// Custom theme inspired by ERGnomes.io
const theme = extendTheme({
  colors: {
    ergnome: {
      purple: "#6247aa",
      blue: "#419dd9",
      green: "#53ba83",
      yellow: "#f5cb5c",
      orange: "#e8871e",
      red: "#e15554",
      bg: "#111827",
      text: "#f3f4f6",
    },
  },
  styles: {
    global: {
      body: {
        bg: "#111827",
        color: "#f3f4f6",
      },
    },
  },
  components: {
    Button: {
      variants: {
        ergnome: {
          bg: "#419dd9",
          color: "white",
          _hover: {
            bg: "#53ba83",
          },
        },
      },
    },
    MenuList: {
      baseStyle: {
        bg: "#111827",
        borderColor: "#419dd9",
      },
    },
    MenuItem: {
      baseStyle: {
        _hover: {
          bg: "#1f2937",
        },
      },
    },
  },
});

declare global {
  interface Window {
    ergoConnector: any;
  }
}
declare var ergo: any;
var connected: any;

export const App = () => {
  const [walletStatus, setWalletStatus] = useState('Not connected');
  const [ergBalance, setErgBalance] = useState('0');
  const [tokens, setTokens] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const walletMenuRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Removed auto-connect
  }, []);

  async function connectWallet(): Promise<void> { 
    try {
      connected = await window.ergoConnector.nautilus.connect(); 
      if (connected) {
        setWalletStatus('Connected');
        setIsConnected(true);
        
        // Get UTXOs
        const utxos = await ergo.get_utxos();
        
        // Calculate ERG balance
        const totalErg = utxos.reduce((acc: number, utxo: any) => {
          return acc + parseInt(utxo.value);
        }, 0);
        setErgBalance((totalErg / 1000000000).toFixed(4));

        // Get all unique tokens
        const tokenMap = new Map();
        utxos.forEach((utxo: any) => {
          utxo.assets?.forEach((asset: any) => {
            if (!tokenMap.has(asset.tokenId)) {
              tokenMap.set(asset.tokenId, {
                tokenId: asset.tokenId,
                amount: 0,
                name: asset.name || 'Unknown Token',
                decimals: asset.decimals || 0
              });
            }
            const token = tokenMap.get(asset.tokenId);
            token.amount += parseInt(asset.amount);
          });
        });
        setTokens(Array.from(tokenMap.values()));
      }
    } catch (error: any) {
      console.error('Error connecting to wallet:', error);
      setWalletStatus('Error: ' + error.message);
      setIsConnected(false);
    }
  }

  async function disconnectWallet(): Promise<void> {
    try {
      if (connected) {
        await window.ergoConnector.nautilus.disconnect();
        setWalletStatus('Disconnected');
        setIsConnected(false);
        setErgBalance('0');
        setTokens([]);
      }
    } catch (error: any) {
      console.error('Error disconnecting wallet:', error);
      setWalletStatus('Error disconnecting: ' + error.message);
    }
  }

  return (
    <ChakraProvider theme={theme}>
      <Box>
        {/* Navigation Bar */}
        <Flex 
          as="nav" 
          align="center" 
          justify="space-between" 
          wrap="wrap" 
          padding="1.5rem" 
          bg="ergnome.bg" 
          color="ergnome.text"
          borderBottom="2px solid"
          borderColor="ergnome.blue"
        >
          {/* Logo and Title */}
          <Flex align="center" mr={5}>
            <Heading as="h1" size="lg" letterSpacing="tight" color="ergnome.blue">
              Ergo Wallet Explorer
            </Heading>
          </Flex>

          {/* Wallet Menu */}
          <Menu>
            <MenuButton
              as={Button}
              rightIcon={<Icon as={FaAngleDown} />}
              leftIcon={<Icon as={FaWallet} />}
              variant="ergnome"
              size="md"
              ref={walletMenuRef}
            >
              {isConnected ? `${ergBalance} ERG` : 'Connect Wallet'}
            </MenuButton>
            <MenuList borderWidth="1px" borderColor="ergnome.blue" boxShadow="lg">
              {!isConnected ? (
                <MenuItem onClick={connectWallet} icon={<Icon as={FaWallet} color="ergnome.blue" />}>
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
                              {(token.amount / Math.pow(10, token.decimals)).toFixed(2)}
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
                  <MenuItem 
                    onClick={disconnectWallet} 
                    icon={<Icon as={FaWallet} color="ergnome.red" />}
                    _hover={{ bg: "ergnome.red", color: "white" }}
                  >
                    Disconnect Wallet
                  </MenuItem>
                </>
              )}
            </MenuList>
          </Menu>
        </Flex>

        {/* Main Content */}
        <Box py={10} px={6}>
          <VStack spacing={8} align="center">
            <Heading 
              as="h2" 
              size="2xl" 
              bgGradient="linear(to-r, ergnome.blue, ergnome.purple)" 
              bgClip="text"
            >
              Ergo Wallet Explorer
            </Heading>
            
            {!isConnected ? (
              <VStack spacing={6}>
                <Text fontSize="xl" color="ergnome.text" textAlign="center" maxW="600px">
                  Connect your Nautilus wallet to see your ERG balance and NFTs!
                </Text>
                <Button 
                  size="lg" 
                  leftIcon={<Icon as={FaWallet} />}
                  onClick={connectWallet}
                  bgGradient="linear(to-r, ergnome.blue, ergnome.purple)"
                  color="white"
                  _hover={{
                    bgGradient: "linear(to-r, ergnome.purple, ergnome.blue)",
                  }}
                  px={8}
                  py={6}
                  fontSize="xl"
                >
                  Connect Wallet
                </Button>
              </VStack>
            ) : (
              <VStack spacing={8} w="100%" maxW="800px">
                <Box 
                  p={6} 
                  borderRadius="lg" 
                  bg="ergnome.bg" 
                  borderWidth="2px" 
                  borderColor="ergnome.blue"
                  w="100%"
                  boxShadow="0 4px 20px rgba(65, 157, 217, 0.2)"
                >
                  <VStack spacing={4} align="flex-start">
                    <Heading size="lg" color="ergnome.blue">Wallet Overview</Heading>
                    <Flex justify="space-between" w="100%">
                      <Text fontSize="lg">Status:</Text>
                      <Text fontSize="lg" color="ergnome.green" fontWeight="bold">{walletStatus}</Text>
                    </Flex>
                    <Flex justify="space-between" w="100%">
                      <Text fontSize="lg">ERG Balance:</Text>
                      <Text fontSize="lg" color="ergnome.yellow" fontWeight="bold">{ergBalance} ERG</Text>
                    </Flex>
                    <Flex justify="space-between" w="100%">
                      <Text fontSize="lg">Tokens:</Text>
                      <Text fontSize="lg" color="ergnome.purple" fontWeight="bold">{tokens.length}</Text>
                    </Flex>
                  </VStack>
                </Box>

                {tokens.length > 0 && (
                  <Box 
                    p={6} 
                    borderRadius="lg" 
                    bg="ergnome.bg" 
                    borderWidth="2px" 
                    borderColor="ergnome.purple"
                    w="100%"
                    boxShadow="0 4px 20px rgba(98, 71, 170, 0.2)"
                  >
                    <VStack spacing={4} align="flex-start">
                      <Heading size="lg" color="ergnome.purple">Your Tokens & NFTs</Heading>
                      <Grid 
                        templateColumns="repeat(auto-fill, minmax(250px, 1fr))" 
                        gap={4} 
                        w="100%"
                      >
                        {tokens.map((token) => (
                          <Box 
                            key={token.tokenId} 
                            p={4} 
                            borderRadius="md" 
                            bg="#1f2937" 
                            borderWidth="1px"
                            borderColor="ergnome.blue"
                          >
                            <VStack align="flex-start" spacing={1}>
                              <Text fontWeight="bold" color="ergnome.blue" isTruncated maxW="230px">
                                {token.name || 'Unknown Token'}
                              </Text>
                              <Text fontSize="sm" color="gray.400" isTruncated maxW="230px">
                                {token.tokenId.substring(0, 8)}...{token.tokenId.substring(token.tokenId.length - 8)}
                              </Text>
                              <Text color="ergnome.orange" fontWeight="bold">
                                {(token.amount / Math.pow(10, token.decimals)).toFixed(token.decimals ? 2 : 0)}
                              </Text>
                            </VStack>
                          </Box>
                        ))}
                      </Grid>
                    </VStack>
                  </Box>
                )}
                
                <Button 
                  onClick={disconnectWallet} 
                  size="lg" 
                  colorScheme="red"
                  leftIcon={<Icon as={FaWallet} />}
                >
                  Disconnect Wallet
                </Button>
              </VStack>
            )}
          </VStack>
        </Box>
      </Box>
    </ChakraProvider>
  );
};
