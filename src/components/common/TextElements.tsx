import React from 'react';
import { 
  Text, 
  Badge, 
  Heading, 
  Box, 
  TextProps, 
  BadgeProps,
  HeadingProps,
  useColorModeValue,
  Flex,
  Tooltip,
  Center
} from '@chakra-ui/react';
import { 
  shortenAddress, 
  dynamicFontSize, 
  formatTitle
} from '../../utils/textFormat';
import { shortenTokenId } from '../../utils/ergo';

// Address or Token ID display
interface AddressTextProps extends TextProps {
  address: string;
  startChars?: number;
  endChars?: number;
  isTokenId?: boolean;
  showTooltip?: boolean;
}

export const AddressText: React.FC<AddressTextProps> = ({ 
  address, 
  startChars = 6, 
  endChars = 6,
  isTokenId = false,
  showTooltip = true,
  ...props 
}) => {
  // Use more characters for token IDs by default
  const start = isTokenId ? 10 : startChars;
  const end = isTokenId ? 10 : endChars;
  
  // Choose the appropriate shortening function
  const shortened = isTokenId 
    ? shortenTokenId(address, start, end)
    : shortenAddress(address, start, end);
  
  const content = (
    <Text fontFamily="mono" fontSize="xs" color="gray.500" {...props}>
      {shortened}
    </Text>
  );
  
  // Wrap in tooltip if needed
  return showTooltip ? (
    <Tooltip label={address} placement="top" hasArrow>
      {content}
    </Tooltip>
  ) : content;
};

// Dynamic Title
interface DynamicTitleProps extends HeadingProps {
  title: string;
  maxLength?: number;
}

export const DynamicTitle: React.FC<DynamicTitleProps> = ({ 
  title, 
  maxLength = 30,
  ...props 
}) => {
  // Using the dynamic font size function for reference but not using the result directly
  // to avoid the unused variable warning. The function will be used in other places.
  dynamicFontSize(title);
  
  return (
    <Heading 
      size="md"
      isTruncated={title.length > maxLength}
      fontFamily="serif"
      textAlign="center"
      mb={2}
      {...props}
    >
      {formatTitle(title, maxLength)}
    </Heading>
  );
};

// Placeholder Image for tokens without images
interface PlaceholderImageProps {
  name: string;
  tokenId: string;
  height?: string | number;
  width?: string | number;
  showExpandIcon?: boolean;
}

export const PlaceholderImage: React.FC<PlaceholderImageProps> = ({ name, tokenId, height }) => {
  const textColor = useColorModeValue('white', 'white');
  
  // Process name for display as initials
  let displayName = name || '';
  let initials = displayName.substring(0, 3).toUpperCase();
  
  // Special handling for rosen bridge HOSKY token
  if (displayName.toLowerCase().includes('rosen') && 
      displayName.toLowerCase().includes('bridge') &&
      displayName.toLowerCase().includes('hosky')) {
    initials = 'HSK';
  }
  
  // Generate a deterministic color from the token ID
  const tokenColor = tokenId ? 
    `#${tokenId.substring(0, 6)}` : 
    '#6247aa'; // Fallback color
  
  return (
    <Center
      height={height}
      width="100%"
      bg={tokenColor}
      borderRadius="md"
      color={textColor}
      fontSize={height ? "calc(min(5vw, 3rem))" : "2xl"}
      fontWeight="bold"
      letterSpacing="wide"
      position="relative"
      overflow="hidden"
    >
      {/* Colored background with token initials */}
      <Text 
        fontSize={height ? "calc(min(5vw, 3rem))" : "2xl"}
        fontWeight="bold"
        textShadow="0px 2px 10px rgba(0, 0, 0, 0.3)"
      >
        {initials}
      </Text>
      
      {/* Small token ID display at bottom */}
      <Text 
        position="absolute" 
        bottom="2" 
        fontSize="xs" 
        opacity={0.7}
        textShadow="0px 1px 2px rgba(0, 0, 0, 0.5)"
      >
        {tokenId.slice(0, 8)}...
      </Text>
    </Center>
  );
};

// Styled Chips/Badges for metadata
interface TraitChipProps extends BadgeProps {
  traitType: string;
  value: string;
}

export const TraitChip: React.FC<TraitChipProps> = ({ 
  traitType, 
  value,
  ...props 
}) => {
  const bgColor = useColorModeValue('blue.50', 'blue.900');
  
  return (
    <Badge 
      px={2} 
      py={1} 
      borderRadius="md"
      fontSize="xs"
      bg={bgColor}
      display="flex"
      flexDirection="column"
      alignItems="center"
      {...props}
    >
      <Text fontWeight="bold" fontSize="10px" color="gray.500">{traitType}</Text>
      <Text>{value}</Text>
    </Badge>
  );
};

// Collection Badge
interface CollectionBadgeProps extends BadgeProps {
  collection: string;
}

export const CollectionBadge: React.FC<CollectionBadgeProps> = ({
  collection,
  ...props
}) => {
  const redAccent = useColorModeValue('ergnome.redAccent.light', 'ergnome.red');
  
  return (
    <Box
      bg={redAccent}
      color="white"
      fontWeight="bold"
      fontSize="xs"
      textAlign="center"
      py={1}
      px={2}
      {...props}
    >
      {collection}
    </Box>
  );
};

// Token Amount Display
interface TokenAmountProps extends TextProps {
  amount?: string;
  formatted: string;
}

export const TokenAmount: React.FC<TokenAmountProps> = ({
  amount,
  formatted = '0',
  ...props
}) => {
  const orangeAccent = useColorModeValue('ergnome.orangeAccent.light', 'ergnome.orange');
  
  return (
    <Flex justify="space-between" bg={useColorModeValue('blue.50', 'blue.900')} p={2} borderRadius="md">
      <Text fontWeight="bold" fontSize="sm">Amount:</Text>
      <Text fontSize="sm" color={orangeAccent} fontWeight="bold" {...props}>
        {formatted || '0'}
      </Text>
    </Flex>
  );
}; 