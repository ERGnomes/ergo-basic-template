import React from 'react';
import {
  Box,
  Flex,
  Text,
  Heading,
  VStack,
  Grid,
  Button,
  Icon,
} from "@chakra-ui/react";
import { FaWallet } from 'react-icons/fa';
import { WalletData } from './WalletConnector';
import { formatTokenAmount, shortenTokenId } from '../../utils/ergo';

interface WalletDashboardProps {
  walletData: WalletData;
  onConnectWallet: () => void;
}

export const WalletDashboard: React.FC<WalletDashboardProps> = ({ 
  walletData, 
  onConnectWallet 
}) => {
  const { isConnected, ergBalance, tokens, walletStatus } = walletData;

  if (!isConnected) {
    return (
      <VStack spacing={6} p={10} align="center">
        <Heading 
          as="h2" 
          size="2xl" 
          bgGradient="linear(to-r, ergnome.blue, ergnome.purple)" 
          bgClip="text"
        >
          Ergo Wallet Explorer
        </Heading>
        <Text fontSize="xl" color="ergnome.text" textAlign="center" maxW="600px">
          Connect your Nautilus wallet to see your ERG balance and NFTs!
        </Text>
        <Button 
          size="lg" 
          leftIcon={<Icon as={FaWallet} />}
          onClick={onConnectWallet}
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
    );
  }

  return (
    <VStack spacing={8} w="100%" maxW="1200px" mx="auto" p={5}>
      <Heading 
        as="h2" 
        size="2xl" 
        bgGradient="linear(to-r, ergnome.blue, ergnome.purple)" 
        bgClip="text"
        mb={6}
      >
        Your Wallet Dashboard
      </Heading>
      
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
                  transition="all 0.3s"
                  _hover={{ 
                    boxShadow: "md", 
                    borderColor: "ergnome.green",
                    transform: "translateY(-2px)"
                  }}
                >
                  <VStack align="flex-start" spacing={1}>
                    <Text fontWeight="bold" color="ergnome.blue" isTruncated maxW="230px">
                      {token.name || 'Unknown Token'}
                    </Text>
                    <Text fontSize="sm" color="gray.400" isTruncated maxW="230px">
                      {shortenTokenId(token.tokenId)}
                    </Text>
                    <Text color="ergnome.orange" fontWeight="bold">
                      {formatTokenAmount(token.amount, token.decimals)}
                    </Text>
                  </VStack>
                </Box>
              ))}
            </Grid>
          </VStack>
        </Box>
      )}
    </VStack>
  );
}; 