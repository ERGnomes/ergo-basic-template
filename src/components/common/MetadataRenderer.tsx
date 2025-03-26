import React from 'react';
import {
  VStack,
  Badge,
  Box,
  Text,
  Wrap,
  WrapItem,
  Flex,
  useColorModeValue
} from '@chakra-ui/react';
import { shortenAddress } from '../../utils/textFormat';
import { Metadata721 } from '../../utils/metadata';

interface MetadataRendererProps {
  metadata: Metadata721;
  isModal?: boolean;
}

/**
 * Component to render 721 metadata as chips and formatted text
 */
export const MetadataRenderer: React.FC<MetadataRendererProps> = ({ 
  metadata, 
  isModal = false 
}) => {
  const trait721Bg = useColorModeValue('blue.50', 'blue.900');
  
  return (
    <VStack align="stretch" width="100%" spacing={isModal ? 2 : 1} mt={isModal ? 4 : 2}>
      {/* Project/Collection */}
      {metadata.project && (
        <Badge 
          colorScheme="purple" 
          alignSelf="center" 
          fontSize={isModal ? "sm" : "xs"} 
          mb={1}
        >
          {metadata.project}
        </Badge>
      )}
      
      {/* Series/Identifier */}
      {metadata.series && (
        <Badge 
          colorScheme="blue" 
          alignSelf="center" 
          fontSize={isModal ? "sm" : "xs"} 
          mb={1}
        >
          Series: {metadata.series}
        </Badge>
      )}
      
      {/* Traits as chips */}
      {metadata.traits && (
        <Box>
          <Text 
            fontSize={isModal ? "sm" : "xs"} 
            fontWeight="bold" 
            color="gray.500" 
            mb={1} 
            textTransform="uppercase"
          >
            Traits
          </Text>
          <Wrap spacing={isModal ? 2 : 1}>
            {Object.entries(metadata.traits).map(([trait, value], index) => (
              <WrapItem key={index}>
                <Badge 
                  bg={trait721Bg} 
                  px={isModal ? 2 : 1} 
                  py={isModal ? 1 : 0.5} 
                  borderRadius="md"
                  fontSize={isModal ? "sm" : "xs"}
                  display="flex"
                  flexDirection="column"
                  alignItems="center"
                >
                  <Text fontWeight="bold" fontSize={isModal ? "xs" : "10px"} color="gray.500">{trait}</Text>
                  <Text>{String(value)}</Text>
                </Badge>
              </WrapItem>
            ))}
          </Wrap>
        </Box>
      )}
      
      {/* Creator */}
      {metadata.creator && (isModal || !metadata.traits) && (
        <Flex align="center" fontSize={isModal ? "sm" : "xs"} color="gray.500">
          <Text fontWeight="bold" mr={1}>Creator:</Text>
          <Text isTruncated>{shortenAddress(metadata.creator, isModal ? 12 : 8)}</Text>
        </Flex>
      )}
      
      {/* Other metadata fields - only show in modal */}
      {isModal && Object.entries(metadata).map(([key, value]) => {
        // Skip fields we've already rendered
        if (['project', 'series', 'traits', 'creator', 'name'].includes(key)) return null;
        
        return (
          <Flex key={key} justify="space-between" fontSize="sm">
            <Text fontWeight="bold" textTransform="capitalize">{key}:</Text>
            <Text>{String(value)}</Text>
          </Flex>
        );
      })}
    </VStack>
  );
}; 