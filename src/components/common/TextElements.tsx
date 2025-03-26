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
  AspectRatio,
  Icon,
  Flex
} from '@chakra-ui/react';
import { FaExpand } from 'react-icons/fa';
import { 
  shortenAddress, 
  dynamicFontSize, 
  formatTitle, 
  formatPlaceholderText,
  getTokenColor
} from '../../utils/textFormat';

// Address or Token ID display
interface AddressTextProps extends TextProps {
  address: string;
  startChars?: number;
  endChars?: number;
}

export const AddressText: React.FC<AddressTextProps> = ({ 
  address, 
  startChars = 6, 
  endChars = 6,
  ...props 
}) => {
  return (
    <Text fontFamily="mono" fontSize="xs" color="gray.500" {...props}>
      {shortenAddress(address, startChars, endChars)}
    </Text>
  );
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

export const PlaceholderImage: React.FC<PlaceholderImageProps> = ({ 
  name, 
  tokenId,
  height = "180px",
  width = "100%",
  showExpandIcon = true
}) => {
  const placeholderBg = useColorModeValue('gray.100', 'gray.700');
  const displayText = formatPlaceholderText(name);
  const textColor = getTokenColor(tokenId);
  const fontSize = dynamicFontSize(name);
  
  return (
    <AspectRatio ratio={1} height={height} width={width}>
      <Box
        bg={placeholderBg}
        borderRadius="md"
        display="flex"
        alignItems="center"
        justifyContent="center"
        border="1px solid"
        borderColor="gray.300"
        position="relative"
        overflow="hidden"
      >
        <Text 
          fontSize={fontSize}
          fontWeight="bold" 
          color={textColor}
          textAlign="center"
          noOfLines={1}
          px={2}
        >
          {displayText}
        </Text>
        {showExpandIcon && (
          <Text
            position="absolute"
            bottom="5px"
            right="5px"
            fontSize="xs"
            color="gray.500"
          >
            <Icon as={FaExpand} />
          </Text>
        )}
      </Box>
    </AspectRatio>
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
  return (
    <Box
      bg="red.600"
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
  return (
    <Flex justify="space-between" bg={useColorModeValue('blue.50', 'blue.900')} p={2} borderRadius="md">
      <Text fontWeight="bold" fontSize="sm">Amount:</Text>
      <Text fontSize="sm" color="orange.500" fontWeight="bold" {...props}>
        {formatted || '0'}
      </Text>
    </Flex>
  );
}; 