import React, { useState, useEffect } from 'react';
import {
  Box,
  SimpleGrid,
  Text,
  useColorModeValue,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Heading,
  Spinner,
  Center,
  HStack,
  Select,
  Flex,
  Input,
  InputGroup,
  InputLeftElement,
  Tag,
  TagLabel,
  TagCloseButton,
  VStack,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Image,
  Badge,
  Tooltip,
  Button,
  Icon
} from '@chakra-ui/react';
import { SearchIcon, CopyIcon } from '@chakra-ui/icons';
import { TokenCard, TokenData } from '../common/TokenCard';
import { MetadataRenderer } from '../common/MetadataRenderer';
import { filterNFTs, groupByCollection } from '../../utils/tokenProcessing';
import { useWallet } from '../../context/WalletContext';
import { 
  getUniqueTraitTypes, 
  getTraitValues, 
  advancedFilter 
} from '../../utils/tokenFiltering';
import { shortenTokenId } from '../../utils/ergo';

interface NFTGalleryProps {
  title?: string;
}

export const NFTGallery: React.FC<NFTGalleryProps> = ({ title = "NFT Gallery" }) => {
  const { walletData } = useWallet();
  const { isConnected, tokens: walletTokens } = walletData;
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [filteredTokens, setFilteredTokens] = useState<TokenData[]>([]);
  const [selectedToken, setSelectedToken] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [walletLoading, setWalletLoading] = useState(true);
  const [collections, setCollections] = useState<Record<string, TokenData[]>>({});
  const [selectedCollection, setSelectedCollection] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [traitFilters, setTraitFilters] = useState<{[trait: string]: string}>({});
  const [availableTraitTypes, setAvailableTraitTypes] = useState<string[]>([]);
  const [traitValues, setTraitValues] = useState<{[trait: string]: string[]}>({});
  
  const { isOpen, onOpen, onClose } = useDisclosure();
  const modalBg = useColorModeValue('white', 'gray.800');
  const attributeBg = useColorModeValue('gray.50', 'gray.700');

  // Function to render description based on token's metadata
  const renderDescription = (description: string, isModal: boolean = false) => {
    if (!description) return null;
    return <Text fontSize={isModal ? "md" : "sm"} noOfLines={isModal ? undefined : 2}>{description}</Text>;
  };

  // Process tokens from wallet context
  useEffect(() => {
    // Set a short delay to allow wallet connection to initialize
    const timer = setTimeout(() => {
      setWalletLoading(false);
    }, 1500);
    
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isConnected) {
      setLoading(false);
      return;
    }

    if (walletTokens.length > 0) {
      // Filter to only include NFTs
      const nftTokens = filterNFTs(walletTokens);
      
      // Group by collections
      const collectionGroups = groupByCollection(nftTokens);
      
      // Extract trait types and values for filtering
      const traitTypes = getUniqueTraitTypes(nftTokens);
      
      // Get values for each trait type
      const traitValueMap: {[trait: string]: string[]} = {};
      traitTypes.forEach(trait => {
        traitValueMap[trait] = getTraitValues(nftTokens, trait);
      });
      
      setTokens(nftTokens);
      setFilteredTokens(nftTokens);
      setCollections(collectionGroups);
      setAvailableTraitTypes(traitTypes);
      setTraitValues(traitValueMap);
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [isConnected, walletTokens]);

  // Effect to apply filters when any filter criterion changes
  useEffect(() => {
    if (tokens.length === 0) return;
    
    // Apply filters
    const filtered = advancedFilter(tokens, {
      collections: selectedCollection !== 'all' ? [selectedCollection] : undefined,
      searchTerm: searchTerm || undefined,
      traits: Object.keys(traitFilters).length > 0 ? traitFilters : undefined
    });
    
    setFilteredTokens(filtered);
  }, [selectedCollection, searchTerm, traitFilters, tokens]);

  const handleSelectToken = (token: TokenData) => {
    setSelectedToken(token);
    onOpen();
  };

  const handleTraitFilterSelect = (traitType: string, value: string) => {
    setTraitFilters(prev => ({
      ...prev,
      [traitType]: value
    }));
  };

  const handleRemoveTraitFilter = (traitType: string) => {
    setTraitFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[traitType];
      return newFilters;
    });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  // Show loading state while checking wallet connection
  if (walletLoading) {
    return (
      <Center h="50vh">
        <VStack spacing={4}>
          <Spinner size="xl" />
          <Text>Checking wallet connection...</Text>
        </VStack>
      </Center>
    );
  }

  if (!isConnected) {
    return (
      <Center h="50vh">
        <Text>Please connect your wallet to view NFTs.</Text>
      </Center>
    );
  }

  if (loading) {
    return (
      <Center h="50vh">
        <Spinner size="xl" />
      </Center>
    );
  }

  if (!tokens.length) {
    return (
      <Center h="50vh">
        <Text>No NFTs found in your wallet.</Text>
      </Center>
    );
  }

  return (
    <Box p={4}>
      <HStack justify="space-between" mb={6}>
        <Heading size="lg">{title}</Heading>
        <Text color="gray.500">{filteredTokens.length} of {tokens.length} NFTs</Text>
      </HStack>

      {/* Filtering Controls */}
      <Box mb={6} p={4} borderWidth="1px" borderRadius="lg">
        <VStack spacing={4} align="stretch">
          <Flex direction={{ base: 'column', md: 'row' }} gap={4}>
            {/* Collection Filter */}
            <Box flexBasis={{ base: '100%', md: '30%' }}>
              <Select 
                value={selectedCollection} 
                onChange={(e) => setSelectedCollection(e.target.value)}
                placeholder="Filter by collection"
              >
                <option value="all">All Collections</option>
                {Object.keys(collections).map(collection => (
                  <option key={collection} value={collection}>
                    {collection} ({collections[collection].length})
                  </option>
                ))}
              </Select>
            </Box>

            {/* Search Filter */}
            <Box flex={1}>
              <InputGroup>
                <InputLeftElement pointerEvents="none">
                  <SearchIcon color="gray.300" />
                </InputLeftElement>
                <Input 
                  placeholder="Search NFTs by name"
                  value={searchTerm}
                  onChange={handleSearchChange}
                />
              </InputGroup>
            </Box>
          </Flex>

          {/* Trait Filters */}
          {availableTraitTypes.length > 0 && (
            <Accordion allowToggle>
              <AccordionItem>
                <h2>
                  <AccordionButton>
                    <Box flex="1" textAlign="left">
                      Filter by traits
                    </Box>
                    <AccordionIcon />
                  </AccordionButton>
                </h2>
                <AccordionPanel>
                  <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={3}>
                    {availableTraitTypes.map(traitType => (
                      <Box key={traitType}>
                        <Text fontWeight="bold" mb={1}>{traitType}</Text>
                        <Select 
                          placeholder={`Select ${traitType}`}
                          value={traitFilters[traitType] || ''}
                          onChange={(e) => handleTraitFilterSelect(traitType, e.target.value)}
                          size="sm"
                        >
                          <option value="">Any</option>
                          {traitValues[traitType]?.map(value => (
                            <option key={value} value={value}>{value}</option>
                          ))}
                        </Select>
                      </Box>
                    ))}
                  </SimpleGrid>
                </AccordionPanel>
              </AccordionItem>
            </Accordion>
          )}

          {/* Active Filters */}
          {(selectedCollection !== 'all' || searchTerm || Object.keys(traitFilters).length > 0) && (
            <Box>
              <Text fontSize="sm" mb={2}>Active Filters:</Text>
              <Flex wrap="wrap" gap={2}>
                {selectedCollection !== 'all' && (
                  <Tag size="md" colorScheme="blue">
                    <TagLabel>Collection: {selectedCollection}</TagLabel>
                    <TagCloseButton onClick={() => setSelectedCollection('all')} />
                  </Tag>
                )}
                
                {searchTerm && (
                  <Tag size="md" colorScheme="green">
                    <TagLabel>Search: {searchTerm}</TagLabel>
                    <TagCloseButton onClick={() => setSearchTerm('')} />
                  </Tag>
                )}
                
                {Object.entries(traitFilters).map(([trait, value]) => (
                  <Tag size="md" colorScheme="purple" key={trait}>
                    <TagLabel>{trait}: {value}</TagLabel>
                    <TagCloseButton onClick={() => handleRemoveTraitFilter(trait)} />
                  </Tag>
                ))}
              </Flex>
            </Box>
          )}
        </VStack>
      </Box>

      {/* NFT Grid */}
      <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing={6}>
        {filteredTokens.map((token) => (
          <TokenCard
            key={token.tokenId}
            token={token}
            onSelect={handleSelectToken}
            renderDescription={renderDescription}
            isSelected={selectedToken?.tokenId === token.tokenId}
          />
        ))}
      </SimpleGrid>

      {/* No Results Message */}
      {filteredTokens.length === 0 && tokens.length > 0 && (
        <Center p={10}>
          <Text>No NFTs match your current filters. Try adjusting your search criteria.</Text>
        </Center>
      )}

      {/* Token Details Modal */}
      {selectedToken && isOpen && (
        <Modal isOpen={isOpen} onClose={onClose} size="4xl">
          <ModalOverlay backdropFilter="blur(10px)" />
          <ModalContent bg={modalBg} maxH="90vh">
            <ModalHeader borderBottomWidth="1px">
              <HStack>
                <Text>{selectedToken.metadata?.name || selectedToken.name}</Text>
                {selectedToken.metadata?.collection && (
                  <Badge colorScheme="blue">{selectedToken.metadata.collection}</Badge>
                )}
                {(!selectedToken.metadata?.collection && selectedToken.collection) && (
                  <Badge colorScheme="blue">{selectedToken.collection}</Badge>
                )}
              </HStack>
            </ModalHeader>
            <ModalCloseButton />
            <ModalBody pb={6} overflow="auto" maxH="calc(90vh - 120px)">
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={8} alignItems="start">
                {/* Large Image Display */}
                <Box>
                  <Box 
                    borderWidth="1px" 
                    borderRadius="lg" 
                    overflow="hidden"
                    boxShadow="lg"
                    maxH="calc(90vh - 180px)"
                    position="relative"
                  >
                    <Image 
                      src={selectedToken.imageUrl} 
                      alt={selectedToken.name}
                      objectFit="contain"
                      maxH="calc(90vh - 180px)"
                      w="100%"
                      fallbackSrc="https://via.placeholder.com/600?text=Loading+Image"
                    />
                  </Box>
                  
                  {/* Token ID display under image */}
                  <Box mt={4} p={3} borderWidth="1px" borderRadius="md" bg={attributeBg}>
                    <Flex justify="space-between" align="center">
                      <Text fontSize="sm" fontWeight="bold" color="gray.500">Token ID</Text>
                      <Tooltip label="Copy Token ID" placement="top">
                        <Button 
                          size="xs" 
                          variant="ghost" 
                          onClick={() => {
                            if (navigator.clipboard) {
                              navigator.clipboard.writeText(selectedToken.tokenId);
                            }
                          }}
                        >
                          <Icon as={CopyIcon} />
                        </Button>
                      </Tooltip>
                    </Flex>
                    <Tooltip 
                      label={selectedToken.tokenId} 
                      placement="bottom"
                      hasArrow
                    >
                      <Text fontSize="sm" fontFamily="monospace">
                        {shortenTokenId(selectedToken.tokenId, 12, 12)}
                      </Text>
                    </Tooltip>
                  </Box>
                </Box>

                {/* Token Details */}
                <VStack align="stretch" spacing={6}>
                  {/* Collection Info - Only show if not displayed via metadata */}
                  {selectedToken.collection && !selectedToken.metadata?.collection && (
                    <Box>
                      <Text fontSize="sm" fontWeight="bold" color="gray.500">Collection</Text>
                      <Text fontSize="xl" fontWeight="bold">{selectedToken.collection}</Text>
                    </Box>
                  )}

                  {/* Description - Only show if not in metadata */}
                  {selectedToken.description && !selectedToken.metadata?.description && (
                    <Box>
                      <Text fontSize="sm" fontWeight="bold" color="gray.500" mb={2}>Description</Text>
                      {renderDescription(selectedToken.description, true)}
                    </Box>
                  )}

                  {/* Metadata Renderer - when metadata is present */}
                  {selectedToken.metadata && (
                    <Box borderWidth="1px" borderRadius="lg" p={4}>
                      <Text fontSize="sm" fontWeight="bold" color="gray.500" mb={3}>Metadata</Text>
                      <MetadataRenderer metadata={selectedToken.metadata} isModal={true} />
                    </Box>
                  )}

                  {/* Attributes/Traits - Only show if there's no metadata with traits */}
                  {Array.isArray(selectedToken.attributes) && 
                   selectedToken.attributes.length > 0 && 
                   (!selectedToken.metadata || !selectedToken.metadata.traits) && (
                    <Box borderWidth="1px" borderRadius="lg" p={4}>
                      <Text fontSize="sm" fontWeight="bold" color="gray.500" mb={3}>Attributes</Text>
                      <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={3}>
                        {selectedToken.attributes.map((attr, idx) => (
                          <Box 
                            key={idx} 
                            p={3} 
                            borderWidth="1px" 
                            borderRadius="md"
                            bg={attributeBg}
                          >
                            <Text fontSize="xs" color="gray.500">{attr.trait_type}</Text>
                            <Text fontWeight="bold">{attr.value}</Text>
                          </Box>
                        ))}
                      </SimpleGrid>
                    </Box>
                  )}
                </VStack>
              </SimpleGrid>
            </ModalBody>
          </ModalContent>
        </Modal>
      )}
    </Box>
  );
}; 