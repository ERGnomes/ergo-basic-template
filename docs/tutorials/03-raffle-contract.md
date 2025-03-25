# Building a Raffle dApp with Ergo Basic Template

This tutorial will guide you through creating a simple raffle application on the Ergo blockchain where users can purchase tickets for a chance to win prizes.

## Overview

A blockchain raffle allows users to:
- Create raffle events with prizes (ERG or NFTs)
- Purchase tickets with ERG
- Have winners selected in a provably fair way
- Claim prizes automatically when the raffle ends

## Step 1: Set Up the Project

Start with the Ergo Basic Template:

```bash
# Clone the template
git clone https://github.com/yourusername/ergo-basic-template.git ergo-raffle
cd ergo-raffle

# Install dependencies
npm install @fleet-sdk/common @fleet-sdk/serializer
```

## Step 2: Add Raffle Contract Utils

Create a new utility file `src/utils/raffle.ts`:

```typescript
import { 
  OutputBuilder, 
  TransactionBuilder, 
  SConstant,
  SColl,
  SByte,
  SLong,
  ErgoAddress,
  Box,
  RECOMMENDED_MIN_FEE_VALUE,
} from "@fleet-sdk/core";

// Create a new raffle
export const createRaffle = async (
  creatorAddress: string,
  prizeTokenId: string | null, // null for ERG prizes
  prizeAmount: string | number,
  ticketPriceERG: number,
  maxTickets: number,
  raffleDeadlineHeight: number
): Promise<string> => {
  try {
    // Check if wallet is connected
    if (!window.ergoConnector) throw new Error("Wallet not connected");
    const connected = await window.ergoConnector.nautilus.isConnected();
    if (!connected) throw new Error("Wallet not connected");
    
    const currentHeight = await ergo.get_current_height();
    const ticketPriceNanoERG = ticketPriceERG * 1000000000;
    
    // Get boxes to cover prize if ERG, or get box with token if prize is a token
    let inputBoxes;
    if (!prizeTokenId) {
      // ERG prize
      inputBoxes = await ergo.get_utxos(Number(prizeAmount) + RECOMMENDED_MIN_FEE_VALUE);
    } else {
      // Token prize
      const allUtxos = await ergo.get_utxos();
      inputBoxes = allUtxos.filter(box => 
        box.assets?.some(asset => 
          asset.tokenId === prizeTokenId && Number(asset.amount) >= Number(prizeAmount)
        )
      );
      
      if (inputBoxes.length === 0) {
        throw new Error(`Not enough tokens for prize. Need ${prizeAmount} of token ${prizeTokenId}`);
      }
    }
    
    // Create raffle contract 
    // This is a simplified version; in production, you would have more robust logic
    const raffleScript = `{
      // Constants from registers
      val creatorPubKey = SELF.R4[SigmaProp].get
      val ticketPrice = SELF.R5[Long].get
      val deadline = SELF.R6[Int].get
      val maxTickets = SELF.R7[Int].get
      
      // Data about participants stored in R8
      val participants = SELF.R8[Coll[Byte]].get
      
      // Three spending paths:
      // 1. Creator adds prize
      // 2. Someone buys a ticket
      // 3. Creator draws winner after deadline
      
      val creatorWithdraw = {
        CONTEXT.preHeader.height >= deadline && // Can only withdraw after deadline
        OUTPUTS(0).propositionBytes == creatorPubKey.propBytes && // First output to creator
        INPUTS(0).id == SELF.id // This box is first input
      }
      
      val buyTicket = {
        CONTEXT.preHeader.height < deadline && // Before deadline
        participants.size < maxTickets && // Not all tickets sold
        OUTPUTS(0).value >= SELF.value + ticketPrice && // Value increased by ticket price
        OUTPUTS(0).propositionBytes == SELF.propositionBytes && // Same contract
        OUTPUTS(0).R4[SigmaProp].get == creatorPubKey && // Same creator
        OUTPUTS(0).R5[Long].get == ticketPrice && // Same ticket price
        OUTPUTS(0).R6[Int].get == deadline && // Same deadline
        OUTPUTS(0).R7[Int].get == maxTickets && // Same max tickets
        // Add buyer to participants list
        OUTPUTS(0).R8[Coll[Byte]].get == participants ++ INPUTS(1).propositionBytes
      }
      
      val drawWinner = {
        CONTEXT.preHeader.height >= deadline && // After deadline
        participants.size > 0 && // At least one participant
        // Use block header as random seed to select winner
        // In a real contract, you would use a more robust random selection
        // This is just a simplified example
        val winnerIndex = blake2b256(INPUTS.map(_.id).fold(CONTEXT.preHeader.id, { (a, b) => a ++ b }))(0).toInt % participants.size
        val winner = participants.slice(winnerIndex * 34, (winnerIndex + 1) * 34)
        OUTPUTS(0).propositionBytes == winner // Send prize to winner
      }
      
      creatorWithdraw || buyTicket || drawWinner
    }`;
    
    // Create initial box with empty participants list
    const raffleOutput = new OutputBuilder(
      prizeTokenId ? 1000000 : Number(prizeAmount), // Box value
      raffleScript
    )
      .setAdditionalRegisters({
        R4: SConstant(ErgoAddress.fromBase58(creatorAddress).ergoTree), // Creator
        R5: SLong(ticketPriceNanoERG), // Ticket price
        R6: SLong(raffleDeadlineHeight), // Deadline
        R7: SLong(maxTickets), // Maximum tickets
        R8: SColl(SByte, []), // Empty participants list
      });
    
    // Add token to box if prize is a token
    if (prizeTokenId) {
      raffleOutput.addTokens({
        tokenId: prizeTokenId,
        amount: prizeAmount.toString(),
      });
    }
      
    // Create transaction
    const unsignedTx = new TransactionBuilder(currentHeight)
      .from(inputBoxes)
      .to(raffleOutput)
      .sendChangeTo(creatorAddress)
      .payMinFee()
      .build();
    
    // Sign and submit transaction
    const signedTx = await ergo.sign_tx(unsignedTx);
    const txId = await ergo.submit_tx(signedTx);
    
    return txId;
  } catch (error) {
    console.error("Error creating raffle:", error);
    throw error;
  }
};

// Buy raffle ticket
export const buyRaffleTicket = async (
  raffleBoxId: string,
  buyerAddress: string
): Promise<string> => {
  try {
    // Check if wallet is connected
    if (!window.ergoConnector) throw new Error("Wallet not connected");
    const connected = await window.ergoConnector.nautilus.isConnected();
    if (!connected) throw new Error("Wallet not connected");
    
    const currentHeight = await ergo.get_current_height();
    
    // Get raffle box
    const raffleBox = await getBoxById(raffleBoxId);
    if (!raffleBox) throw new Error("Raffle not found");
    
    // Extract raffle details
    const ticketPrice = raffleBox.additionalRegisters.R5.renderedValue;
    const deadline = raffleBox.additionalRegisters.R6.renderedValue;
    const maxTickets = raffleBox.additionalRegisters.R7.renderedValue;
    const participantsBytes = raffleBox.additionalRegisters.R8.serializedValue;
    
    // Check if raffle is still open
    if (currentHeight >= deadline) {
      throw new Error("Raffle has ended");
    }
    
    // Check if raffle is full
    const currentParticipants = participantsBytes.length / 68; // 34 bytes per address (ErgoTree)
    if (currentParticipants >= maxTickets) {
      throw new Error("Raffle is full");
    }
    
    // Get buyer input box to cover ticket price
    const inputBoxes = await ergo.get_utxos(ticketPrice + RECOMMENDED_MIN_FEE_VALUE);
    
    // Create new raffle box with updated participants list
    const newParticipantsBytes = participantsBytes + ErgoAddress.fromBase58(buyerAddress).ergoTree;
    
    // Create transaction
    const txBuilder = new TransactionBuilder(currentHeight)
      .from([raffleBox, ...inputBoxes])
      .to(
        new OutputBuilder(
          raffleBox.value + ticketPrice,
          raffleBox.ergoTree
        )
          .setAdditionalRegisters({
            ...raffleBox.additionalRegisters,
            R8: newParticipantsBytes // Updated participants list
          })
          // Copy tokens if any
          .addTokens(raffleBox.assets.map(asset => ({
            tokenId: asset.tokenId,
            amount: asset.amount
          })))
      )
      .sendChangeTo(buyerAddress)
      .payMinFee();
    
    const unsignedTx = txBuilder.build();
    
    // Sign and submit transaction
    const signedTx = await ergo.sign_tx(unsignedTx);
    const txId = await ergo.submit_tx(signedTx);
    
    return txId;
  } catch (error) {
    console.error("Error buying raffle ticket:", error);
    throw error;
  }
};

// Draw raffle winner
export const drawRaffleWinner = async (
  raffleBoxId: string,
  creatorAddress: string
): Promise<string> => {
  try {
    // Check if wallet is connected
    if (!window.ergoConnector) throw new Error("Wallet not connected");
    const connected = await window.ergoConnector.nautilus.isConnected();
    if (!connected) throw new Error("Wallet not connected");
    
    const currentHeight = await ergo.get_current_height();
    
    // Get raffle box
    const raffleBox = await getBoxById(raffleBoxId);
    if (!raffleBox) throw new Error("Raffle not found");
    
    // Extract raffle details
    const creatorErgoTree = raffleBox.additionalRegisters.R4.serializedValue;
    const deadline = raffleBox.additionalRegisters.R6.renderedValue;
    const participantsBytes = raffleBox.additionalRegisters.R8.serializedValue;
    
    // Check if raffle has ended
    if (currentHeight < deadline) {
      throw new Error("Raffle has not ended yet");
    }
    
    // Check if there are participants
    if (participantsBytes.length === 0) {
      throw new Error("No participants in raffle");
    }
    
    // Verify caller is the creator
    const callerErgoTree = ErgoAddress.fromBase58(creatorAddress).ergoTree;
    if (callerErgoTree !== creatorErgoTree) {
      throw new Error("Only the creator can draw the winner");
    }
    
    // Parse participants
    const participants = [];
    for (let i = 0; i < participantsBytes.length; i += 68) { // 34 bytes per address (ErgoTree)
      participants.push(participantsBytes.substring(i, i + 68));
    }
    
    // Select winner (simplified, in production you'd use a more robust method)
    // This uses the current block header hash as a random seed
    const seed = await ergo.get_current_header();
    const randomIndex = parseInt(seed.substr(0, 8), 16) % participants.length;
    const winnerErgoTree = participants[randomIndex];
    const winnerAddress = ErgoAddress.fromErgoTree(winnerErgoTree).encode();
    
    // Create transaction to send prize to winner
    const txBuilder = new TransactionBuilder(currentHeight)
      .from([raffleBox])
      .to(
        new OutputBuilder(
          raffleBox.value - RECOMMENDED_MIN_FEE_VALUE,
          winnerAddress
        )
        // Transfer any tokens
        .addTokens(raffleBox.assets.map(asset => ({
          tokenId: asset.tokenId,
          amount: asset.amount
        })))
      )
      .payMinFee();
    
    const unsignedTx = txBuilder.build();
    
    // Sign and submit transaction
    const signedTx = await ergo.sign_tx(unsignedTx);
    const txId = await ergo.submit_tx(signedTx);
    
    return txId;
  } catch (error) {
    console.error("Error drawing raffle winner:", error);
    throw error;
  }
};

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

## Step 3: Create Raffle UI Components

Create a new file `src/components/raffle/RaffleCard.tsx`:

```tsx
import React, { useState } from 'react';
import {
  Box,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  Progress,
  Badge,
  useToast,
  Flex,
  Icon,
} from "@chakra-ui/react";
import { FaTicketAlt, FaGift, FaUserAlt } from 'react-icons/fa';
import { buyRaffleTicket, drawRaffleWinner } from '../../utils/raffle';
import { formatErgAmount, shortenTokenId } from '../../utils/ergo';

interface RaffleCardProps {
  raffle: {
    boxId: string;
    creatorAddress: string;
    ticketPrice: number;
    deadline: number;
    maxTickets: number;
    participants: string[];
    prizeType: 'ERG' | 'TOKEN';
    prizeAmount: string;
    prizeTokenId?: string;
    prizeTokenName?: string;
  };
  userAddress: string;
  currentHeight: number;
  onRaffleUpdate: () => void;
}

export const RaffleCard: React.FC<RaffleCardProps> = ({ 
  raffle, 
  userAddress, 
  currentHeight,
  onRaffleUpdate
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();
  
  const isRaffleEnded = currentHeight >= raffle.deadline;
  const isCreator = userAddress === raffle.creatorAddress;
  const ticketsSold = raffle.participants.length;
  const ticketProgress = (ticketsSold / raffle.maxTickets) * 100;
  const blocksRemaining = isRaffleEnded ? 0 : raffle.deadline - currentHeight;
  
  const handleBuyTicket = async () => {
    try {
      setIsLoading(true);
      const txId = await buyRaffleTicket(raffle.boxId, userAddress);
      
      toast({
        title: "Ticket purchased!",
        description: `Transaction ID: ${txId.substring(0, 8)}...`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });
      
      onRaffleUpdate();
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
  
  const handleDrawWinner = async () => {
    try {
      setIsLoading(true);
      const txId = await drawRaffleWinner(raffle.boxId, userAddress);
      
      toast({
        title: "Winner drawn!",
        description: `Transaction ID: ${txId.substring(0, 8)}...`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });
      
      onRaffleUpdate();
    } catch (error: any) {
      toast({
        title: "Failed to draw winner",
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
      p={5}
      transition="all 0.3s"
      _hover={{ 
        transform: isRaffleEnded ? "none" : "translateY(-5px)", 
        shadow: "lg",
        borderColor: isRaffleEnded ? "gray.600" : "ergnome.blue"
      }}
      opacity={isRaffleEnded ? 0.7 : 1}
    >
      <VStack spacing={4} align="stretch">
        <Flex justify="space-between" align="center">
          <Heading size="md" color={isRaffleEnded ? "gray.400" : "ergnome.yellow"}>
            Raffle #{raffle.boxId.substring(0, 8)}
          </Heading>
          <Badge 
            colorScheme={isRaffleEnded ? "gray" : "green"}
            fontSize="sm"
            px={2}
            py={1}
          >
            {isRaffleEnded ? "Ended" : "Active"}
          </Badge>
        </Flex>
        
        <Box bg="blackAlpha.300" p={3} borderRadius="md">
          <Text fontWeight="bold" mb={1}>Prize:</Text>
          <Flex align="center">
            <Icon as={FaGift} color="orange.300" mr={2} />
            <Text>
              {raffle.prizeType === 'ERG' 
                ? `${formatErgAmount(raffle.prizeAmount)} ERG` 
                : `${raffle.prizeAmount} ${raffle.prizeTokenName || 'Tokens'}`}
            </Text>
          </Flex>
          {raffle.prizeType === 'TOKEN' && raffle.prizeTokenId && (
            <Text fontSize="xs" color="gray.400" mt={1}>
              Token ID: {shortenTokenId(raffle.prizeTokenId)}
            </Text>
          )}
        </Box>
        
        <VStack spacing={1} align="stretch">
          <Flex justify="space-between">
            <Text fontSize="sm">Ticket Price:</Text>
            <Text fontSize="sm" fontWeight="bold">
              {formatErgAmount(raffle.ticketPrice)} ERG
            </Text>
          </Flex>
          
          <Flex justify="space-between">
            <HStack>
              <Icon as={FaUserAlt} size="sm" />
              <Text fontSize="sm">Participants:</Text>
            </HStack>
            <Text fontSize="sm" fontWeight="bold">
              {ticketsSold} / {raffle.maxTickets}
            </Text>
          </Flex>
          
          <Progress 
            value={ticketProgress} 
            size="sm" 
            colorScheme="blue" 
            borderRadius="full" 
            mt={1}
          />
          
          <Flex justify="space-between" mt={2}>
            <Text fontSize="sm">Status:</Text>
            <Text fontSize="sm" fontWeight="bold">
              {isRaffleEnded 
                ? "Ready to draw winner" 
                : `${blocksRemaining} blocks remaining`}
            </Text>
          </Flex>
        </VStack>
        
        {!isRaffleEnded ? (
          <Button 
            colorScheme="blue" 
            leftIcon={<Icon as={FaTicketAlt} />}
            isDisabled={ticketsSold >= raffle.maxTickets}
            onClick={handleBuyTicket}
            isLoading={isLoading}
          >
            Buy Ticket
          </Button>
        ) : isCreator && ticketsSold > 0 ? (
          <Button 
            colorScheme="green"
            onClick={handleDrawWinner}
            isLoading={isLoading}
          >
            Draw Winner
          </Button>
        ) : (
          <Button isDisabled>
            {ticketsSold === 0 ? "No participants" : "Waiting for draw"}
          </Button>
        )}
      </VStack>
    </Box>
  );
};
```

Create a form for creating new raffles `src/components/raffle/CreateRaffleForm.tsx`:

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
  VStack,
  Select,
  useToast,
  Text,
  FormHelperText,
  Radio,
  RadioGroup,
  Stack,
} from "@chakra-ui/react";
import { createRaffle } from '../../utils/raffle';

interface CreateRaffleFormProps {
  isOpen: boolean;
  onClose: () => void;
  userAddress: string;
  userTokens: Array<{
    tokenId: string;
    name: string;
    amount: number;
  }>;
  currentHeight: number;
  onRaffleCreated: () => void;
}

export const CreateRaffleForm: React.FC<CreateRaffleFormProps> = ({ 
  isOpen, 
  onClose, 
  userAddress, 
  userTokens,
  currentHeight,
  onRaffleCreated
}) => {
  const [prizeType, setPrizeType] = useState<'ERG' | 'TOKEN'>('ERG');
  const [prizeAmount, setPrizeAmount] = useState(1);
  const [selectedTokenId, setSelectedTokenId] = useState('');
  const [ticketPrice, setTicketPrice] = useState(0.5);
  const [maxTickets, setMaxTickets] = useState(10);
  const [durationBlocks, setDurationBlocks] = useState(720); // ~24 hours
  const [isLoading, setIsLoading] = useState(false);
  
  const toast = useToast();
  
  const handleSubmit = async () => {
    if (
      (prizeType === 'ERG' && prizeAmount <= 0) ||
      (prizeType === 'TOKEN' && !selectedTokenId) ||
      ticketPrice <= 0 ||
      maxTickets <= 0 ||
      durationBlocks <= 0
    ) {
      toast({
        title: "Invalid input",
        description: "Please fill all fields with valid values",
        status: "error",
        duration: 3000,
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      const deadlineHeight = currentHeight + durationBlocks;
      const tokenId = prizeType === 'TOKEN' ? selectedTokenId : null;
      
      const txId = await createRaffle(
        userAddress,
        tokenId,
        prizeAmount,
        ticketPrice,
        maxTickets,
        deadlineHeight
      );
      
      toast({
        title: "Raffle created!",
        description: `Transaction ID: ${txId.substring(0, 8)}...`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });
      
      onRaffleCreated();
      onClose();
    } catch (error: any) {
      toast({
        title: "Failed to create raffle",
        description: error.message || "An error occurred",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const selectedToken = userTokens.find(token => token.tokenId === selectedTokenId);
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay backdropFilter="blur(10px)" />
      <ModalContent bg="ergnome.cardBg" color="white">
        <ModalHeader>Create New Raffle</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <FormControl isRequired>
              <FormLabel>Prize Type</FormLabel>
              <RadioGroup value={prizeType} onChange={(value) => setPrizeType(value as 'ERG' | 'TOKEN')}>
                <Stack direction="row">
                  <Radio value="ERG" colorScheme="blue">ERG</Radio>
                  <Radio value="TOKEN" colorScheme="purple">Token</Radio>
                </Stack>
              </RadioGroup>
            </FormControl>
            
            {prizeType === 'ERG' ? (
              <FormControl isRequired>
                <FormLabel>Prize Amount (ERG)</FormLabel>
                <NumberInput 
                  min={0.1} 
                  precision={2} 
                  value={prizeAmount} 
                  onChange={(_, val) => setPrizeAmount(val)}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
              </FormControl>
            ) : (
              <>
                <FormControl isRequired>
                  <FormLabel>Select Token</FormLabel>
                  <Select 
                    placeholder="Choose a token" 
                    value={selectedTokenId}
                    onChange={(e) => setSelectedTokenId(e.target.value)}
                  >
                    {userTokens.map(token => (
                      <option key={token.tokenId} value={token.tokenId}>
                        {token.name} ({token.amount} available)
                      </option>
                    ))}
                  </Select>
                </FormControl>
                
                {selectedToken && (
                  <FormControl isRequired>
                    <FormLabel>Prize Amount</FormLabel>
                    <NumberInput 
                      min={1} 
                      max={selectedToken.amount} 
                      value={prizeAmount} 
                      onChange={(_, val) => setPrizeAmount(val)}
                    >
                      <NumberInputField />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                  </FormControl>
                )}
              </>
            )}
            
            <FormControl isRequired>
              <FormLabel>Ticket Price (ERG)</FormLabel>
              <NumberInput 
                min={0.1} 
                precision={2} 
                value={ticketPrice} 
                onChange={(_, val) => setTicketPrice(val)}
              >
                <NumberInputField />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
            </FormControl>
            
            <FormControl isRequired>
              <FormLabel>Maximum Tickets</FormLabel>
              <NumberInput 
                min={2} 
                max={1000} 
                value={maxTickets} 
                onChange={(_, val) => setMaxTickets(val)}
              >
                <NumberInputField />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
            </FormControl>
            
            <FormControl isRequired>
              <FormLabel>Raffle Duration (blocks)</FormLabel>
              <NumberInput 
                min={30} 
                value={durationBlocks} 
                onChange={(_, val) => setDurationBlocks(val)}
              >
                <NumberInputField />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
              <FormHelperText color="gray.400">
                A block is created approximately every ~2 minutes. 
                720 blocks ≈ 24 hours.
              </FormHelperText>
            </FormControl>
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
            Create Raffle
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
```

## Step 4: Create the Raffle Page

Create a new file `src/pages/RafflePage.tsx`:

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
} from "@chakra-ui/react";
import { FaPlus } from 'react-icons/fa';
import { PageLayout } from '../components/layout/PageLayout';
import { WalletConnector, WalletData } from '../components/wallet/WalletConnector';
import { RaffleCard } from '../components/raffle/RaffleCard';
import { CreateRaffleForm } from '../components/raffle/CreateRaffleForm';

// Mock function to get active raffles - in a real app, you would fetch these from a backend or directly from blockchain
const getActiveRaffles = async (currentHeight: number) => {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Return mock data
  return [
    {
      boxId: "mock-box-id-1",
      creatorAddress: "9f4QF8AD1nQ3nJahQVkMj8hFSVVzVom77b52JU7EW71Zexg6N8v",
      ticketPrice: 1 * 1000000000, // 1 ERG in nanoERG
      deadline: currentHeight + 300, // 10 hours from now
      maxTickets: 10,
      participants: ['addr1', 'addr2', 'addr3'],
      prizeType: 'ERG' as const,
      prizeAmount: (5 * 1000000000).toString(), // 5 ERG in nanoERG
    },
    {
      boxId: "mock-box-id-2",
      creatorAddress: "your-address-here", // Set to current user to test creator features
      ticketPrice: 0.5 * 1000000000, // 0.5 ERG in nanoERG
      deadline: currentHeight - 50, // Raffle ended
      maxTickets: 20,
      participants: Array(15).fill('addr1'), // 15 participants
      prizeType: 'TOKEN' as const,
      prizeAmount: "1",
      prizeTokenId: "mock-token-id",
      prizeTokenName: "Ergo NFT #123",
    },
    // Add more mock raffles as needed
  ];
};

export const RafflePage: React.FC = () => {
  const [walletData, setWalletData] = useState<WalletData>({
    isConnected: false,
    ergBalance: '0',
    tokens: [],
    walletStatus: 'Not connected'
  });
  
  const [raffles, setRaffles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentHeight, setCurrentHeight] = useState(0);
  
  const { isOpen, onOpen, onClose } = useDisclosure();
  const walletConnectorRef = useRef<() => void>(() => {});
  
  // For demo, use a fixed address. In real app, get this from wallet connection
  const userAddress = 'your-address-here';
  
  useEffect(() => {
    const getCurrentHeight = async () => {
      try {
        // In real app, get from blockchain
        const height = 857000; // Sample height
        setCurrentHeight(height);
      } catch (error) {
        console.error('Error getting current height:', error);
      }
    };
    
    getCurrentHeight();
    loadRaffles();
  }, []);
  
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
  };
  
  const loadRaffles = async () => {
    setIsLoading(true);
    try {
      const activeRaffles = await getActiveRaffles(currentHeight);
      setRaffles(activeRaffles);
    } catch (error) {
      console.error('Error loading raffles:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Mock user tokens for the demo
  const userTokens = walletData.tokens.map(token => ({
    tokenId: token.tokenId,
    name: token.name,
    amount: Number(token.amount),
  }));
  
  return (
    <PageLayout
      title="Ergo Raffles"
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
            Ergo Raffles
          </Heading>
          
          {walletData.isConnected && (
            <Button 
              colorScheme="blue" 
              leftIcon={<Icon as={FaPlus} />}
              onClick={onOpen}
            >
              Create Raffle
            </Button>
          )}
        </Flex>
        
        {isLoading ? (
          <Flex justify="center" my={10}>
            <Spinner size="xl" color="ergnome.blue" />
          </Flex>
        ) : raffles.length === 0 ? (
          <Text textAlign="center" fontSize="lg" color="gray.400">
            No active raffles found. {!walletData.isConnected && "Connect your wallet to create a raffle!"}
          </Text>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
            {raffles.map((raffle) => (
              <RaffleCard 
                key={raffle.boxId}
                raffle={raffle}
                userAddress={userAddress}
                currentHeight={currentHeight}
                onRaffleUpdate={loadRaffles}
              />
            ))}
          </SimpleGrid>
        )}
      </Box>
      
      <CreateRaffleForm 
        isOpen={isOpen}
        onClose={onClose}
        userAddress={userAddress}
        userTokens={userTokens}
        currentHeight={currentHeight}
        onRaffleCreated={loadRaffles}
      />
    </PageLayout>
  );
};
```

## Step 5: Update App.tsx

Update your `src/App.tsx` to use the new raffle page:

```tsx
import React from 'react';
import { ChakraProvider } from "@chakra-ui/react";
import theme from './theme';
import { RafflePage } from './pages/RafflePage';

export const App = () => {
  return (
    <ChakraProvider theme={theme}>
      <RafflePage />
    </ChakraProvider>
  );
};
```

## Step 6: Run and Test

```bash
npm start
```

Your raffle application will allow users to:
1. Connect their wallet
2. Create new raffles with ERG or token prizes
3. Buy tickets for active raffles
4. Draw winners when raffles end

## Important Considerations

1. **Smart Contract Security**: The provided contract is simplified for educational purposes. In production, a more robust contract would be required.
2. **Randomness**: Blockchain randomness is a complex topic. For production applications, consider using oracle services or commit-reveal patterns for better randomness.
3. **Backend Integration**: A backend service would help index and track raffles more efficiently.

## Extending Your Raffle Application

1. **User Profile**: Add a page to view raffles created by or participated in by the user.
2. **Raffle History**: Show past raffles and their winners.
3. **Multiple Prizes**: Allow raffles with multiple prize tiers.
4. **Time-based Draws**: Automatically draw winners after the deadline passes.

This tutorial provides a starting point for building a raffle application on Ergo. The smart contract functionality is simplified for educational purposes - in a production environment, you would want more robust contract logic and thorough testing. 