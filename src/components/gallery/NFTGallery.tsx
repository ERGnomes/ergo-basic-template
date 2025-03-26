import React, { useEffect, useState } from 'react';
import {
  Box, 
  Heading, 
  SimpleGrid, 
  Spinner, 
  Text, 
  Button,
  HStack,
  VStack,
  Center,
  Icon,
  useDisclosure,
  Link
} from '@chakra-ui/react';
import { getWalletNFTs } from '../../utils/ergo';
import { FaWallet, FaExternalLinkAlt } from 'react-icons/fa';
import { useWallet } from '../../context/WalletContext';
import { TokenCard, TokenData } from '../common/TokenCard';
import { TokenModal } from '../common/TokenModal';
import { is721Metadata } from '../../utils/ergo';
import { parse721Metadata } from '../../utils/metadata';
import { MetadataRenderer } from '../common/MetadataRenderer';

interface NFTGalleryProps {
  title?: string;
}

const NFTGallery: React.FC<NFTGalleryProps> = ({ title = "My NFT Gallery" }) => {
  const { walletData, connectToWallet } = useWallet();
  const { isConnected } = walletData;
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCollection, setSelectedCollection] = useState<string>("all");
  const [selectedToken, setSelectedToken] = useState<TokenData | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  
  // Fetch NFTs when wallet is connected
  useEffect(() => {
    const fetchNFTs = async () => {
      if (!isConnected) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        const walletNfts = await getWalletNFTs();
        setTokens(walletNfts);
      } catch (error) {
        console.error("Error fetching NFTs:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchNFTs();
  }, [isConnected]);
  
  // Get all unique collections for filtering
  const collections = Array.from(new Set(
    tokens.map(token => token.collection).filter(Boolean) as string[]
  ));
  
  // Filter tokens based on selected collection
  const filteredTokens = selectedCollection === "all" 
    ? tokens 
    : tokens.filter(token => token.collection === selectedCollection);
  
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
        <Link 
          href={description} 
          isExternal 
          color="blue.400" 
          display="inline-flex"
          alignItems="center"
          fontSize={isModal ? "sm" : "xs"}
        >
          {isModal ? description : `${description.substring(0, 30)}...`}
          <Icon as={FaExternalLinkAlt} ml={1} boxSize="2" />
        </Link>
      );
    }
    
    return <Text fontSize={isModal ? "md" : "sm"} noOfLines={isModal ? undefined : 2}>{description}</Text>;
  };

  // Handle selecting a token for the modal
  const handleSelectToken = (token: TokenData) => {
    setSelectedToken(token);
    onOpen();
  };

  return (
    <>
      <Box py={8} px={4}>
        <Heading 
          mb={6} 
          textAlign="center"
          bgGradient="linear(to-r, orange.400, red.500)"
          bgClip="text"
          size="xl"
        >
          {title}
        </Heading>
        
        {/* Collection filter */}
        {collections.length > 0 && (
          <Box mb={6}>
            <HStack spacing={4} flexWrap="wrap">
              <Text fontWeight="bold">Collection:</Text>
              <Button 
                size="sm" 
                colorScheme={selectedCollection === "all" ? "orange" : "gray"}
                onClick={() => setSelectedCollection("all")}
              >
                All
              </Button>
              {collections.map(collection => (
                <Button
                  key={collection}
                  size="sm"
                  colorScheme={selectedCollection === collection ? "orange" : "gray"}
                  onClick={() => setSelectedCollection(collection)}
                >
                  {collection}
                </Button>
              ))}
            </HStack>
          </Box>
        )}
        
        {loading ? (
          <Center h="300px">
            <Spinner size="xl" color="orange.500" />
          </Center>
        ) : !isConnected ? (
          <Center h="300px">
            <VStack spacing={4}>
              <Text fontSize="xl">Wallet Not Connected</Text>
              <Text color="gray.500">
                Connect your wallet to view your NFTs
              </Text>
              <Button
                colorScheme="orange"
                onClick={connectToWallet}
                leftIcon={<Icon as={FaWallet} />}
              >
                Connect Wallet
              </Button>
            </VStack>
          </Center>
        ) : filteredTokens.length === 0 ? (
          <Center h="300px">
            <VStack spacing={4}>
              <Text fontSize="xl">No NFTs found</Text>
              <Text color="gray.500">
                {selectedCollection === "all" 
                  ? "Your wallet doesn't have any NFTs"
                  : `No NFTs found in the ${selectedCollection} collection`}
              </Text>
            </VStack>
          </Center>
        ) : (
          <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing={8}>
            {filteredTokens.map((token) => (
              <TokenCard
                key={token.tokenId}
                token={token}
                onSelect={() => handleSelectToken(token)}
                renderDescription={renderDescription}
              />
            ))}
          </SimpleGrid>
        )}
      </Box>

      {/* NFT Detail Modal */}
      <TokenModal
        token={selectedToken}
        isOpen={isOpen}
        onClose={onClose}
        renderDescription={renderDescription}
      />
    </>
  );
};

export default NFTGallery; 