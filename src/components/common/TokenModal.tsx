import React from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Box,
  VStack,
  Heading,
  Text,
  Image,
  Button,
  Icon,
  Flex,
  useColorModeValue,
  SimpleGrid,
  Badge
} from '@chakra-ui/react';
import { FaShare } from 'react-icons/fa';
import { formatTokenAmount } from '../../utils/ergo';
import { is721Metadata } from '../../utils/ergo';
import { TokenData } from './TokenCard';
import { PlaceholderImage, CollectionBadge } from './TextElements';

interface TokenModalProps {
  token: TokenData | null;
  isOpen: boolean;
  onClose: () => void;
  renderDescription: (description: string, isModal: boolean) => React.ReactNode;
}

export const TokenModal: React.FC<TokenModalProps> = ({
  token,
  isOpen,
  onClose,
  renderDescription
}) => {
  // Always declare hooks at the top level
  const modalBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gold', 'yellow.600');
  const attributeBg = useColorModeValue('gray.100', 'gray.700');
  
  if (!token) return null;

  const {
    tokenId,
    name,
    description,
    imageUrl,
    amount,
    decimals,
    collection,
    attributes
  } = token;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      isCentered
      motionPreset="slideInBottom"
    >
      <ModalOverlay
        bg="blackAlpha.300"
        backdropFilter="blur(10px)"
      />
      <ModalContent
        bg={modalBg}
        borderWidth="3px"
        borderColor={borderColor}
        borderRadius="xl"
        overflow="hidden"
        boxShadow="0px 10px 30px rgba(0, 0, 0, 0.4)"
      >
        {/* Collection Banner */}
        {collection && (
          <CollectionBadge collection={collection} fontSize="sm" py={2} />
        )}

        <ModalHeader
          textAlign="center"
          borderBottom="1px solid"
          borderColor="gray.200"
          pb={3}
          px={6}
        >
          <Heading
            size="lg"
            fontFamily="serif"
            bgGradient="linear(to-r, orange.400, red.500)"
            bgClip="text"
          >
            {name || 'Unknown Token'}
          </Heading>
        </ModalHeader>

        <ModalCloseButton size="lg" />

        <ModalBody p={6}>
          <VStack spacing={6}>
            {/* Larger Image Display */}
            <Box
              p={2}
              borderRadius="md"
              borderWidth="1px"
              borderColor="gray.300"
              boxShadow="lg"
              w="100%"
              maxW="500px"
              mx="auto"
            >
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={name}
                  objectFit="cover"
                  width="100%"
                  borderRadius="md"
                />
              ) : (
                <PlaceholderImage
                  name={name}
                  tokenId={tokenId}
                  showExpandIcon={false}
                />
              )}
            </Box>

            {/* Enhanced Description/Metadata */}
            <Box w="100%" textAlign="center">
              {description ? (
                renderDescription(description, true)
              ) : (
                <Text color="gray.500">No description available</Text>
              )}
            </Box>

            {/* Attributes - if not 721 metadata */}
            {attributes && attributes.length > 0 && !is721Metadata(description) && (
              <Box
                w="100%"
                p={4}
                borderRadius="md"
                borderWidth="1px"
                borderColor="gray.300"
                bg="gray.50"
                _dark={{ bg: "gray.700" }}
              >
                <Heading size="sm" mb={3}>Attributes</Heading>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                  {attributes.map((attr, idx) => (
                    <Flex
                      key={idx}
                      justify="space-between"
                      bg={attributeBg}
                      p={2}
                      borderRadius="md"
                      fontSize="sm"
                    >
                      <Text fontWeight="bold">{attr.trait_type}:</Text>
                      <Badge colorScheme="blue" fontSize="sm">
                        {attr.value}
                      </Badge>
                    </Flex>
                  ))}
                </SimpleGrid>
              </Box>
            )}

            {/* Token Details */}
            <Box
              w="100%"
              p={4}
              borderRadius="md"
              borderWidth="1px"
              borderColor="gray.300"
              bg="gray.50"
              _dark={{ bg: "gray.700" }}
            >
              <VStack align="stretch" spacing={3}>
                <Flex justify="space-between">
                  <Text fontWeight="bold">Token ID:</Text>
                  <Text fontFamily="mono" fontSize="sm">
                    {tokenId}
                  </Text>
                </Flex>

                <Flex justify="space-between">
                  <Text fontWeight="bold">Amount:</Text>
                  <Text fontWeight="bold" color="orange.500">
                    {formatTokenAmount(amount, decimals || 0)}
                  </Text>
                </Flex>

                {decimals !== undefined && (
                  <Flex justify="space-between">
                    <Text fontWeight="bold">Decimals:</Text>
                    <Text>{decimals}</Text>
                  </Flex>
                )}

                {collection && (
                  <Flex justify="space-between">
                    <Text fontWeight="bold">Collection:</Text>
                    <Text>{collection}</Text>
                  </Flex>
                )}
              </VStack>
            </Box>
          </VStack>
        </ModalBody>

        <ModalFooter
          borderTop="1px solid"
          borderColor="gray.200"
          justifyContent="space-between"
        >
          <Button
            leftIcon={<Icon as={FaShare} />}
            variant="ghost"
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(tokenId);
              }
            }}
          >
            Copy Token ID
          </Button>
          <Button variant="solid" colorScheme="blue" onClick={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}; 