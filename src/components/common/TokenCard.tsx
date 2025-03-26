import React from 'react';
import {
  Card,
  CardBody,
  CardFooter,
  Box,
  Image,
  Divider,
  VStack,
  Flex,
  Icon,
  Text,
  useColorModeValue,
  Tooltip
} from '@chakra-ui/react';
import { FaInfoCircle } from 'react-icons/fa';
import { formatTokenAmount } from '../../utils/ergo';
import { is721Metadata } from '../../utils/ergo';
import { tokenCardStyles } from '../../utils/textFormat';
import { 
  AddressText, 
  DynamicTitle, 
  PlaceholderImage,
  CollectionBadge,
  TokenAmount
} from './TextElements';

export interface TokenData {
  tokenId: string;
  name: string;
  description: string;
  imageUrl: string;
  amount?: string;
  decimals?: number;
  collection?: string;
  attributes?: Array<{trait_type: string; value: string}>;
}

interface TokenCardProps {
  token: TokenData;
  onSelect: (token: TokenData) => void;
  renderDescription: (description: string, isModal?: boolean) => React.ReactNode;
}

export const TokenCard: React.FC<TokenCardProps> = ({
  token,
  onSelect,
  renderDescription
}) => {
  // Safely extract values with defaults if missing
  const {
    tokenId = '',
    name = 'Unknown Token',
    description = '',
    imageUrl = '',
    amount,
    decimals = 0,
    collection,
    attributes = []
  } = token || {};

  // Styling
  const cardBg = useColorModeValue('gray.50', 'gray.900');
  const borderColor = useColorModeValue('gold', 'yellow.600');
  const attributeBg = useColorModeValue('gray.100', 'gray.700');

  return (
    <Card 
      bg={cardBg}
      borderWidth={tokenCardStyles.borderWidth}
      borderColor={borderColor}
      borderRadius={tokenCardStyles.borderRadius}
      overflow="hidden"
      boxShadow={tokenCardStyles.boxShadow}
      transition="all 0.3s"
      _hover={{ 
        transform: tokenCardStyles.hoverTransform,
        boxShadow: tokenCardStyles.hoverShadow,
        cursor: 'pointer'
      }}
      onClick={() => onSelect(token)}
    >
      {/* Collection Banner */}
      {collection && (
        <CollectionBadge collection={collection} />
      )}
      
      {/* Image with frame effect */}
      <Box position="relative" pt={collection ? 0 : 4} px={4}>
        {imageUrl ? (
          <Image 
            src={imageUrl} 
            alt={name} 
            objectFit="cover"
            borderRadius="md"
            height={tokenCardStyles.imageHeight}
            width="100%"
            border="1px solid"
            borderColor="gray.300"
          />
        ) : (
          <PlaceholderImage 
            name={name} 
            tokenId={tokenId} 
            height={tokenCardStyles.imageHeight}
          />
        )}
      </Box>
      
      <CardBody pt={3} pb={1}>
        {/* Token Name */}
        <Tooltip label={name} placement="top" hasArrow>
          <Box>
            <DynamicTitle title={name || 'Unknown Token'} />
          </Box>
        </Tooltip>
        
        {/* Description or Metadata */}
        <Box textAlign="center" minH="40px">
          {description && renderDescription(description)}
        </Box>
      </CardBody>
      
      <Divider borderColor="gray.300" />
      
      {/* Footer with Details */}
      <CardFooter pt={2} pb={4} px={4}>
        <VStack align="stretch" width="100%" spacing={3}>
          {/* Display amount for regular tokens or tokens that aren't NFTs with 721 metadata */}
          {((amount && amount !== "1") || !is721Metadata?.(description)) && (
            <TokenAmount 
              amount={amount || '0'} 
              formatted={formatTokenAmount(amount, decimals)} 
            />
          )}
          
          {/* Attributes section */}
          {attributes && attributes.length > 0 && !is721Metadata?.(description) && (
            <Box>
              <Text fontSize="xs" fontWeight="bold" color="gray.500" mb={1}>
                ATTRIBUTES
              </Text>
              <VStack spacing={2} align="stretch">
                {attributes.map((attr, idx) => (
                  <Flex 
                    key={idx} 
                    justify="space-between" 
                    bg={attributeBg}
                    p={2}
                    borderRadius="md"
                    fontSize="xs"
                  >
                    <Text fontWeight="bold">{attr.trait_type}:</Text>
                    <Text color="blue.500" fontWeight="medium">
                      {attr.value}
                    </Text>
                  </Flex>
                ))}
              </VStack>
            </Box>
          )}
          
          {/* Token ID display */}
          <Flex 
            align="center" 
            justify="space-between"
            mt={2}
            pt={2}
            borderTop="1px dashed"
            borderColor="gray.300"
          >
            <Text fontSize="xs" color="gray.500">
              <Icon as={FaInfoCircle} mr={1} />
              TOKEN ID:
            </Text>
            <Tooltip label={tokenId} placement="top" hasArrow>
              <Box>
                <AddressText address={tokenId} />
              </Box>
            </Tooltip>
          </Flex>
        </VStack>
      </CardFooter>
    </Card>
  );
}; 