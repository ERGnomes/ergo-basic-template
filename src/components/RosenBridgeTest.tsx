import React from 'react';
import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  Card,
  CardBody,
  Image,
  Divider,
  useColorModeValue,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  SimpleGrid
} from '@chakra-ui/react';
import { TokenData } from './common/TokenCard';
import { MetadataRenderer } from './common/MetadataRenderer';
import { parseMetadata } from '../utils/metadata';

const RosenBridgeTest: React.FC = () => {
  const bg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.200', 'gray.700');
  
  // Example token metadata formats
  const exampleTokens = [
    {
      type: "Rosen Bridge",
      metadata: {
        title: "rosen bridge wrapped HOSKY",
        originNetwork: "Cardano",
        originToken: "a0028f350aaabe0545fdcb56b039bfb08e4bb4d8c4d7c3c7d481c235.484f534b59",
        isNativeToken: false
      },
      imageUrl: "https://via.placeholder.com/300/6B7280?text=HOSKY"
    },
    {
      type: "721 Format",
      metadata: {
        "721": {
          "policy1": {
            "name": "CryptoKitty #123",
            "description": "A rare and unique digital pet",
            "image": "ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco/123",
            "traits": {
              "background": "Blue",
              "fur": "Orange",
              "eyes": "Green",
              "accessory": "Glasses"
            }
          }
        }
      },
      imageUrl: "https://via.placeholder.com/300/FFA500?text=Kitty"
    },
    {
      type: "Standard JSON",
      metadata: {
        "name": "Cool NFT #42",
        "description": "A standard JSON formatted NFT",
        "image": "ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco/42",
        "attributes": [
          { "trait_type": "Rarity", "value": "Epic" },
          { "trait_type": "Background", "value": "Cosmic" },
          { "trait_type": "Edition", "value": "First" }
        ]
      },
      imageUrl: "https://via.placeholder.com/300/42F4E2?text=Cool"
    }
  ];

  // Parse metadata for each example token
  const tokenData = exampleTokens.map(example => {
    const parsedMetadata = parseMetadata(JSON.stringify(example.metadata));
    
    return {
      tokenId: `example-${Math.random().toString(36).substring(2, 8)}`,
      name: parsedMetadata?.name || example.type,
      description: parsedMetadata?.description || "",
      imageUrl: example.imageUrl,
      metadata: parsedMetadata || undefined,
      tokenType: 'nft' as const
    } as TokenData;
  });
  
  // Render a token card
  const renderTokenCard = (token: TokenData) => (
    <Card 
      bg={bg} 
      borderColor={border} 
      borderWidth="1px" 
      borderRadius="lg" 
      overflow="hidden"
      boxShadow="md"
      height="100%"
    >
      <Box p={4} borderBottomWidth="1px" borderColor={border}>
        <Heading size="md">{token.name}</Heading>
        <Text fontSize="sm" color="gray.500">
          Format: {token.metadata?.type}
        </Text>
      </Box>
      
      <Box p={4} bg="black" textAlign="center" height="200px">
        <Image 
          src={token.imageUrl} 
          alt={token.name}
          mx="auto"
          borderRadius="md"
          maxHeight="100%"
          objectFit="contain"
        />
      </Box>
      
      <CardBody>
        <Text fontSize="sm" color="gray.500" mb={4}>
          Token ID: {token.tokenId.substring(0, 8)}
        </Text>
        
        <Divider mb={4} />
        
        {token.metadata && (
          <Box maxHeight="300px" overflowY="auto">
            <MetadataRenderer metadata={token.metadata} isModal={true} />
          </Box>
        )}
      </CardBody>
    </Card>
  );
  
  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8} align="stretch">
        <Box>
          <Heading as="h1" size="xl">Metadata Formats Test</Heading>
          <Text mt={2}>Testing the rendering of different NFT metadata formats</Text>
        </Box>
        
        <Tabs variant="enclosed">
          <TabList>
            <Tab>All Formats Side by Side</Tab>
            <Tab>Individual Formats</Tab>
          </TabList>
          
          <TabPanels>
            <TabPanel>
              <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
                {tokenData.map((token) => (
                  <Box key={token.tokenId}>
                    {renderTokenCard(token)}
                  </Box>
                ))}
              </SimpleGrid>
            </TabPanel>
            
            <TabPanel>
              <Tabs variant="soft-rounded" colorScheme="blue">
                <TabList>
                  {tokenData.map((token, index) => (
                    <Tab key={token.tokenId}>{exampleTokens[index].type}</Tab>
                  ))}
                </TabList>
                
                <TabPanels>
                  {tokenData.map((token) => (
                    <TabPanel key={token.tokenId}>
                      <Box maxW="md" mx="auto">
                        {renderTokenCard(token)}
                      </Box>
                    </TabPanel>
                  ))}
                </TabPanels>
              </Tabs>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </VStack>
    </Container>
  );
};

export default RosenBridgeTest; 