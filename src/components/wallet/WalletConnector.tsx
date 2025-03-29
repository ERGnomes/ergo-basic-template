import React, { forwardRef, useImperativeHandle } from 'react';
import {
  Button,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Icon,
  Flex,
  Text,
  VStack,
  Image,
  Switch,
  useDisclosure,
  useColorMode,
  Center,
} from "@chakra-ui/react";
import { FaWallet, FaChevronDown } from 'react-icons/fa';
import { 
  formatTokenAmount
} from '../../utils/ergo';
import { useWallet } from '../../context/WalletContext';

export interface WalletData {
  isConnected: boolean;
  ergBalance: string;
  tokens: any[];
  walletStatus: string;
}

export const WalletConnector = forwardRef<() => void, {}>((props, ref) => {
  const { walletData, connectToWallet, disconnectFromWallet, autoConnectEnabled, setAutoConnect } = useWallet();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isConnected, ergBalance, tokens = [], walletStatus } = walletData;
  const { colorMode } = useColorMode();
  
  useImperativeHandle(ref, () => connectToWallet);

  return (
    <Menu isOpen={isOpen} onOpen={onOpen} onClose={onClose}>
      <MenuButton
        as={Button}
        rightIcon={<Icon as={FaChevronDown} />}
        variant="outline"
        borderWidth="2px"
        borderColor={colorMode === 'light' ? 'ergnome.blueAccent.light' : 'ergnome.blue'}
        bg={isConnected ? 'transparent' : 'transparent'}
        _hover={{ bg: 'rgba(65, 157, 217, 0.1)' }}
        _active={{ bg: 'rgba(65, 157, 217, 0.2)' }}
        h="40px"
        px={3}
      >
        <Flex align="center">
          <Icon as={FaWallet} mr={2} color={isConnected ? (colorMode === 'light' ? 'ergnome.greenAccent.light' : 'ergnome.green') : (colorMode === 'light' ? 'ergnome.redAccent.light' : 'ergnome.red')} />
          <Text>{isConnected ? `${formatTokenAmount(ergBalance)} ERG` : 'Connect Wallet'}</Text>
        </Flex>
      </MenuButton>
      <MenuList zIndex={2} minW="280px" width="280px" p={1}>
        {!isConnected ? (
          <>
            <MenuItem onClick={connectToWallet} icon={<Icon as={FaWallet} color={colorMode === 'light' ? 'ergnome.blueAccent.light' : 'ergnome.blue'} />}>
              Connect to Wallet
            </MenuItem>
            <MenuItem onClick={() => setAutoConnect(!autoConnectEnabled)}>
              <Flex align="center" justify="space-between" w="100%">
                <Text>Auto-connect on startup</Text>
                <Switch 
                  isChecked={autoConnectEnabled} 
                  onChange={(e) => setAutoConnect(e.target.checked)}
                  colorScheme="blue"
                />
              </Flex>
            </MenuItem>
          </>
        ) : (
          <>
            <MenuItem closeOnSelect={false} px={4}>
              <Flex align="center" justify="space-between" w="100%">
                <Text fontWeight="bold">Status:</Text>
                <Text color={colorMode === 'light' ? 'ergnome.greenAccent.light' : 'ergnome.green'}>{walletStatus}</Text>
              </Flex>
            </MenuItem>
            <MenuItem closeOnSelect={false} px={4}>
              <Flex align="center" justify="space-between" w="100%">
                <Text fontWeight="bold">ERG Balance:</Text>
                <Text color={colorMode === 'light' ? 'ergnome.yellowAccent.light' : 'ergnome.yellow'}>{ergBalance} ERG</Text>
              </Flex>
            </MenuItem>
            <MenuItem closeOnSelect={false} px={4}>
              <Flex align="center" justify="space-between" w="100%">
                <Text>Auto-connect on startup</Text>
                <Switch 
                  isChecked={autoConnectEnabled} 
                  onChange={(e) => setAutoConnect(e.target.checked)}
                  colorScheme="blue"
                />
              </Flex>
            </MenuItem>
            {tokens.length > 0 && (
              <MenuItem closeOnSelect={false} px={4} h="auto">
                <VStack align="stretch" spacing={3} w="100%">
                  <Text fontWeight="bold" color={colorMode === 'light' ? 'ergnome.purpleAccent.light' : 'ergnome.purple'}>Your NFTs & Tokens:</Text>
                  
                  {tokens.slice(0, 5).map((token: any) => {
                    try {
                      // Process token name for display
                      let displayName = token.name || '';
                      let initials = displayName.substring(0, 3).toUpperCase();
                      
                      // Special handling for rosen bridge HOSKY token
                      if (displayName.toLowerCase().includes('rosen') && 
                          displayName.toLowerCase().includes('bridge') &&
                          displayName.toLowerCase().includes('hosky')) {
                        displayName = 'HOSKY';
                        initials = 'HSK';
                      }
                      
                      // Simplified approach - get image if available
                      const tokenImage = token.imageUrl || (token.metadata?.image || '');
                      const hasValidImage = !!tokenImage && typeof tokenImage === 'string' && tokenImage.trim() !== '';
                      
                      return (
                        <Flex key={token.tokenId} w="100%" align="center" gap={2} mb={2}>
                          {/* Use an image or a colored box with initials */}
                          {hasValidImage ? (
                            <Image 
                              src={tokenImage}
                              alt={displayName}
                              boxSize="24px"
                              borderRadius="sm"
                              objectFit="cover"
                              flexShrink={0}
                              onError={(e: any) => {
                                e.target.style.display = 'none';
                                e.target.nextElementSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          
                          {/* Always render the fallback box, but hide it if image loads */}
                          <Center 
                            boxSize="24px" 
                            borderRadius="sm" 
                            bg={`#${token.tokenId?.substring(0, 6) || '6247aa'}`}
                            color="white" 
                            fontSize="10px"
                            fontWeight="bold"
                            display={hasValidImage ? 'none' : 'flex'}
                            flexShrink={0}
                          >
                            {initials}
                          </Center>
                          
                          {/* Token Name */}
                          <Text 
                            fontSize="sm"
                            flex="1"
                            width="120px"
                            maxW="120px"
                            noOfLines={1}
                            isTruncated
                          >
                            {displayName}
                          </Text>
                          
                          {/* Token Amount */}
                          <Text 
                            fontSize="sm" 
                            color={colorMode === 'light' ? 'ergnome.orangeAccent.light' : 'ergnome.orange'} 
                            fontWeight="bold"
                            overflow="hidden"
                            textOverflow="ellipsis"
                            whiteSpace="nowrap"
                            textAlign="right"
                            flexShrink={0}
                            minW="60px"
                          >
                            {formatTokenAmount(token.amount, token.decimals)}
                          </Text>
                        </Flex>
                      );
                    } catch (error) {
                      // Fallback for any errors
                      return (
                        <Flex key={token.tokenId || Math.random()} w="100%" align="center" gap={2} mb={2}>
                          <Center 
                            boxSize="24px" 
                            borderRadius="sm" 
                            bg="gray.500"
                            color="white" 
                            fontSize="10px"
                            fontWeight="bold"
                          >
                            ???
                          </Center>
                          <Text 
                            fontSize="sm"
                            flex="1"
                            width="120px"
                            maxW="120px"
                            noOfLines={1}
                            isTruncated
                          >
                            {token.name || 'Unknown Token'}
                          </Text>
                          <Text 
                            fontSize="sm" 
                            color={colorMode === 'light' ? 'ergnome.orangeAccent.light' : 'ergnome.orange'} 
                            fontWeight="bold"
                            overflow="hidden"
                            textOverflow="ellipsis"
                            whiteSpace="nowrap"
                            textAlign="right"
                            flexShrink={0}
                            minW="60px"
                          >
                            {formatTokenAmount(token.amount, token.decimals)}
                          </Text>
                        </Flex>
                      );
                    }
                  })}
                  
                  {tokens.length > 5 && (
                    <Text fontSize="sm" color={colorMode === 'light' ? 'ergnome.blueAccent.light' : 'ergnome.blue'} textAlign="center">
                      +{tokens.length - 5} more tokens
                    </Text>
                  )}
                </VStack>
              </MenuItem>
            )}
            <MenuItem onClick={disconnectFromWallet} closeOnSelect={true} px={4}>
              Disconnect Wallet
            </MenuItem>
          </>
        )}
      </MenuList>
    </Menu>
  );
}); 