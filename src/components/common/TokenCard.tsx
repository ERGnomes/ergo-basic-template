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
  Tooltip,
  Tag,
  TagLabel
} from '@chakra-ui/react';
import { FaInfoCircle } from 'react-icons/fa';
import { formatTokenAmount } from '../../utils/ergo';
import { TokenMetadata } from '../../utils/metadata';
import { tokenCardStyles } from '../../utils/textFormat';
import { 
  AddressText, 
  DynamicTitle, 
  PlaceholderImage,
  CollectionBadge,
  TokenAmount
} from './TextElements';
import { MetadataRenderer } from './MetadataRenderer';
import { isUrl } from '../../utils/textFormat';

export interface TokenData {
  tokenId: string;
  name: string;
  description: string;
  imageUrl: string;
  amount?: string;
  decimals?: number;
  collection?: string;
  attributes?: Array<{trait_type: string; value: string}>;
  metadata?: TokenMetadata;
  tokenType?: 'nft' | 'fungible' | 'unknown';
  rawData?: any;
}

interface TokenCardProps {
  token: TokenData;
  onSelect?: (token: TokenData) => void;
  renderDescription?: (description: string, isModal?: boolean) => React.ReactNode;
  onClick?: () => void;
  isSelected?: boolean;
  showAmount?: boolean;
}

export const TokenCard: React.FC<TokenCardProps> = ({
  token,
  onSelect,
  renderDescription,
  onClick,
  isSelected = false,
  showAmount = true
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
    attributes = [],
    metadata
  } = token || {};

  // Styling
  const cardBg = useColorModeValue('gray.50', 'gray.900');
  const borderColor = useColorModeValue('gold', 'yellow.600');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  const selectedBg = useColorModeValue('blue.50', 'blue.900');
  const selectedBorder = useColorModeValue('blue.500', 'blue.300');
  const textColor = useColorModeValue('gray.800', 'gray.200');
  const subTextColor = useColorModeValue('gray.600', 'gray.400');
  const badgeBg = useColorModeValue('blue.100', 'blue.900');
  const badgeColor = useColorModeValue('blue.800', 'blue.100');
  
  // Get image URL from metadata or description
  const imageUrlFromToken = metadata?.image || (description && isUrl(description) ? description : undefined);

  // Extract key metadata fields
  const metadataCreator = metadata?.creator;
  const metadataSeries = metadata?.traits?.Series || metadata?.traits?.series;
  const metadataSeed = metadata?.traits?.Seed || metadata?.traits?.seed;
  // For token ID display, ensure we're using the real token ID, not metadata which might be wrong
  const displayTokenId = tokenId; // Always use the real token ID from the token object
  
  // Use metadata collection name if available
  const displayCollection = metadata?.collection || collection;
  // Use metadata name if available, otherwise use token name
  const displayName = metadata?.name || name;

  // Get top attributes to display prominently
  const priorityAttributes = ['Background', 'Skin tone', 'Gender', 'Clothes'];
  const teaserAttributes = attributes.filter(attr => 
    priorityAttributes.includes(attr.trait_type)
  ).slice(0, 2);

  // Render description or metadata
  const renderContent = () => {
    if (!description && !metadata) return null;

    if (metadata) {
      return <MetadataRenderer metadata={metadata} isModal={false} />;
    }

    if (renderDescription) {
      return renderDescription(description);
    }

    return (
      <Text fontSize="sm" noOfLines={2} color={subTextColor}>
        {description}
      </Text>
    );
  };

  // Handle card click
  const handleClick = () => {
    if (onSelect) {
      onSelect(token);
    }
    if (onClick) {
      onClick();
    }
  };

  return (
    <Card 
      bg={cardBg}
      borderWidth={tokenCardStyles.borderWidth}
      borderColor={isSelected ? selectedBorder : borderColor}
      borderRadius={tokenCardStyles.borderRadius}
      overflow="hidden"
      boxShadow={tokenCardStyles.boxShadow}
      transition="all 0.3s"
      _hover={{ 
        transform: tokenCardStyles.hoverTransform,
        boxShadow: tokenCardStyles.hoverShadow,
        cursor: 'pointer',
        bg: isSelected ? selectedBg : hoverBg
      }}
      onClick={handleClick}
      height="500px"
      display="flex"
      flexDirection="column"
    >
      {/* Collection Banner */}
      {displayCollection && (
        <CollectionBadge collection={displayCollection} />
      )}
      
      {/* Image with frame effect */}
      <Box position="relative" pt={displayCollection ? 0 : 4} px={4} height="250px">
        {(imageUrl || imageUrlFromToken) ? (
          <Image 
            src={imageUrl || imageUrlFromToken} 
            alt={displayName} 
            objectFit="cover"
            borderRadius="md"
            height="100%"
            width="100%"
            border="1px solid"
            borderColor="gray.300"
            fallback={<PlaceholderImage name={displayName} tokenId={tokenId} height="100%" />}
          />
        ) : (
          <PlaceholderImage 
            name={displayName} 
            tokenId={tokenId} 
            height="100%"
          />
        )}
      </Box>
      
      <CardBody pt={3} pb={1} flex="1" overflowY="auto" maxH="150px">
        {/* Token Name */}
        <Tooltip label={displayName} placement="top" hasArrow>
          <Box>
            <DynamicTitle title={displayName || 'Unknown Token'} color={textColor} />
          </Box>
        </Tooltip>
        
        {/* Series/Seed/Creator Info */}
        {(metadataSeries || metadataSeed || metadataCreator) && (
          <Flex wrap="wrap" justify="center" gap={1} mt={1} mb={2}>
            {metadataSeries && (
              <Tag size="sm" bg={badgeBg} color={badgeColor}>
                <TagLabel>Series: {metadataSeries}</TagLabel>
              </Tag>
            )}
            {metadataSeed && (
              <Tag size="sm" bg={badgeBg} color={badgeColor}>
                <TagLabel>Seed: {metadataSeed}</TagLabel>
              </Tag>
            )}
            {metadataCreator && (
              <Tooltip label={`Creator: ${metadataCreator}`} placement="top" hasArrow>
                <Tag size="sm" bg={badgeBg} color={badgeColor}>
                  <TagLabel>By: {metadataCreator.substring(0, 12)}...</TagLabel>
                </Tag>
              </Tooltip>
            )}
          </Flex>
        )}
        
        {/* Teaser Attributes */}
        {teaserAttributes.length > 0 && (
          <Flex wrap="wrap" justify="center" gap={1} mb={2}>
            {teaserAttributes.map((attr, idx) => (
              <Tag size="sm" key={idx} colorScheme="green">
                <TagLabel>{attr.trait_type}: {attr.value}</TagLabel>
              </Tag>
            ))}
            {attributes.length > teaserAttributes.length && (
              <Tag size="sm" colorScheme="blue">
                <TagLabel>+{attributes.length - teaserAttributes.length} more</TagLabel>
              </Tag>
            )}
          </Flex>
        )}
        
        {/* Description or Metadata */}
        <Box textAlign="center" minH="40px">
          {renderContent()}
        </Box>
      </CardBody>
      
      <Divider borderColor="gray.300" />
      
      {/* Footer with Details */}
      <CardFooter pt={2} pb={4} px={4}>
        <VStack align="stretch" width="100%" spacing={3}>
          {/* Display amount for regular tokens */}
          {amount && showAmount && (
            <TokenAmount 
              amount={amount} 
              formatted={formatTokenAmount(amount, decimals)} 
              color={textColor}
            />
          )}
          
          {/* Token ID display - Use the real token ID, not potentially incorrect metadata */}
          <Flex 
            align="center" 
            justify="space-between"
            mt={2}
            pt={2}
            borderTop="1px dashed"
            borderColor="gray.300"
          >
            <Text fontSize="xs" color={subTextColor}>
              <Icon as={FaInfoCircle} mr={1} />
              TOKEN ID:
            </Text>
            <Box>
              <AddressText 
                address={displayTokenId} 
                color={textColor}
                isTokenId={true}
              />
            </Box>
          </Flex>
        </VStack>
      </CardFooter>
    </Card>
  );
}; 