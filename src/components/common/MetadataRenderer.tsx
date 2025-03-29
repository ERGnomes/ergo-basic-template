import React from 'react';
import {
  Box,
  Text,
  VStack,
  useColorModeValue,
  Link,
  Divider,
  Tag,
  TagLabel,
  Flex,
  Badge,
  SimpleGrid
} from '@chakra-ui/react';
import { TokenMetadata } from '../../utils/metadata';
import { isUrl } from '../../utils/textFormat';
import { AddressText } from './TextElements';

interface MetadataRendererProps {
  metadata: TokenMetadata;
  isModal?: boolean;
}

/**
 * Component to render metadata as chips and formatted text
 */
export const MetadataRenderer: React.FC<MetadataRendererProps> = ({ metadata, isModal = false }) => {
  const labelColor = useColorModeValue('gray.600', 'gray.400');
  const dividerColor = useColorModeValue('gray.200', 'gray.700');
  const tagBg = useColorModeValue('green.100', 'green.900');
  const tagColor = useColorModeValue('green.800', 'green.100');
  const badgeBg = useColorModeValue('blue.100', 'blue.900');
  const badgeColor = useColorModeValue('blue.800', 'blue.100');
  const rosenBg = useColorModeValue('purple.100', 'purple.900');
  const rosenColor = useColorModeValue('purple.800', 'purple.100');
  const cardiacBg = useColorModeValue('orange.100', 'orange.900');
  const cardiacColor = useColorModeValue('orange.800', 'orange.100');

  const renderValue = (value: any) => {
    if (typeof value === 'string') {
      if (isUrl(value)) {
        return (
          <Link href={value} isExternal color="blue.500">
            {value}
          </Link>
        );
      }
      return value;
    }
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }
    return String(value);
  };

  const renderMetadataField = (key: string, value: any, isRosenBridge = false, is721 = false) => {
    // Skip rendering if value is null or undefined
    if (value === null || value === undefined) return null;

    // Skip rendering common fields that are handled elsewhere
    if (['name', 'description', 'image'].includes(key.toLowerCase())) return null;

    // Define visual styling based on field type
    let fieldBg = isRosenBridge ? rosenBg : is721 ? cardiacBg : badgeBg;
    let fieldColor = isRosenBridge ? rosenColor : is721 ? cardiacColor : badgeColor;

    // Special handling for important 721 metadata fields
    if (is721 && ['series', 'seed', 'creator'].includes(key.toLowerCase())) {
      fieldBg = tagBg;
      fieldColor = tagColor;
    }

    // Special handling for boolean values
    if (typeof value === 'boolean') {
      return (
        <Box>
          <Text fontSize="sm" color={labelColor} mb={1}>
            {key}
          </Text>
          <Tag size="sm" bg={fieldBg} color={fieldColor}>
            <TagLabel>{value ? 'Yes' : 'No'}</TagLabel>
          </Tag>
        </Box>
      );
    }

    // Default rendering as a chip
    return (
      <Box>
        <Text fontSize="sm" color={labelColor} mb={1}>
          {key}
        </Text>
        <Tag size="sm" bg={fieldBg} color={fieldColor}>
          <TagLabel>{renderValue(value)}</TagLabel>
        </Tag>
      </Box>
    );
  };

  const render721Metadata = () => {
    // Special handling for 721 format which contains specific structures
    const traits = metadata.traits || {};
    
    return (
      <VStack align="stretch" spacing={3}>
        {/* Format and Collection Name */}
        <Flex alignItems="center" mb={2} wrap="wrap">
          <Badge colorScheme="orange" mr={2}>721</Badge>
          {metadata.collection && (
            <Text fontSize="sm" fontWeight="bold">{metadata.collection}</Text>
          )}
        </Flex>
        
        {/* Series, seed, creator (key cardano-specific fields) */}
        <Flex flexWrap="wrap" gap={2}>
          {traits['Series'] && (
            <Box>
              <Text fontSize="sm" color={labelColor} mb={1}>Series</Text>
              <Tag size="sm" colorScheme="green">
                <TagLabel>{traits['Series']}</TagLabel>
              </Tag>
            </Box>
          )}
          
          {traits['Seed'] && (
            <Box>
              <Text fontSize="sm" color={labelColor} mb={1}>Seed</Text>
              <Tag size="sm" colorScheme="green">
                <TagLabel>{traits['Seed']}</TagLabel>
              </Tag>
            </Box>
          )}
          
          {metadata.creator && (
            <Box>
              <Text fontSize="sm" color={labelColor} mb={1}>Creator</Text>
              <Tag size="sm" colorScheme="green">
                <TagLabel>{metadata.creator}</TagLabel>
              </Tag>
            </Box>
          )}
        </Flex>
        
        {/* Traits/Attributes */}
        {Object.keys(traits).length > 0 && (
          <Box>
            <Text fontSize="sm" fontWeight="bold" color={labelColor} mb={2}>
              Traits
            </Text>
            <SimpleGrid columns={isModal ? 2 : 1} spacing={2}>
              {Object.entries(traits)
                .filter(([key]) => !['Series', 'Seed', 'Token ID'].includes(key))
                .map(([key, value]) => (
                  <Box key={key} p={2} borderWidth="1px" borderRadius="md">
                    <Text fontSize="xs" color={labelColor}>{key}</Text>
                    <Text fontWeight="bold">{value}</Text>
                  </Box>
                ))
              }
            </SimpleGrid>
          </Box>
        )}
        
        {/* Token ID if present */}
        {traits['Token ID'] && !isModal && (
          <Box mt={2}>
            <Text fontSize="xs" color={labelColor} mb={1}>Token ID</Text>
            <Text fontSize="xs" fontFamily="monospace" wordBreak="break-all">
              {traits['Token ID']}
            </Text>
          </Box>
        )}
      </VStack>
    );
  };

  const renderRosenBridgeMetadata = () => {
    const data = metadata.data as Record<string, any>;
    return (
      <VStack align="stretch" spacing={3}>
        <Flex alignItems="center" mb={2}>
          <Badge colorScheme="purple" mr={2}>Rosen Bridge</Badge>
          <Text fontSize="sm" fontWeight="medium">Wrapped Token</Text>
        </Flex>
        
        <Box>
          <Text fontSize="sm" color={labelColor} mb={1}>Origin Network</Text>
          <Tag size="sm" bg={rosenBg} color={rosenColor}>
            <TagLabel>{data.originNetwork}</TagLabel>
          </Tag>
        </Box>
        
        <Box>
          <Text fontSize="sm" color={labelColor} mb={1}>Origin Token</Text>
          <Flex align="center">
            <AddressText 
              address={data.originToken}
              isTokenId={true}
              startChars={12}
              endChars={12}
              color={rosenColor}
              fontSize="sm"
            />
          </Flex>
        </Box>
        
        {data.isNativeToken !== undefined && (
          <Box>
            <Text fontSize="sm" color={labelColor} mb={1}>Native Token</Text>
            <Tag size="sm" bg={rosenBg} color={rosenColor}>
              <TagLabel>{data.isNativeToken ? 'Yes' : 'No'}</TagLabel>
            </Tag>
          </Box>
        )}
        
        {Object.entries(data)
          .filter(([key]) => !['title', 'originNetwork', 'originToken', 'isNativeToken'].includes(key))
          .map(([key, value]) => (
            <React.Fragment key={key}>
              {renderMetadataField(key, value, true)}
            </React.Fragment>
          ))}
      </VStack>
    );
  };

  const renderMetadata = () => {
    // Special handling for 721 format
    if (metadata.type === '721') {
      return render721Metadata();
    }
    
    // Special handling for Rosen Bridge format
    if (metadata.type === 'rosenBridge') {
      return renderRosenBridgeMetadata();
    }
    
    // Handle traits if present
    if (metadata.traits) {
      return (
        <VStack align="stretch" spacing={3}>
          <Box>
            <Text fontSize="sm" color={labelColor} mb={2}>
              Traits
            </Text>
            <VStack align="stretch" spacing={2}>
              {Object.entries(metadata.traits).map(([key, value]) => (
                <Box key={key}>
                  <Text fontSize="sm" fontWeight="medium" mb={1}>
                    {key}
                  </Text>
                  <Tag size="sm" bg={badgeBg} color={badgeColor}>
                    <TagLabel>{value}</TagLabel>
                  </Tag>
                </Box>
              ))}
            </VStack>
          </Box>
          <Divider borderColor={dividerColor} />
        </VStack>
      );
    }

    if (metadata.type === 'list') {
      const items = metadata.data as string[];
      return (
        <VStack align="stretch" spacing={2}>
          {items.map((item, index) => (
            <Box key={index}>
              <Tag size="sm" bg={badgeBg} color={badgeColor}>
                <TagLabel>{renderValue(item)}</TagLabel>
              </Tag>
              {index < items.length - 1 && (
                <Divider borderColor={dividerColor} my={2} />
              )}
            </Box>
          ))}
        </VStack>
      );
    }

    const data = metadata.data as Record<string, any>;
    const entries = Object.entries(data);
    
    // Sort entries to put important fields first
    const sortedEntries = entries.sort(([keyA], [keyB]) => {
      const priorityFields = ['title', 'name', 'description', 'image', 'type', 'version'];
      const indexA = priorityFields.indexOf(keyA.toLowerCase());
      const indexB = priorityFields.indexOf(keyB.toLowerCase());
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
    
    return (
      <VStack align="stretch" spacing={3}>
        {sortedEntries.map(([key, value], index) => (
          <React.Fragment key={key}>
            {renderMetadataField(key, value)}
            {index < sortedEntries.length - 1 && (
              <Divider borderColor={dividerColor} />
            )}
          </React.Fragment>
        ))}
      </VStack>
    );
  };

  return (
    <Box
      p={isModal ? 4 : 2}
      bg={useColorModeValue('gray.50', 'gray.900')}
      borderRadius="md"
      fontSize="sm"
      maxH={isModal ? "none" : "200px"}
      overflowY="auto"
    >
      {renderMetadata()}
    </Box>
  );
}; 