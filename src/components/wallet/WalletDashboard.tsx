import React, { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Text,
  Heading,
  VStack,
  Button,
  Icon,
  useDisclosure,
  useColorMode,
  SimpleGrid,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  HStack,
  Badge
} from "@chakra-ui/react";
import { FaWallet } from 'react-icons/fa';
import { useWallet } from '../../context/WalletContext';
import { TokenCard, TokenData } from '../common/TokenCard';
import { TokenModal } from '../common/TokenModal';
import { processTokens, filterNFTs, filterFungibleTokens, groupByCollection } from '../../utils/tokenProcessing';

export const WalletDashboard: React.FC = () => {
  const { walletData, connectToWallet } = useWallet();
  const { isConnected, ergBalance, tokens: rawTokens, walletStatus } = walletData;
  const { colorMode } = useColorMode();
  const [selectedToken, setSelectedToken] = useState<TokenData | null>(null);
  const [processedTokens, setProcessedTokens] = useState<TokenData[]>([]);
  const [nftTokens, setNftTokens] = useState<TokenData[]>([]);
  const [fungibleTokens, setFungibleTokens] = useState<TokenData[]>([]);
  const [tokensByCollection, setTokensByCollection] = useState<Record<string, TokenData[]>>({});
  const { isOpen, onOpen, onClose } = useDisclosure();

  // Process tokens when raw tokens change
  useEffect(() => {
    if (rawTokens.length > 0) {
      // Process all tokens
      const processed = processTokens(rawTokens, {
        metadataOptions: { extractTraits: true },
        detectCollections: true,
        generatePlaceholderImage: true
      });
      
      setProcessedTokens(processed);
      
      // Filter tokens by type
      setNftTokens(filterNFTs(processed));
      setFungibleTokens(filterFungibleTokens(processed));
      
      // Group NFTs by collection
      setTokensByCollection(groupByCollection(filterNFTs(processed)));
    }
  }, [rawTokens]);

  // Function to render description with metadata support
  const renderDescription = (description: string, isModal: boolean = false) => {
    if (!description) return null;
    
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
        <Text fontSize="xl" color={colorMode === 'light' ? 'ergnome.text.light' : 'ergnome.text.dark'} textAlign="center" maxW="600px">
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
          bgGradient={colorMode === 'light' 
            ? "linear(to-r, ergnome.blueAccent.light, ergnome.purpleAccent.light)" 
            : "linear(to-r, ergnome.blue, ergnome.purple)"}
          bgClip="text"
          mb={6}
        >
          Your Wallet Dashboard
        </Heading>
        
        <Box 
          p={6} 
          borderRadius="lg" 
          bg={colorMode === 'light' ? 'ergnome.cardBg.light' : 'ergnome.cardBg.dark'}
          borderWidth="2px" 
          borderColor={colorMode === 'light' ? 'ergnome.blueAccent.light' : 'ergnome.blue'}
          w="100%"
          boxShadow="0 4px 20px rgba(65, 157, 217, 0.2)"
        >
          <VStack spacing={4} align="flex-start">
            <Heading size="lg" color={colorMode === 'light' ? 'ergnome.blueAccent.light' : 'ergnome.blue'}>Wallet Overview</Heading>
            <Flex justify="space-between" w="100%">
              <Text fontSize="lg">Status:</Text>
              <Text fontSize="lg" color={colorMode === 'light' ? 'ergnome.greenAccent.light' : 'ergnome.green'} fontWeight="bold">{walletStatus}</Text>
            </Flex>
            <Flex justify="space-between" w="100%">
              <Text fontSize="lg">ERG Balance:</Text>
              <Text fontSize="lg" color={colorMode === 'light' ? 'ergnome.yellowAccent.light' : 'ergnome.yellow'} fontWeight="bold">{ergBalance} ERG</Text>
            </Flex>
            <Flex justify="space-between" w="100%">
              <Text fontSize="lg">Tokens:</Text>
              <Text fontSize="lg" color={colorMode === 'light' ? 'ergnome.purpleAccent.light' : 'ergnome.purple'} fontWeight="bold">{processedTokens.length}</Text>
            </Flex>
            <Flex justify="space-between" w="100%">
              <Text fontSize="lg">NFTs:</Text>
              <Text fontSize="lg" color={colorMode === 'light' ? 'ergnome.purpleAccent.light' : 'ergnome.purple'} fontWeight="bold">{nftTokens.length}</Text>
            </Flex>
          </VStack>
        </Box>

        {processedTokens.length > 0 && (
          <Box 
            p={6} 
            borderRadius="lg" 
            bg="ergnome.bg" 
            borderWidth="2px" 
            borderColor={colorMode === 'light' ? 'ergnome.purpleAccent.light' : 'ergnome.purple'}
            w="100%"
            boxShadow="0 4px 20px rgba(98, 71, 170, 0.2)"
          >
            <Tabs variant="soft-rounded" colorScheme="purple" w="100%">
              <TabList mb={4}>
                <Tab>All Tokens</Tab>
                <Tab>NFTs</Tab>
                <Tab>Collections</Tab>
                <Tab>Fungible Tokens</Tab>
              </TabList>

              <TabPanels>
                {/* All Tokens Tab */}
                <TabPanel>
                  <VStack spacing={4} align="flex-start">
                    <Heading size="lg" color={colorMode === 'light' ? 'ergnome.purpleAccent.light' : 'ergnome.purple'}>All Tokens ({processedTokens.length})</Heading>
                    <SimpleGrid 
                      columns={{ base: 1, sm: 2, md: 3, lg: 4 }} 
                      spacing={6}
                      w="100%"
                    >
                      {processedTokens.map((token) => (
                        <TokenCard
                          key={token.tokenId}
                          token={token}
                          onSelect={() => handleSelectToken(token)}
                          renderDescription={renderDescription}
                        />
                      ))}
                    </SimpleGrid>
                  </VStack>
                </TabPanel>

                {/* NFTs Tab */}
                <TabPanel>
                  <VStack spacing={4} align="flex-start">
                    <Heading size="lg" color={colorMode === 'light' ? 'ergnome.purpleAccent.light' : 'ergnome.purple'}>Your NFTs ({nftTokens.length})</Heading>
                    <SimpleGrid 
                      columns={{ base: 1, sm: 2, md: 3, lg: 4 }} 
                      spacing={6}
                      w="100%"
                    >
                      {nftTokens.map((token) => (
                        <TokenCard
                          key={token.tokenId}
                          token={token}
                          onSelect={() => handleSelectToken(token)}
                          renderDescription={renderDescription}
                        />
                      ))}
                    </SimpleGrid>
                  </VStack>
                </TabPanel>

                {/* Collections Tab */}
                <TabPanel>
                  <VStack spacing={6} align="flex-start" w="100%">
                    <Heading size="lg" color={colorMode === 'light' ? 'ergnome.purpleAccent.light' : 'ergnome.purple'}>Your Collections</Heading>
                    {Object.entries(tokensByCollection).map(([collection, collectionTokens]) => (
                      <Box key={collection} w="100%" mb={6}>
                        <HStack mb={3}>
                          <Heading size="md" color={colorMode === 'light' ? 'ergnome.yellowAccent.light' : 'ergnome.yellow'}>{collection}</Heading>
                          <Badge colorScheme="blue">{collectionTokens.length}</Badge>
                        </HStack>
                        <SimpleGrid 
                          columns={{ base: 1, sm: 2, md: 3, lg: 4 }} 
                          spacing={6}
                          w="100%"
                        >
                          {collectionTokens.map((token) => (
                            <TokenCard
                              key={token.tokenId}
                              token={token}
                              onSelect={() => handleSelectToken(token)}
                              renderDescription={renderDescription}
                            />
                          ))}
                        </SimpleGrid>
                      </Box>
                    ))}
                  </VStack>
                </TabPanel>

                {/* Fungible Tokens Tab */}
                <TabPanel>
                  <VStack spacing={4} align="flex-start">
                    <Heading size="lg" color={colorMode === 'light' ? 'ergnome.purpleAccent.light' : 'ergnome.purple'}>Fungible Tokens ({fungibleTokens.length})</Heading>
                    <SimpleGrid 
                      columns={{ base: 1, sm: 2, md: 3, lg: 4 }} 
                      spacing={6}
                      w="100%"
                    >
                      {fungibleTokens.map((token) => (
                        <TokenCard
                          key={token.tokenId}
                          token={token}
                          onSelect={() => handleSelectToken(token)}
                          renderDescription={renderDescription}
                          showAmount={true}
                        />
                      ))}
                    </SimpleGrid>
                  </VStack>
                </TabPanel>
              </TabPanels>
            </Tabs>
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