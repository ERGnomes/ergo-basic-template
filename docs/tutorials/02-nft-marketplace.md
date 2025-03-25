# Building an NFT Marketplace with Ergo Basic Template

This tutorial will guide you through creating a marketplace where users can list, buy, and sell NFTs on the Ergo blockchain.

## Overview

An NFT marketplace enables users to:
- List their NFTs for sale
- Browse available NFTs
- Make purchases using ERG
- Track sales and ownership history

## Step 1: Set Up the Project

Start with the Ergo Basic Template:

```bash
# Clone the template
git clone https://github.com/yourusername/ergo-basic-template.git nft-marketplace
cd nft-marketplace

# Install dependencies
npm install @fleet-sdk/common @fleet-sdk/serializer
```

## Step 2: Add Marketplace Smart Contract Functions

Create a new utility file `src/utils/market.ts` for marketplace-specific functions:

```typescript
import { 
  OutputBuilder, 
  TransactionBuilder, 
  SigmaPropConstant, 
  ErgoAddress,
  Box,
  RECOMMENDED_MIN_FEE_VALUE,
} from "@fleet-sdk/core";

// Function to create a sale order for an NFT
export const listNFTForSale = async (
  tokenId: string,
  sellerAddress: string,
  priceInERG: number,
  royaltyRecipient?: string,
  royaltyPercent: number = 0
): Promise<string> => {
  try {
    // Check if wallet is connected
    if (!window.ergoConnector) throw new Error("Wallet not connected");
    const connected = await window.ergoConnector.nautilus.isConnected();
    if (!connected) throw new Error("Wallet not connected");
    
    const height = await ergo.get_current_height();
    const priceInNanoErg = priceInERG * 1000000000;
    
    // Get the NFT from the wallet
    const nftBox = await findNFTBoxInWallet(tokenId);
    if (!nftBox) throw new Error("NFT not found in wallet");
    
    // Create a contract that will hold the NFT until sale
    const sellerErgoTree = ErgoAddress.fromBase58(sellerAddress).ergoTree;
    
    // Simple contract allowing buyer to take NFT by paying,
    // or seller to reclaim NFT at any time
    const contractScript = `{
      val buyerPays = INPUTS.exists(_.value >= ${priceInNanoErg})
      val sellerReclaims = CONTEXT.dataInputs(0).R4[SigmaProp].get == seller
      
      buyerPays || sellerReclaims
    }`;
    
    // Create a transaction that sends the NFT to the contract
    const unsignedTx = new TransactionBuilder(height)
      .from([nftBox]) // the box containing the NFT
      .to(
        new OutputBuilder(1000000, contractScript) // min value, with our script
          .addTokens({ 
            tokenId: tokenId, 
            amount: "1" 
          })
          .setAdditionalRegisters({
            R4: SigmaPropConstant(sellerErgoTree),
            R5: priceInNanoErg, // asking price
            R6: royaltyRecipient ? ErgoAddress.fromBase58(royaltyRecipient).ergoTree : null,
            R7: royaltyPercent,
          })
      )
      .sendChangeTo(sellerAddress)
      .payMinFee()
      .build();
    
    // Sign and submit transaction
    const signedTx = await ergo.sign_tx(unsignedTx);
    const txId = await ergo.submit_tx(signedTx);
    
    return txId;
  } catch (error) {
    console.error("Error listing NFT for sale:", error);
    throw error;
  }
};

// Function to purchase an NFT from the marketplace
export const purchaseNFT = async (
  saleBoxId: string,
  buyerAddress: string
): Promise<string> => {
  try {
    // Check if wallet is connected
    if (!window.ergoConnector) throw new Error("Wallet not connected");
    const connected = await window.ergoConnector.nautilus.isConnected();
    if (!connected) throw new Error("Wallet not connected");
    
    const height = await ergo.get_current_height();
    
    // Get the sale box from blockchain
    const saleBox = await getSaleBoxById(saleBoxId);
    if (!saleBox) throw new Error("Sale not found");
    
    const tokenId = saleBox.assets[0].tokenId; // The NFT token ID
    const price = saleBox.additionalRegisters.R5.renderedValue; // Price in nanoERG
    const sellerAddress = ergAddressFromErgoTree(saleBox.additionalRegisters.R4.serializedValue);
    
    // Check if royalty is included
    let royaltyAddress = null;
    let royaltyPercent = 0;
    
    if (saleBox.additionalRegisters.R6 && saleBox.additionalRegisters.R7) {
      royaltyAddress = ergAddressFromErgoTree(saleBox.additionalRegisters.R6.serializedValue);
      royaltyPercent = saleBox.additionalRegisters.R7.renderedValue / 100;
    }
    
    // Create transaction
    let txBuilder = new TransactionBuilder(height)
      .from([saleBox]) // the sale box containing the NFT
      .withDataFrom([saleBox]); // reference the sale box as a data input
    
    // Add buyer's input boxes to cover payment
    const inputBoxes = await ergo.get_utxos(price + RECOMMENDED_MIN_FEE_VALUE);
    txBuilder = txBuilder.from(inputBoxes);
    
    // Send NFT to buyer
    txBuilder = txBuilder.to(
      new OutputBuilder(1000000, buyerAddress)
        .addTokens({ tokenId, amount: "1" })
    );
    
    // Send payment to seller (and royalty recipient if applicable)
    if (royaltyAddress && royaltyPercent > 0) {
      const royaltyAmount = Math.floor(price * royaltyPercent);
      const sellerAmount = price - royaltyAmount;
      
      // Payment to original creator (royalty)
      txBuilder = txBuilder.to(
        new OutputBuilder(royaltyAmount, royaltyAddress)
      );
      
      // Payment to seller (minus royalty)
      txBuilder = txBuilder.to(
        new OutputBuilder(sellerAmount, sellerAddress)
      );
    } else {
      // Payment to seller (full amount)
      txBuilder = txBuilder.to(
        new OutputBuilder(price, sellerAddress)
      );
    }
    
    // Send change back to buyer
    const unsignedTx = txBuilder
      .sendChangeTo(buyerAddress)
      .payMinFee()
      .build();
    
    // Sign and submit transaction
    const signedTx = await ergo.sign_tx(unsignedTx);
    const txId = await ergo.submit_tx(signedTx);
    
    return txId;
  } catch (error) {
    console.error("Error purchasing NFT:", error);
    throw error;
  }
};

// Function to cancel a listing and reclaim NFT
export const cancelNFTListing = async (
  saleBoxId: string,
  sellerAddress: string
): Promise<string> => {
  try {
    // Check if wallet is connected
    if (!window.ergoConnector) throw new Error("Wallet not connected");
    const connected = await window.ergoConnector.nautilus.isConnected();
    if (!connected) throw new Error("Wallet not connected");
    
    const height = await ergo.get_current_height();
    
    // Get the sale box
    const saleBox = await getSaleBoxById(saleBoxId);
    if (!saleBox) throw new Error("Sale not found");
    
    // Verify caller is the seller
    const boxSellerErgoTree = saleBox.additionalRegisters.R4.serializedValue;
    const callerErgoTree = ErgoAddress.fromBase58(sellerAddress).ergoTree;
    
    if (boxSellerErgoTree !== callerErgoTree) {
      throw new Error("Only the seller can cancel this listing");
    }
    
    const tokenId = saleBox.assets[0].tokenId; // The NFT token ID
    
    // Create transaction
    const unsignedTx = new TransactionBuilder(height)
      .from([saleBox]) // the sale box containing the NFT
      .withDataFrom([saleBox]) // reference the sale box as a data input
      .to(
        new OutputBuilder(1000000, sellerAddress)
          .addTokens({ tokenId, amount: "1" })
      )
      .sendChangeTo(sellerAddress)
      .payMinFee()
      .build();
    
    // Sign and submit transaction
    const signedTx = await ergo.sign_tx(unsignedTx);
    const txId = await ergo.submit_tx(signedTx);
    
    return txId;
  } catch (error) {
    console.error("Error canceling NFT listing:", error);
    throw error;
  }
};

// Helper function to find a specific NFT in the wallet
async function findNFTBoxInWallet(tokenId: string): Promise<Box | null> {
  const utxos = await ergo.get_utxos();
  
  for (const box of utxos) {
    if (box.assets) {
      for (const asset of box.assets) {
        if (asset.tokenId === tokenId && asset.amount === "1") {
          return box;
        }
      }
    }
  }
  
  return null;
}

// Helper function to get a sale box by ID
async function getSaleBoxById(boxId: string): Promise<Box | null> {
  try {
    const response = await fetch(`https://api.ergoplatform.com/api/v1/boxes/${boxId}`);
    if (!response.ok) return null;
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching box:", error);
    return null;
  }
}

// Helper function to convert ErgoTree to address
function ergAddressFromErgoTree(ergoTree: string): string {
  return ErgoAddress.fromErgoTree(ergoTree).encode();
}
```

## Step 3: Create NFT Listing Components

Create a file `src/components/marketplace/NFTListing.tsx`:

```tsx
import React, { useState } from 'react';
import {
  Box,
  Image,
  Heading,
  Text,
  Button,
  HStack,
  VStack,
  Badge,
  useToast,
  Spinner,
} from "@chakra-ui/react";
import { FaTag, FaShoppingCart } from 'react-icons/fa';
import { purchaseNFT } from '../../utils/market';
import { shortenTokenId } from '../../utils/ergo';

interface NFTListingProps {
  listing: {
    boxId: string;
    tokenId: string;
    name: string;
    description: string;
    imageUrl: string;
    priceInERG: number;
    sellerAddress: string;
  };
  userAddress: string;
  onPurchase: () => void;
}

export const NFTListing: React.FC<NFTListingProps> = ({ 
  listing, 
  userAddress, 
  onPurchase 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();
  
  const handlePurchase = async () => {
    try {
      setIsLoading(true);
      const txId = await purchaseNFT(listing.boxId, userAddress);
      
      toast({
        title: "Purchase successful!",
        description: `Transaction ID: ${txId.substring(0, 8)}...`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });
      
      onPurchase();
    } catch (error: any) {
      toast({
        title: "Purchase failed",
        description: error.message || "An error occurred",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const isSeller = userAddress === listing.sellerAddress;
  
  return (
    <Box 
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
        src={listing.imageUrl} 
        alt={listing.name}
        width="100%"
        height="250px"
        objectFit="cover"
        fallbackSrc="https://via.placeholder.com/300?text=Loading+Image"
      />
      
      <Box p={4}>
        <Heading size="md" mb={2} color="ergnome.yellow">
          {listing.name}
        </Heading>
        
        <Text fontSize="sm" color="gray.300" noOfLines={2} mb={2}>
          {listing.description}
        </Text>
        
        <HStack justify="space-between" mb={2}>
          <Badge colorScheme="green" fontSize="lg" px={2} py={1}>
            {listing.priceInERG} ERG
          </Badge>
          <Text fontSize="xs" color="gray.500">
            ID: {shortenTokenId(listing.tokenId)}
          </Text>
        </HStack>
        
        <Button 
          width="100%"
          colorScheme={isSeller ? "gray" : "blue"}
          isDisabled={isSeller}
          leftIcon={isSeller ? <FaTag /> : <FaShoppingCart />}
          onClick={!isSeller ? handlePurchase : undefined}
          isLoading={isLoading}
        >
          {isSeller ? "Your Listing" : "Buy Now"}
        </Button>
      </Box>
    </Box>
  );
};
```

## Step 4: Create a Listing Form

Create a file `src/components/marketplace/ListNFTForm.tsx`:

```tsx
import React, { useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Button,
  FormControl,
  FormLabel,
  Input,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Select,
  VStack,
  Checkbox,
  useToast,
  Text,
  Image,
  Flex,
} from "@chakra-ui/react";
import { listNFTForSale } from '../../utils/market';

interface ListNFTFormProps {
  isOpen: boolean;
  onClose: () => void;
  userAddress: string;
  nfts: Array<{
    tokenId: string;
    name: string;
    imageUrl: string;
  }>;
  onListingCreated: () => void;
}

export const ListNFTForm: React.FC<ListNFTFormProps> = ({ 
  isOpen, 
  onClose, 
  userAddress, 
  nfts,
  onListingCreated
}) => {
  const [selectedNFT, setSelectedNFT] = useState('');
  const [price, setPrice] = useState(1);
  const [includeRoyalty, setIncludeRoyalty] = useState(false);
  const [royaltyAddress, setRoyaltyAddress] = useState('');
  const [royaltyPercent, setRoyaltyPercent] = useState(5);
  const [isLoading, setIsLoading] = useState(false);
  
  const toast = useToast();
  
  const handleSubmit = async () => {
    if (!selectedNFT || price <= 0) {
      toast({
        title: "Invalid input",
        description: "Please select an NFT and set a valid price",
        status: "error",
        duration: 3000,
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      const txId = await listNFTForSale(
        selectedNFT,
        userAddress,
        price,
        includeRoyalty ? royaltyAddress : undefined,
        includeRoyalty ? royaltyPercent : 0
      );
      
      toast({
        title: "NFT listed for sale!",
        description: `Transaction ID: ${txId.substring(0, 8)}...`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });
      
      onListingCreated();
      onClose();
    } catch (error: any) {
      toast({
        title: "Listing failed",
        description: error.message || "An error occurred",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const selectedNFTData = nfts.find(nft => nft.tokenId === selectedNFT);
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay backdropFilter="blur(10px)" />
      <ModalContent bg="ergnome.cardBg" color="white">
        <ModalHeader>List Your NFT for Sale</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <FormControl isRequired>
              <FormLabel>Select NFT</FormLabel>
              <Select 
                placeholder="Choose an NFT" 
                value={selectedNFT}
                onChange={(e) => setSelectedNFT(e.target.value)}
              >
                {nfts.map(nft => (
                  <option key={nft.tokenId} value={nft.tokenId}>
                    {nft.name}
                  </option>
                ))}
              </Select>
            </FormControl>
            
            {selectedNFTData && (
              <Flex justifyContent="center" mb={4}>
                <Image 
                  src={selectedNFTData.imageUrl}
                  alt={selectedNFTData.name}
                  maxHeight="150px"
                  borderRadius="md"
                />
              </Flex>
            )}
            
            <FormControl isRequired>
              <FormLabel>Price (ERG)</FormLabel>
              <NumberInput 
                min={0.1} 
                precision={2} 
                value={price} 
                onChange={(_, val) => setPrice(val)}
              >
                <NumberInputField />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
            </FormControl>
            
            <Checkbox 
              isChecked={includeRoyalty} 
              onChange={(e) => setIncludeRoyalty(e.target.checked)}
              colorScheme="blue"
            >
              Include royalties for original creator
            </Checkbox>
            
            {includeRoyalty && (
              <>
                <FormControl isRequired>
                  <FormLabel>Royalty Recipient Address</FormLabel>
                  <Input 
                    value={royaltyAddress} 
                    onChange={(e) => setRoyaltyAddress(e.target.value)}
                    placeholder="Enter Ergo address for royalty payments"
                  />
                </FormControl>
                
                <FormControl isRequired>
                  <FormLabel>Royalty Percentage</FormLabel>
                  <NumberInput 
                    min={1} 
                    max={30}
                    value={royaltyPercent} 
                    onChange={(_, val) => setRoyaltyPercent(val)}
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                  <Text fontSize="sm" color="gray.400" mt={1}>
                    Recommended: 5-10%
                  </Text>
                </FormControl>
              </>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button 
            colorScheme="blue" 
            onClick={handleSubmit}
            isLoading={isLoading}
          >
            List for Sale
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
```

## Step 5: Create the Marketplace Page

Create a new file `src/pages/MarketplacePage.tsx`:

```tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  SimpleGrid,
  Heading,
  Button,
  Text,
  Flex,
  useDisclosure,
  Spinner,
  InputGroup,
  Input,
  InputRightElement,
  IconButton,
} from "@chakra-ui/react";
import { FaPlus, FaSearch } from 'react-icons/fa';
import { PageLayout } from '../components/layout/PageLayout';
import { WalletConnector, WalletData } from '../components/wallet/WalletConnector';
import { NFTListing } from '../components/marketplace/NFTListing';
import { ListNFTForm } from '../components/marketplace/ListNFTForm';
import { getWalletNFTs } from '../utils/ergo';

// Mock function to get marketplace listings - in a real application you would fetch these from your backend
const getMarketplaceListings = async () => {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Return mock data
  return [
    {
      boxId: "mock-box-id-1",
      tokenId: "mock-token-id-1",
      name: "Ergo Ape #123",
      description: "A unique Ergo Ape NFT with rare attributes",
      imageUrl: "https://via.placeholder.com/300/2a4365/ffffff?text=Ergo+Ape",
      priceInERG: 15,
      sellerAddress: "9f4QF8AD1nQ3nJahQVkMj8hFSVVzVom77b52JU7EW71Zexg6N8v"
    },
    {
      boxId: "mock-box-id-2",
      tokenId: "mock-token-id-2",
      name: "Ergo Punk #456",
      description: "A cyberpunk-themed NFT on Ergo",
      imageUrl: "https://via.placeholder.com/300/553c9a/ffffff?text=Ergo+Punk",
      priceInERG: 7.5,
      sellerAddress: "your-address-here" // replace with the current user's address to test "own listing" feature
    },
    // Add more mock listings as needed
  ];
};

export const MarketplacePage: React.FC = () => {
  const [walletData, setWalletData] = useState<WalletData>({
    isConnected: false,
    ergBalance: '0',
    tokens: [],
    walletStatus: 'Not connected'
  });
  
  const [listings, setListings] = useState<any[]>([]);
  const [userNFTs, setUserNFTs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const { isOpen, onOpen, onClose } = useDisclosure();
  const walletConnectorRef = useRef<() => void>(() => {});
  
  // Get user's wallet address
  const userAddress = ''; // In a real app, get this from wallet connection
  
  useEffect(() => {
    loadMarketplaceListings();
  }, []);
  
  useEffect(() => {
    if (walletData.isConnected) {
      loadUserNFTs();
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
    setUserNFTs([]);
  };
  
  const loadMarketplaceListings = async () => {
    setIsLoading(true);
    try {
      const fetchedListings = await getMarketplaceListings();
      setListings(fetchedListings);
    } catch (error) {
      console.error('Error loading marketplace listings:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const loadUserNFTs = async () => {
    try {
      const nfts = await getWalletNFTs();
      setUserNFTs(nfts);
    } catch (error) {
      console.error('Error loading user NFTs:', error);
    }
  };
  
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  const filteredListings = listings.filter(listing => 
    listing.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <PageLayout
      title="NFT Marketplace"
      navbarRightComponent={
        <WalletConnector
          onWalletConnect={handleWalletConnect}
          onWalletDisconnect={handleWalletDisconnect}
          ref={walletConnectorRef}
        />
      }
    >
      <Box p={5}>
        <Flex 
          justify="space-between" 
          align="center" 
          wrap="wrap" 
          mb={8}
        >
          <Heading 
            as="h1" 
            size="2xl" 
            bgGradient="linear(to-r, ergnome.blue, ergnome.purple)"
            bgClip="text"
          >
            NFT Marketplace
          </Heading>
          
          {walletData.isConnected && (
            <Button 
              colorScheme="blue" 
              leftIcon={<FaPlus />}
              onClick={onOpen}
            >
              List an NFT
            </Button>
          )}
        </Flex>
        
        <InputGroup mb={8} maxW="500px" mx="auto">
          <Input 
            placeholder="Search NFTs..." 
            value={searchTerm}
            onChange={handleSearch}
            bg="ergnome.cardBg"
            borderColor="ergnome.blue"
            _hover={{ borderColor: "ergnome.purple" }}
          />
          <InputRightElement>
            <IconButton 
              icon={<FaSearch />} 
              aria-label="Search" 
              variant="ghost" 
              colorScheme="blue"
            />
          </InputRightElement>
        </InputGroup>
        
        {isLoading ? (
          <Flex justify="center" my={10}>
            <Spinner size="xl" color="ergnome.blue" />
          </Flex>
        ) : filteredListings.length === 0 ? (
          <Text textAlign="center" fontSize="lg" color="gray.400">
            No NFTs found. {!walletData.isConnected && "Connect your wallet to list your NFTs!"}
          </Text>
        ) : (
          <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing={6}>
            {filteredListings.map((listing) => (
              <NFTListing 
                key={listing.boxId}
                listing={listing}
                userAddress={userAddress}
                onPurchase={loadMarketplaceListings}
              />
            ))}
          </SimpleGrid>
        )}
      </Box>
      
      <ListNFTForm 
        isOpen={isOpen}
        onClose={onClose}
        userAddress={userAddress}
        nfts={userNFTs}
        onListingCreated={loadMarketplaceListings}
      />
    </PageLayout>
  );
};
```

## Step 6: Update App.tsx

Update your `src/App.tsx` to use the new marketplace page:

```tsx
import React from 'react';
import { ChakraProvider } from "@chakra-ui/react";
import theme from './theme';
import { MarketplacePage } from './pages/MarketplacePage';

export const App = () => {
  return (
    <ChakraProvider theme={theme}>
      <MarketplacePage />
    </ChakraProvider>
  );
};
```

## Step 7: Run and Test

```bash
npm start
```

Your NFT marketplace will allow users to:
1. Connect their wallet
2. Browse available NFTs
3. List their own NFTs for sale
4. Purchase NFTs using ERG
5. Include royalties for original creators

## Extending Your Marketplace

1. **Add Filtering**: Allow users to filter by price range, collection, etc.
2. **Add Auction Functionality**: Support time-based auctions with bidding.
3. **NFT Collections**: Group NFTs by collection and add collection pages.
4. **Transaction History**: Show the history of sales for each NFT.
5. **User Profiles**: Add user profiles showing owned and created NFTs.

## Important Considerations

1. **Backend Integration**: A production marketplace typically needs a backend to index blockchain data.
2. **Smart Contract Security**: Have your smart contracts audited before going to production.
3. **Metadata Standards**: Consider following established NFT metadata standards.
4. **User Experience**: Pay special attention to error handling and transaction feedback.

This tutorial provides a starting point for building your NFT marketplace on Ergo. The smart contract functionality is simplified for educational purposes - in a production environment, you would want more robust contract logic and error handling. 