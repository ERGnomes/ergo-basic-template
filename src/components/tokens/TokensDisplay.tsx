import React from 'react';
import {
  Box,
  Grid,
  Text,
  Heading,
  Flex,
  VStack,
  Badge,
} from "@chakra-ui/react";
import { formatTokenAmount, shortenTokenId } from '../../utils/ergo';

interface Token {
  tokenId: string;
  amount: number;
  name: string;
  decimals: number;
}

interface TokensDisplayProps {
  tokens: Token[];
  isConnected: boolean;
}

export const TokensDisplay: React.FC<TokensDisplayProps> = ({ tokens, isConnected }) => {
  if (!isConnected || tokens.length === 0) {
    return (
      <Box p={5} textAlign="center">
        <Text fontSize="lg" color="gray.400">
          {!isConnected 
            ? "Connect your wallet to view tokens" 
            : "No tokens found in your wallet"}
        </Text>
      </Box>
    );
  }

  return (
    <Box p={5}>
      <Heading size="md" mb={4} color="ergnome.blue">
        Your Tokens ({tokens.length})
      </Heading>
      <Grid 
        templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }} 
        gap={4}
      >
        {tokens.map((token) => (
          <Box 
            key={token.tokenId} 
            p={4} 
            borderWidth="1px" 
            borderRadius="md" 
            borderColor="ergnome.blue"
            bg="ergnome.bg"
            _hover={{ 
              boxShadow: "md", 
              borderColor: "ergnome.green" 
            }}
            transition="all 0.3s"
          >
            <VStack align="start" spacing={2}>
              <Flex w="100%" justify="space-between">
                <Heading size="sm" color="ergnome.yellow" isTruncated maxW="70%">
                  {token.name}
                </Heading>
                <Badge colorScheme="blue">
                  {formatTokenAmount(token.amount, token.decimals)}
                </Badge>
              </Flex>
              <Text fontSize="xs" color="gray.400" isTruncated>
                {shortenTokenId(token.tokenId)}
              </Text>
            </VStack>
          </Box>
        ))}
      </Grid>
    </Box>
  );
}; 