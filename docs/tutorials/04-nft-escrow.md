# Building an NFT Escrow System with Ergo Basic Template

This tutorial will guide you through creating a P2P NFT trading system on the Ergo blockchain where users can safely exchange NFTs without requiring trust.

## Overview

An NFT escrow trading system enables users to:
- Create trade offers specifying which NFT they are offering and which NFT they want in return
- Browse available trade offers
- Accept trades and complete exchanges in a trustless manner
- Cancel their own trade offers if no one has accepted them

## Step 1: Set Up the Project

Start with the Ergo Basic Template:

```bash
# Clone the template
git clone https://github.com/yourusername/ergo-basic-template.git nft-escrow
cd nft-escrow

# Install dependencies
npm install @fleet-sdk/common @fleet-sdk/serializer
```

## Step 2: Add Escrow Smart Contract Functions

Create a new utility file `src/utils/escrow.ts` for escrow-specific functions:

```typescript
import { 
  OutputBuilder, 
  TransactionBuilder, 
  SigmaPropConstant,
  ErgoAddress,
  Box,
  RECOMMENDED_MIN_FEE_VALUE,
} from "@fleet-sdk/core";

// Function to create an escrow trade
export const createNFTTradeOffer = async (
  creatorAddress: string,
  offeredTokenId: string,
  requestedTokenId: string
): Promise<string> => {
  try {
    // Check if wallet is connected
    if (!window.ergoConnector) throw new Error("Wallet not connected");
    const connected = await window.ergoConnector.nautilus.isConnected();
    if (!connected) throw new Error("Wallet not connected");
    
    const height = await ergo.get_current_height();
    
    // Get the NFT from the wallet
    const nftBox = await findNFTBoxInWallet(offeredTokenId);
    if (!nftBox) throw new Error("Offered NFT not found in wallet");
    
    // Create a contract that will hold the NFT until trade is completed
    const creatorErgoTree = ErgoAddress.fromBase58(creatorAddress).ergoTree;
    
    // Contract that allows only the creator to reclaim the NFT or
    // allows someone who provides the requested NFT to take this NFT
    const escrowScript = `{
      val creatorPubKey = SELF.R4[SigmaProp].get
      val requestedTokenId = SELF.R5[Coll[Byte]].get
      
      // Either creator reclaims NFT
      val creatorReclaims = {
        OUTPUTS(0).propositionBytes == creatorPubKey.propBytes &&
        OUTPUTS(0).tokens.exists(_.id == SELF.tokens(0).id)
      }
      
      // Or someone provides the requested NFT to the creator and takes this NFT
      val exchangeCompleted = {
        val creatorReceivesRequestedNFT = OUTPUTS.exists(output => 
          output.propositionBytes == creatorPubKey.propBytes && 
          output.tokens.exists(_.id == requestedTokenId)
        )
        
        val takerReceivesOfferedNFT = OUTPUTS.exists(output =>
          output.tokens.exists(_.id == SELF.tokens(0).id)
        )
        
        creatorReceivesRequestedNFT && takerReceivesOfferedNFT
      }
      
      creatorReclaims || exchangeCompleted
    }`;
    
    // Create a transaction that sends the NFT to the escrow contract
    const unsignedTx = new TransactionBuilder(height)
      .from([nftBox]) // the box containing the offered NFT
      .to(
        new OutputBuilder(1000000, escrowScript) // min value box with escrow script
          .addTokens({ 
            tokenId: offeredTokenId, 
            amount: "1" 
          })
          .setAdditionalRegisters({
            R4: SigmaPropConstant(creatorErgoTree), // Creator's address
            R5: requestedTokenId, // The token ID requested in exchange
          })
      )
      .sendChangeTo(creatorAddress)
      .payMinFee()
      .build();
    
    // Sign and submit transaction
    const signedTx = await ergo.sign_tx(unsignedTx);
    const txId = await ergo.submit_tx(signedTx);
    
    return txId;
  } catch (error) {
    console.error("Error creating trade offer:", error);
    throw error;
  }
};

// Function to cancel a trade offer
export const cancelTradeOffer = async (
  escrowBoxId: string,
  creatorAddress: string
): Promise<string> => {
  try {
    // Check if wallet is connected
    if (!window.ergoConnector) throw new Error("Wallet not connected");
    const connected = await window.ergoConnector.nautilus.isConnected();
    if (!connected) throw new Error("Wallet not connected");
    
    const height = await ergo.get_current_height();
    
    // Get the escrow box
    const escrowBox = await getBoxById(escrowBoxId);
    if (!escrowBox) throw new Error("Trade offer not found");
    
    // Verify caller is the creator
    const creatorErgoTree = escrowBox.additionalRegisters.R4.serializedValue;
    const callerErgoTree = ErgoAddress.fromBase58(creatorAddress).ergoTree;
    
    if (creatorErgoTree !== callerErgoTree) {
      throw new Error("Only the creator can cancel this trade offer");
    }
    
    // Get the token from the escrow box
    const offeredTokenId = escrowBox.assets[0].tokenId;
    
    // Create a transaction to return the NFT to the creator
    const unsignedTx = new TransactionBuilder(height)
      .from([escrowBox])
      .to(
        new OutputBuilder(1000000, creatorAddress)
          .addTokens({ 
            tokenId: offeredTokenId, 
            amount: "1" 
          })
      )
      .sendChangeTo(creatorAddress)
      .payMinFee()
      .build();
    
    // Sign and submit transaction
    const signedTx = await ergo.sign_tx(unsignedTx);
    const txId = await ergo.submit_tx(signedTx);
    
    return txId;
  } catch (error) {
    console.error("Error canceling trade offer:", error);
    throw error;
  }
};

// Function to accept and complete a trade
export const acceptTradeOffer = async (
  escrowBoxId: string,
  takerAddress: string
): Promise<string> => {
  try {
    // Check if wallet is connected
    if (!window.ergoConnector) throw new Error("Wallet not connected");
    const connected = await window.ergoConnector.nautilus.isConnected();
    if (!connected) throw new Error("Wallet not connected");
    
    const height = await ergo.get_current_height();
    
    // Get the escrow box
    const escrowBox = await getBoxById(escrowBoxId);
    if (!escrowBox) throw new Error("Trade offer not found");
    
    // Extract trade details
    const creatorErgoTree = escrowBox.additionalRegisters.R4.serializedValue;
    const creatorAddress = ErgoAddress.fromErgoTree(creatorErgoTree).encode();
    const requestedTokenId = escrowBox.additionalRegisters.R5.serializedValue;
    const offeredTokenId = escrowBox.assets[0].tokenId;
    
    // Find the requested NFT in taker's wallet
    const requestedNFTBox = await findNFTBoxInWallet(requestedTokenId);
    if (!requestedNFTBox) {
      throw new Error("You don't have the requested NFT in your wallet");
    }
    
    // Create transaction to complete the trade
    const unsignedTx = new TransactionBuilder(height)
      .from([escrowBox, requestedNFTBox])
      // Send offered NFT to taker
      .to(
        new OutputBuilder(1000000, takerAddress)
          .addTokens({ 
            tokenId: offeredTokenId, 
            amount: "1" 
          })
      )
      // Send requested NFT to creator
      .to(
        new OutputBuilder(1000000, creatorAddress)
          .addTokens({ 
            tokenId: requestedTokenId, 
            amount: "1" 
          })
      )
      .sendChangeTo(takerAddress)
      .payMinFee()
      .build();
    
    // Sign and submit transaction
    const signedTx = await ergo.sign_tx(unsignedTx);
    const txId = await ergo.submit_tx(signedTx);
    
    return txId;
  } catch (error) {
    console.error("Error accepting trade offer:", error);
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

// Helper function to get a box by ID
async function getBoxById(boxId: string): Promise<Box | null> {
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
```

## Step 3: Create User Interface Components

First, create a component to display trade offers. Create a file `src/components/escrow/TradeOfferCard.tsx`:

```tsx
import React, { useState } from 'react';
import {
  Box,
  Image,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  Badge,
  useToast,
  Flex,
  Divider,
  Icon,
} from "@chakra-ui/react";
import { FaExchangeAlt, FaTrash, FaCheck } from 'react-icons/fa';
import { acceptTradeOffer, cancelTradeOffer } from '../../utils/escrow';
import { shortenTokenId } from '../../utils/ergo';

interface TradeOfferCardProps {
  offer: {
    boxId: string;
    creatorAddress: string;
    offeredTokenId: string;
    offeredTokenName: string;
    offeredTokenImageUrl: string;
    requestedTokenId: string;
    requestedTokenName: string;
    requestedTokenImageUrl: string;
  };
  userAddress: string;
  userNFTIds: string[];
  onTradeCompleted: () => void;
}

export const TradeOfferCard: React.FC<TradeOfferCardProps> = ({ 
  offer, 
  userAddress, 
  userNFTIds,
  onTradeCompleted
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();
  
  const isCreator = userAddress === offer.creatorAddress;
  const hasRequestedNFT = userNFTIds.includes(offer.requestedTokenId);
  
  const handleAcceptTrade = async () => {
    try {
      setIsLoading(true);
      const txId = await acceptTradeOffer(offer.boxId, userAddress);
      
      toast({
        title: "Trade completed!",
        description: `Transaction ID: ${txId.substring(0, 8)}...`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });
      
      onTradeCompleted();
    } catch (error: any) {
      toast({
        title: "Trade failed",
        description: error.message || "An error occurred",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCancelTrade = async () => {
    try {
      setIsLoading(true);
      const txId = await cancelTradeOffer(offer.boxId, userAddress);
      
      toast({
        title: "Trade offer canceled",
        description: `Transaction ID: ${txId.substring(0, 8)}...`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });
      
      onTradeCompleted();
    } catch (error: any) {
      toast({
        title: "Cancellation failed",
        description: error.message || "An error occurred",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
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
      <Box p={4}>
        <Heading size="md" mb={4} color="ergnome.yellow">
          NFT Trade Offer
        </Heading>
        
        <HStack spacing={2} mb={4}>
          <Box w="45%">
            <Text color="gray.400" fontSize="sm" mb={1}>Offered:</Text>
            <Image 
              src={offer.offeredTokenImageUrl} 
              alt={offer.offeredTokenName}
              borderRadius="md"
              height="120px"
              width="100%"
              objectFit="cover"
              fallbackSrc="https://via.placeholder.com/150/2a4365/ffffff?text=NFT"
            />
            <Text fontWeight="bold" mt={2} isTruncated>
              {offer.offeredTokenName}
            </Text>
            <Text fontSize="xs" color="gray.400" isTruncated>
              ID: {shortenTokenId(offer.offeredTokenId)}
            </Text>
          </Box>
          
          <Flex w="10%" justify="center" align="center" px={1}>
            <Icon as={FaExchangeAlt} w={6} h={6} color="ergnome.blue" />
          </Flex>
          
          <Box w="45%">
            <Text color="gray.400" fontSize="sm" mb={1}>Requested:</Text>
            <Image 
              src={offer.requestedTokenImageUrl} 
              alt={offer.requestedTokenName}
              borderRadius="md"
              height="120px"
              width="100%"
              objectFit="cover"
              fallbackSrc="https://via.placeholder.com/150/553c9a/ffffff?text=NFT"
            />
            <Text fontWeight="bold" mt={2} isTruncated>
              {offer.requestedTokenName}
            </Text>
            <Text fontSize="xs" color="gray.400" isTruncated>
              ID: {shortenTokenId(offer.requestedTokenId)}
            </Text>
          </Box>
        </HStack>
        
        <Divider my={3} />
        
        <Flex>
          {isCreator ? (
            <Button 
              colorScheme="red" 
              leftIcon={<Icon as={FaTrash} />}
              onClick={handleCancelTrade}
              isLoading={isLoading}
              width="100%"
            >
              Cancel My Offer
            </Button>
          ) : (
            <Button 
              colorScheme={hasRequestedNFT ? "green" : "gray"}
              leftIcon={<Icon as={FaCheck} />}
              onClick={handleAcceptTrade}
              isDisabled={!hasRequestedNFT}
              isLoading={isLoading}
              width="100%"
            >
              {hasRequestedNFT ? "Accept Trade" : "Missing Required NFT"}
            </Button>
          )}
        </Flex>
      </Box>
    </Box>
  );
};
```

Next, create a form for creating new trade offers. Create a file `src/components/escrow/CreateTradeForm.tsx`:

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
  Select,
  VStack,
  useToast,
  Image,
  Flex,
  Text,
  HStack,
  Icon,
  Box,
} from "@chakra-ui/react";
import { FaExchangeAlt } from 'react-icons/fa';
import { createNFTTradeOffer } from '../../utils/escrow';
import { shortenTokenId } from '../../utils/ergo';

interface CreateTradeFormProps {
  isOpen: boolean;
  onClose: () => void;
  userAddress: string;
  userNFTs: Array<{
    tokenId: string;
    name: string;
    imageUrl: string;
  }>;
  allNFTs: Array<{
    tokenId: string;
    name: string;
    imageUrl: string;
  }>;
  onTradeCreated: () => void;
}

export const CreateTradeForm: React.FC<CreateTradeFormProps> = ({ 
  isOpen, 
  onClose, 
  userAddress, 
  userNFTs,
  allNFTs,
  onTradeCreated
}) => {
  const [offeredTokenId, setOfferedTokenId] = useState('');
  const [requestedTokenId, setRequestedTokenId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const toast = useToast();
  
  const handleSubmit = async () => {
    if (!offeredTokenId || !requestedTokenId) {
      toast({
        title: "Invalid selection",
        description: "Please select both NFTs for the trade",
        status: "error",
        duration: 3000,
      });
      return;
    }
    
    if (offeredTokenId === requestedTokenId) {
      toast({
        title: "Invalid selection",
        description: "You cannot trade an NFT for itself",
        status: "error",
        duration: 3000,
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      const txId = await createNFTTradeOffer(
        userAddress,
        offeredTokenId,
        requestedTokenId
      );
      
      toast({
        title: "Trade offer created!",
        description: `Transaction ID: ${txId.substring(0, 8)}...`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });
      
      onTradeCreated();
      onClose();
    } catch (error: any) {
      toast({
        title: "Failed to create trade offer",
        description: error.message || "An error occurred",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const offeredNFT = userNFTs.find(nft => nft.tokenId === offeredTokenId);
  const requestedNFT = allNFTs.find(nft => nft.tokenId === requestedTokenId);
  
  // Filter out the selected NFT from the requested options
  const availableRequestedNFTs = allNFTs.filter(nft => nft.tokenId !== offeredTokenId);
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay backdropFilter="blur(10px)" />
      <ModalContent bg="ergnome.cardBg" color="white">
        <ModalHeader>Create NFT Trade Offer</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={6} align="stretch">
            <FormControl isRequired>
              <FormLabel>NFT You're Offering</FormLabel>
              <Select 
                placeholder="Choose an NFT to offer" 
                value={offeredTokenId}
                onChange={(e) => setOfferedTokenId(e.target.value)}
              >
                {userNFTs.map(nft => (
                  <option key={nft.tokenId} value={nft.tokenId}>
                    {nft.name}
                  </option>
                ))}
              </Select>
            </FormControl>
            
            <FormControl isRequired>
              <FormLabel>NFT You Want in Return</FormLabel>
              <Select 
                placeholder="Choose an NFT you want" 
                value={requestedTokenId}
                onChange={(e) => setRequestedTokenId(e.target.value)}
                isDisabled={!offeredTokenId}
              >
                {availableRequestedNFTs.map(nft => (
                  <option key={nft.tokenId} value={nft.tokenId}>
                    {nft.name}
                  </option>
                ))}
              </Select>
            </FormControl>
            
            {offeredNFT && requestedNFT && (
              <Box>
                <Text fontWeight="bold" mb={2}>Trade Preview:</Text>
                <HStack align="center" spacing={4} p={4} borderWidth="1px" borderRadius="md" borderColor="ergnome.blue">
                  <Box w="45%">
                    <Image 
                      src={offeredNFT.imageUrl}
                      alt={offeredNFT.name}
                      borderRadius="md"
                      height="150px"
                      objectFit="cover"
                      width="100%"
                    />
                    <Text mt={2} fontWeight="bold" isTruncated>{offeredNFT.name}</Text>
                    <Text fontSize="xs" color="gray.400">{shortenTokenId(offeredNFT.tokenId)}</Text>
                  </Box>
                  
                  <Flex justify="center" align="center" w="10%">
                    <Icon as={FaExchangeAlt} w={8} h={8} color="ergnome.green" />
                  </Flex>
                  
                  <Box w="45%">
                    <Image 
                      src={requestedNFT.imageUrl}
                      alt={requestedNFT.name}
                      borderRadius="md"
                      height="150px"
                      objectFit="cover"
                      width="100%"
                    />
                    <Text mt={2} fontWeight="bold" isTruncated>{requestedNFT.name}</Text>
                    <Text fontSize="xs" color="gray.400">{shortenTokenId(requestedNFT.tokenId)}</Text>
                  </Box>
                </HStack>
              </Box>
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
            isDisabled={!offeredTokenId || !requestedTokenId}
          >
            Create Trade Offer
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
```

## Step 4: Create NFT Utility Functions

Add these NFT-specific utility functions in `src/utils/ergo.ts` if you haven't already:

```typescript
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

// Function to fetch NFT metadata (simplified for demo)
export const fetchNFTMetadata = async (tokenId: string): Promise<any> => {
  try {
    // In a real app, this would fetch from a metadata service or IPFS
    // Using mock data for the tutorial
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Generate deterministic yet "random" data based on tokenId
    const hash = tokenId.substring(0, 6);
    const namePrefix = 
      parseInt(hash.substring(0, 2), 16) % 3 === 0 ? "Ergo Wizard" :
      parseInt(hash.substring(0, 2), 16) % 3 === 1 ? "Ergo Punk" : "Ergo Ape";
    
    const nameNum = parseInt(hash.substring(2, 6), 16) % 1000;
    
    return {
      tokenId,
      name: `${namePrefix} #${nameNum}`,
      description: `A unique ${namePrefix} NFT with on-chain metadata`,
      imageUrl: `https://via.placeholder.com/300/${hash}/?text=${namePrefix}+${nameNum}`,
      collection: namePrefix,
    };
  } catch (error) {
    console.error('Error fetching NFT metadata:', error);
    return null;
  }
};
```

## Step 5: Create the Escrow Page

Create a new file `src/pages/EscrowPage.tsx`:

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
  Icon,
  Spinner,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
} from "@chakra-ui/react";
import { FaPlus } from 'react-icons/fa';
import { PageLayout } from '../components/layout/PageLayout';
import { WalletConnector, WalletData } from '../components/wallet/WalletConnector';
import { TradeOfferCard } from '../components/escrow/TradeOfferCard';
import { CreateTradeForm } from '../components/escrow/CreateTradeForm';
import { getWalletNFTs } from '../utils/ergo';

// Mock function to get all trade offers
const getTradeOffers = async () => {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Return mock data
  return [
    {
      boxId: "mock-box-id-1",
      creatorAddress: "9f4QF8AD1nQ3nJahQVkMj8hFSVVzVom77b52JU7EW71Zexg6N8v",
      offeredTokenId: "mock-token-id-1",
      offeredTokenName: "Ergo Wizard #123",
      offeredTokenImageUrl: "https://via.placeholder.com/300/123456/?text=Ergo+Wizard+123",
      requestedTokenId: "mock-token-id-2",
      requestedTokenName: "Ergo Punk #456",
      requestedTokenImageUrl: "https://via.placeholder.com/300/654321/?text=Ergo+Punk+456"
    },
    {
      boxId: "mock-box-id-2",
      creatorAddress: "your-address-here", // Replace with current user's address to test "my offers"
      offeredTokenId: "mock-token-id-3",
      offeredTokenName: "Ergo Ape #789",
      offeredTokenImageUrl: "https://via.placeholder.com/300/789012/?text=Ergo+Ape+789",
      requestedTokenId: "mock-token-id-4",
      requestedTokenName: "Ergo Wizard #321",
      requestedTokenImageUrl: "https://via.placeholder.com/300/210987/?text=Ergo+Wizard+321"
    },
    // Add more mock offers as needed
  ];
};

// Get a curated list of NFTs (for the demo)
const getAllAvailableNFTs = async () => {
  // In a real app, you'd fetch this from a registry or API
  
  // Generate some sample NFTs
  const sampleNFTs = [];
  for (let i = 1; i <= 20; i++) {
    const type = i % 3 === 0 ? "Wizard" : i % 3 === 1 ? "Punk" : "Ape";
    sampleNFTs.push({
      tokenId: `mock-token-id-${i}`,
      name: `Ergo ${type} #${i * 111}`,
      imageUrl: `https://via.placeholder.com/300/${i * 111}/?text=Ergo+${type}+${i * 111}`,
    });
  }
  
  return sampleNFTs;
};

export const EscrowPage: React.FC = () => {
  const [walletData, setWalletData] = useState<WalletData>({
    isConnected: false,
    ergBalance: '0',
    tokens: [],
    walletStatus: 'Not connected'
  });
  
  const [tradeOffers, setTradeOffers] = useState<any[]>([]);
  const [userNFTs, setUserNFTs] = useState<any[]>([]);
  const [allNFTs, setAllNFTs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const { isOpen, onOpen, onClose } = useDisclosure();
  const walletConnectorRef = useRef<() => void>(() => {});
  
  // For demo, use a fixed address. In real app, get this from wallet connection
  const userAddress = 'your-address-here';
  
  useEffect(() => {
    loadTradeOffers();
    loadAllNFTs();
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
  
  const loadTradeOffers = async () => {
    setIsLoading(true);
    try {
      const offers = await getTradeOffers();
      setTradeOffers(offers);
    } catch (error) {
      console.error('Error loading trade offers:', error);
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
  
  const loadAllNFTs = async () => {
    try {
      const nfts = await getAllAvailableNFTs();
      setAllNFTs(nfts);
    } catch (error) {
      console.error('Error loading available NFTs:', error);
    }
  };
  
  // Filter trade offers for current view
  const myOffers = tradeOffers.filter(offer => offer.creatorAddress === userAddress);
  const otherOffers = tradeOffers.filter(offer => offer.creatorAddress !== userAddress);
  
  // Extract user's NFT IDs for offer acceptance check
  const userNFTIds = userNFTs.map(nft => nft.tokenId);
  
  return (
    <PageLayout
      title="NFT Trade Escrow"
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
          mb={6}
        >
          <Heading 
            as="h1" 
            size="2xl" 
            bgGradient="linear(to-r, ergnome.blue, ergnome.purple)"
            bgClip="text"
          >
            NFT Trading Escrow
          </Heading>
          
          {walletData.isConnected && (
            <Button 
              colorScheme="blue" 
              leftIcon={<Icon as={FaPlus} />}
              onClick={onOpen}
              isDisabled={userNFTs.length === 0}
            >
              Create Trade Offer
            </Button>
          )}
        </Flex>
        
        <Text mb={6} color="gray.300">
          Safely trade your NFTs with other collectors using our trustless escrow system.
          Create a trade offer by selecting an NFT you own and an NFT you want in return.
        </Text>
        
        <Tabs variant="soft-rounded" colorScheme="blue" mb={6}>
          <TabList>
            <Tab>All Offers</Tab>
            <Tab>My Offers</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              {isLoading ? (
                <Flex justify="center" my={10}>
                  <Spinner size="xl" color="ergnome.blue" />
                </Flex>
              ) : otherOffers.length === 0 ? (
                <Text textAlign="center" fontSize="lg" color="gray.400">
                  No trade offers available. {!walletData.isConnected && "Connect your wallet to create a trade offer!"}
                </Text>
              ) : (
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
                  {otherOffers.map((offer) => (
                    <TradeOfferCard 
                      key={offer.boxId}
                      offer={offer}
                      userAddress={userAddress}
                      userNFTIds={userNFTIds}
                      onTradeCompleted={loadTradeOffers}
                    />
                  ))}
                </SimpleGrid>
              )}
            </TabPanel>
            <TabPanel>
              {isLoading ? (
                <Flex justify="center" my={10}>
                  <Spinner size="xl" color="ergnome.blue" />
                </Flex>
              ) : !walletData.isConnected ? (
                <Text textAlign="center" fontSize="lg" color="gray.400">
                  Connect your wallet to view your trade offers.
                </Text>
              ) : myOffers.length === 0 ? (
                <Text textAlign="center" fontSize="lg" color="gray.400">
                  You haven't created any trade offers yet.
                </Text>
              ) : (
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
                  {myOffers.map((offer) => (
                    <TradeOfferCard 
                      key={offer.boxId}
                      offer={offer}
                      userAddress={userAddress}
                      userNFTIds={userNFTIds}
                      onTradeCompleted={loadTradeOffers}
                    />
                  ))}
                </SimpleGrid>
              )}
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Box>
      
      <CreateTradeForm 
        isOpen={isOpen}
        onClose={onClose}
        userAddress={userAddress}
        userNFTs={userNFTs}
        allNFTs={allNFTs}
        onTradeCreated={loadTradeOffers}
      />
    </PageLayout>
  );
};
```

## Step 6: Update App.tsx

Update your `src/App.tsx` to use the new escrow page:

```tsx
import React from 'react';
import { ChakraProvider } from "@chakra-ui/react";
import theme from './theme';
import { EscrowPage } from './pages/EscrowPage';

export const App = () => {
  return (
    <ChakraProvider theme={theme}>
      <EscrowPage />
    </ChakraProvider>
  );
};
```

## Step 7: Run and Test

```bash
npm start
```

Your NFT escrow system will allow users to:
1. Connect their wallet
2. View available NFTs for trade
3. Create trade offers specifying an NFT they own and one they want
4. Accept trades when they have the requested NFT
5. Cancel their own trade offers

## How the Escrow Works

The escrow system operates using Ergo's UTXO model and smart contracts:

1. **Creating a Trade Offer**:
   - The creator's NFT is locked in a smart contract
   - The contract specifies which NFT is requested in return
   - Only the creator can reclaim their NFT, or someone can trade the requested NFT

2. **Accepting a Trade**:
   - When someone accepts, they provide the requested NFT
   - The contract ensures the trade is atomic - both NFTs change ownership in the same transaction
   - If the transaction fails for any reason, neither NFT changes hands

3. **Canceling a Trade**:
   - Only the creator can cancel their own trade
   - Cancellation returns the offered NFT to the creator

## Extending Your Escrow System

1. **Multiple NFT Trading**: Allow trading multiple NFTs at once.
2. **ERG + NFT Trading**: Support adding ERG along with NFTs in the trade.
3. **Time Limits**: Add expiration dates to trade offers.
4. **Trade History**: Track historical trades on the platform.
5. **Advanced Search**: Create search and filter features to find specific NFTs.
6. **Direct Offers**: Allow sending trade offers to specific addresses.

## Important Considerations

1. **Smart Contract Security**: The provided contract is simplified for educational purposes. In production, a more robust contract would be required.
2. **UI/UX Improvements**: Add loading states, error handling, and confirmation screens for better user experience.
3. **Metadata Standards**: Consider following established NFT metadata standards.
4. **Backend Integration**: Add a backend service to index and track NFTs and trades.

This tutorial provides a starting point for building a trustless NFT trading system on Ergo. In a production environment, you would want more robust smart contracts, thorough testing, and possibly third-party audits to ensure security. 