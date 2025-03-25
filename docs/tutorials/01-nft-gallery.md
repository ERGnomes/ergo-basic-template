# Building an NFT Gallery with Ergo Basic Template

This tutorial will guide you through creating a personal NFT gallery to showcase your digital art collection on the Ergo blockchain.

## Overview

An NFT gallery displays your owned NFTs in a visually appealing way, allowing visitors to:
- Browse your NFT collection
- View detailed information about each NFT
- Filter NFTs by collection or attributes
- Display the artwork beautifully

## Step 1: Set Up the Project

Start with the Ergo Basic Template as your foundation:

```bash
# Clone the template
git clone https://github.com/yourusername/ergo-basic-template.git nft-gallery
cd nft-gallery

# Install dependencies
npm install
```

## Step 2: Create Gallery Components

### Create an NFT Gallery Component

Create a new file `src/components/gallery/NFTGallery.tsx`:

```tsx
import React, { useState } from 'react';
import {
  Box,
  SimpleGrid,
  Heading,
  Text,
  Image,
  Flex,
  Tag,
  Button,
} from "@chakra-ui/react";
import { shortenTokenId } from '../../utils/ergo';

// NFT data type
interface NFT {
  tokenId: string;
  name: string;
  description: string;
  imageUrl: string;
  collection?: string;
  attributes?: { trait_type: string; value: string }[];
}

interface NFTGalleryProps {
  nfts: NFT[];
  isLoading: boolean;
}

export const NFTGallery: React.FC<NFTGalleryProps> = ({ nfts, isLoading }) => {
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  
  // Get unique collections for filter
  const collections = [...new Set(nfts.map(nft => nft.collection).filter(Boolean))];
  
  // Filter NFTs by selected collection
  const filteredNFTs = selectedCollection 
    ? nfts.filter(nft => nft.collection === selectedCollection)
    : nfts;
    
  return (
    <Box p={5}>
      <Heading 
        as="h1" 
        size="2xl" 
        mb={8} 
        textAlign="center"
        bgGradient="linear(to-r, ergnome.blue, ergnome.purple)"
        bgClip="text"
      >
        My NFT Gallery
      </Heading>
      
      {/* Collection filters */}
      {collections.length > 0 && (
        <Flex wrap="wrap" mb={6} justify="center">
          <Button 
            variant={selectedCollection === null ? "solid" : "outline"} 
            colorScheme="blue" 
            m={1}
            onClick={() => setSelectedCollection(null)}
          >
            All NFTs
          </Button>
          {collections.map(collection => (
            <Button 
              key={collection} 
              variant={selectedCollection === collection ? "solid" : "outline"} 
              colorScheme="blue" 
              m={1}
              onClick={() => setSelectedCollection(collection as string)}
            >
              {collection}
            </Button>
          ))}
        </Flex>
      )}
      
      {isLoading ? (
        <Text textAlign="center">Loading your amazing NFTs...</Text>
      ) : filteredNFTs.length === 0 ? (
        <Text textAlign="center">No NFTs found. Connect your wallet to see your collection.</Text>
      ) : (
        <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing={6}>
          {filteredNFTs.map((nft) => (
            <Box 
              key={nft.tokenId}
              borderWidth="1px"
              borderRadius="lg"
              overflow="hidden"
              bg="ergnome.cardBg"
              transition="all 0.3s"
              _hover={{ 
                transform: "translateY(-5px)", 
                shadow: "lg",
                borderColor: "ergnome.blue"
              }}
            >
              <Image 
                src={nft.imageUrl} 
                alt={nft.name}
                width="100%"
                height="250px"
                objectFit="cover"
                fallbackSrc="https://via.placeholder.com/300?text=Loading+Image"
              />
              
              <Box p={4}>
                <Heading size="md" mb={2} color="ergnome.yellow">
                  {nft.name}
                </Heading>
                
                {nft.collection && (
                  <Tag size="sm" colorScheme="blue" mb={2}>
                    {nft.collection}
                  </Tag>
                )}
                
                <Text fontSize="sm" color="gray.300" noOfLines={3} mb={2}>
                  {nft.description}
                </Text>
                
                <Text fontSize="xs" color="gray.500">
                  ID: {shortenTokenId(nft.tokenId)}
                </Text>
              </Box>
            </Box>
          ))}
        </SimpleGrid>
      )}
    </Box>
  );
};
```

### Create an NFT Detail Component

Create a file `src/components/gallery/NFTDetail.tsx` for detailed view:

```tsx
import React from 'react';
import {
  Box,
  Image,
  Heading,
  Text,
  SimpleGrid,
  Flex,
  Badge,
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
} from "@chakra-ui/react";

interface NFTDetailProps {
  nft: {
    tokenId: string;
    name: string;
    description: string;
    imageUrl: string;
    collection?: string;
    attributes?: { trait_type: string; value: string }[];
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

export const NFTDetail: React.FC<NFTDetailProps> = ({ nft, isOpen, onClose }) => {
  if (!nft) return null;
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered>
      <ModalOverlay backdropFilter="blur(10px)" />
      <ModalContent bg="ergnome.cardBg" color="white">
        <ModalHeader>{nft.name}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
            <Box>
              <Image 
                src={nft.imageUrl} 
                alt={nft.name}
                borderRadius="md"
                fallbackSrc="https://via.placeholder.com/300?text=Loading+Image"
              />
            </Box>
            <Box>
              {nft.collection && (
                <Badge colorScheme="blue" mb={2}>
                  {nft.collection}
                </Badge>
              )}
              <Text mb={4}>{nft.description}</Text>
              
              <Heading size="sm" mb={2}>Properties</Heading>
              <SimpleGrid columns={2} spacing={2}>
                {nft.attributes?.map((attr, index) => (
                  <Box key={index} borderWidth="1px" borderRadius="md" p={2} borderColor="ergnome.blue">
                    <Text color="gray.400" fontSize="xs">{attr.trait_type}</Text>
                    <Text fontWeight="bold">{attr.value}</Text>
                  </Box>
                ))}
              </SimpleGrid>
              
              <Box mt={4}>
                <Text fontSize="sm" color="gray.400">Token ID</Text>
                <Text fontSize="xs" wordBreak="break-all">{nft.tokenId}</Text>
              </Box>
            </Box>
          </SimpleGrid>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
```

## Step 3: Extend Ergo Utility Functions

Add NFT-specific utility functions in `src/utils/ergo.ts`:

```typescript
// Add these functions to your existing ergo.ts file

// Function to fetch NFT metadata from token
export const fetchNFTMetadata = async (tokenId: string): Promise<any> => {
  try {
    // For real implementation, you'd fetch metadata from a service like TokenBits or IPFS
    // This is a placeholder implementation
    const tokenInfo = await fetch(`https://api.ergoplatform.com/api/v0/assets/${tokenId}`).then(r => r.json());
    
    // Parse and return NFT metadata
    return {
      tokenId: tokenId,
      name: tokenInfo.name || 'Unknown NFT',
      description: tokenInfo.description || 'No description available',
      imageUrl: tokenInfo.imageUrl || 'https://via.placeholder.com/300',
      collection: tokenInfo.collection,
      attributes: tokenInfo.attributes || []
    };
  } catch (error) {
    console.error('Error fetching NFT metadata:', error);
    return null;
  }
};

// Function to get all NFTs from wallet
export const getWalletNFTs = async (): Promise<any[]> => {
  try {
    if (!window.ergoConnector) return [];
    
    const connected = await window.ergoConnector.nautilus.isConnected();
    if (!connected) return [];
    
    // Get UTXOs from wallet
    const utxos = await ergo.get_utxos();
    
    // Extract NFTs (tokens with quantity = 1)
    const nftTokenIds: string[] = [];
    utxos.forEach((utxo: any) => {
      utxo.assets?.forEach((asset: any) => {
        // Most NFTs have a quantity of 1
        if (asset.amount === "1") {
          nftTokenIds.push(asset.tokenId);
        }
      });
    });
    
    // Fetch metadata for each NFT
    const nftsWithMetadata = await Promise.all(
      nftTokenIds.map(tokenId => fetchNFTMetadata(tokenId))
    );
    
    return nftsWithMetadata.filter(Boolean); // Remove any null results
  } catch (error) {
    console.error('Error getting wallet NFTs:', error);
    return [];
  }
};
```

## Step 4: Create a Gallery Page

Create a new page component `src/pages/GalleryPage.tsx`:

```tsx
import React, { useState, useEffect } from 'react';
import { Box, useDisclosure } from "@chakra-ui/react";
import { PageLayout } from '../components/layout/PageLayout';
import { WalletConnector } from '../components/wallet/WalletConnector';
import { NFTGallery } from '../components/gallery/NFTGallery';
import { NFTDetail } from '../components/gallery/NFTDetail';
import { getWalletNFTs } from '../utils/ergo';
import { WalletData } from '../components/wallet/WalletConnector';

export const GalleryPage: React.FC = () => {
  const [walletData, setWalletData] = useState<WalletData>({
    isConnected: false,
    ergBalance: '0',
    tokens: [],
    walletStatus: 'Not connected'
  });
  
  const [nfts, setNfts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedNFT, setSelectedNFT] = useState<any>(null);
  
  const { isOpen, onOpen, onClose } = useDisclosure();
  
  useEffect(() => {
    // Load NFTs when wallet is connected
    if (walletData.isConnected) {
      loadNFTs();
    }
  }, [walletData.isConnected]);
  
  const handleWalletConnect = (data: WalletData) => {
    setWalletData(data);
  };

  const handleWalletDisconnect = () => {
    setWalletData({
      isConnected: false,
      ergBalance: '0',
      tokens: [],
      walletStatus: 'Disconnected'
    });
    setNfts([]);
  };
  
  const loadNFTs = async () => {
    setIsLoading(true);
    try {
      const walletNFTs = await getWalletNFTs();
      setNfts(walletNFTs);
    } catch (error) {
      console.error('Error loading NFTs:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleNFTClick = (nft: any) => {
    setSelectedNFT(nft);
    onOpen();
  };
  
  return (
    <PageLayout
      title="NFT Gallery"
      navbarRightComponent={
        <WalletConnector
          onWalletConnect={handleWalletConnect}
          onWalletDisconnect={handleWalletDisconnect}
        />
      }
    >
      <NFTGallery 
        nfts={nfts} 
        isLoading={isLoading} 
        onNFTClick={handleNFTClick}
      />
      <NFTDetail 
        nft={selectedNFT} 
        isOpen={isOpen} 
        onClose={onClose} 
      />
    </PageLayout>
  );
};
```

## Step 5: Update App.tsx

Update your `src/App.tsx` to use the new gallery page:

```tsx
import React from 'react';
import { ChakraProvider } from "@chakra-ui/react";
import theme from './theme';
import { GalleryPage } from './pages/GalleryPage';

export const App = () => {
  return (
    <ChakraProvider theme={theme}>
      <GalleryPage />
    </ChakraProvider>
  );
};
```

## Step 6: Run and Test

```bash
npm start
```

Your NFT gallery will display all NFTs from your connected wallet with filtering capability by collection.

## Customization Ideas

1. **Add Search**: Implement search functionality to find NFTs by name or attributes.
2. **3D Gallery**: Use Three.js to create a 3D virtual gallery experience.
3. **Social Sharing**: Add buttons to share NFTs on social media.
4. **External API**: Connect to external APIs like TokenBits for richer NFT metadata.

## Final Result

You'll have a beautiful NFT gallery that:
- Connects to your Ergo wallet
- Displays all your NFTs in a responsive grid
- Allows filtering by collection
- Shows detailed NFT information in a modal
- Has smooth animations and hover effects

This gallery can be further customized with your own branding and additional features! 