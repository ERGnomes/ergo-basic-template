import React, { useState } from 'react';
import {
  Box,
  Flex,
  Text,
  Heading,
  VStack,
  Grid,
  Button,
  Icon,
  useDisclosure
} from "@chakra-ui/react";
import { FaWallet } from 'react-icons/fa';
import { useWallet } from '../../context/WalletContext';
import { TokenCard, TokenData } from '../common/TokenCard';
import { TokenModal } from '../common/TokenModal';
import { is721Metadata } from '../../utils/ergo';
import { parse721Metadata } from '../../utils/metadata';
import { MetadataRenderer } from '../common/MetadataRenderer';

export const WalletDashboard: React.FC = () => {
  const { walletData, connectToWallet } = useWallet();
  const { isConnected, ergBalance, tokens, walletStatus } = walletData;
  const [selectedToken, setSelectedToken] = useState<TokenData | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  // Function to check if a string is a URL
  const isUrl = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return urlRegex.test(text);
  };

  // Function to render description with clickable links or 721 metadata
  const renderDescription = (description: string, isModal: boolean = false) => {
    if (!description) return null;
    
    // Check if description is 721 metadata
    if (is721Metadata(description)) {
      const metadata = parse721Metadata(description);
      if (metadata) {
        return <MetadataRenderer metadata={metadata} isModal={isModal} />;
      }
    }
    
    // Check if description is a URL
    if (isUrl(description)) {
      return (
        <a href={description} target="_blank" rel="noopener noreferrer">
          {isModal ? description : `${description.substring(0, 30)}...`}
        </a>
      );
    }
    
    return <Text fontSize={isModal ? "md" : "sm"} noOfLines={isModal ? undefined : 2}>{description}</Text>;
  };

  // Handle selecting a token for modal view
  const handleSelectToken = (token: TokenData) => {
    setSelectedToken(token);
    onOpen();
  };

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
          onClick={connectToWallet}
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
    <>
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
                  <TokenCard
                    key={token.tokenId}
                    token={token}
                    onSelect={() => handleSelectToken(token)}
                    renderDescription={renderDescription}
                  />
                ))}
              </Grid>
            </VStack>
          </Box>
        )}
      </VStack>
      
      {/* Token Detail Modal */}
      <TokenModal
        token={selectedToken}
        isOpen={isOpen}
        onClose={onClose}
        renderDescription={renderDescription}
      />
    </>
  );
}; 