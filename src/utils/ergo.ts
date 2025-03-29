/**
 * Ergo Utility Functions
 * These functions provide common functionality for working with the Ergo blockchain
 * and can be reused across different components.
 */

import { isValidJson } from './textFormat';

// Add TypeScript declarations for the Ergo wallet
declare global {
  interface Window {
    ergoConnector: any;
    ergo: any;
  }
}

// Format a token amount based on its decimals
export const formatTokenAmount = (amount: number | string | undefined, decimals: number = 0): string => {
  if (amount === undefined || amount === null) return '0';
  
  try {
    const amountNum = typeof amount === 'string' ? parseInt(amount) : amount;
    
    if (isNaN(amountNum)) return '0';
    
    if (decimals === 0) return amountNum.toString();
    const factor = Math.pow(10, decimals);
    return (amountNum / factor).toFixed(decimals);
  } catch (error) {
    console.error('Error formatting token amount:', error);
    return '0';
  }
};

// Format an ERG amount from nanoERG
export const formatErgAmount = (nanoErgs: number | string): string => {
  const amountNum = typeof nanoErgs === 'string' ? parseInt(nanoErgs) : nanoErgs;
  return (amountNum / 1000000000).toFixed(4);
};

// Shorten a token ID for display purposes
export const shortenTokenId = (tokenId: string, startLength: number = 8, endLength: number = 8): string => {
  if (!tokenId || tokenId.length <= startLength + endLength + 3) return tokenId;
  return `${tokenId.substring(0, startLength)}...${tokenId.substring(tokenId.length - endLength)}`;
};

// Check if wallet is connected
export const isWalletConnected = async (): Promise<boolean> => {
  console.log('Checking if wallet is connected, ergoConnector present:', !!window.ergoConnector);
  if (!window.ergoConnector) return false;
  try {
    const connected = await window.ergoConnector.nautilus.isConnected();
    console.log('Wallet connection status check returned:', connected);
    return connected;
  } catch (error) {
    console.error('Error checking wallet connection status:', error);
    return false;
  }
};

// Connect to wallet
export const connectWallet = async (): Promise<boolean> => {
  console.log('Attempting to connect wallet, ergoConnector present:', !!window.ergoConnector);
  if (!window.ergoConnector) {
    console.error('Nautilus wallet not found. Please install the extension.');
    return false;
  }
  
  try {
    // Explicitly check if already connected first
    console.log('Checking if already connected...');
    const isConnected = await window.ergoConnector.nautilus.isConnected();
    console.log('Already connected check result:', isConnected);
    
    // If already connected, just reinitialize the context
    if (isConnected) {
      console.log('Wallet already connected, getting context...');
      window.ergo = await window.ergoConnector.nautilus.getContext();
      console.log('Context retrieved successfully:', !!window.ergo);
      return true;
    }
    
    // Attempt to connect if not already connected
    console.log('Not connected, attempting to connect...');
    const connected = await window.ergoConnector.nautilus.connect();
    console.log('Connect attempt result:', connected);
    
    // Initialize window.ergo for dApp API
    if (connected) {
      console.log('Getting context after successful connection...');
      try {
        window.ergo = await window.ergoConnector.nautilus.getContext();
        console.log('Context retrieved successfully after connection:', !!window.ergo);
      } catch (contextError) {
        console.error('Error getting context after connection:', contextError);
      }
    }
    
    return connected;
  } catch (e) {
    console.error('Error connecting to wallet:', e);
    return false;
  }
};

// Disconnect from wallet
export const disconnectWallet = async (): Promise<void> => {
  if (!window.ergoConnector) return;
  try {
    await window.ergoConnector.nautilus.disconnect();
    // Clear the ergo context
    window.ergo = undefined;
  } catch (e) {
    console.error('Error disconnecting wallet:', e);
  }
};

// Get all tokens from UTXOs
export const getTokensFromUtxos = async (utxos: any[]): Promise<any[]> => {
  console.log('getTokensFromUtxos called with UTXOs:', utxos ? utxos.length : 'null');
  if (!utxos || !utxos.length) return [];
  
  // Create a map to aggregate tokens with the same ID
  const tokenMap = new Map();
  
  // First pass: Collect basic token info from UTXOs
  try {
    console.log('Processing UTXOs to extract token data...');
    let totalAssets = 0;
    utxos.forEach((utxo, index) => {
      if (utxo.assets && utxo.assets.length) {
        totalAssets += utxo.assets.length;
        utxo.assets.forEach((asset: any) => {
          const existingToken = tokenMap.get(asset.tokenId);
          if (existingToken) {
            // Add to existing amount
            existingToken.amount = (
              BigInt(existingToken.amount) + BigInt(asset.amount)
            ).toString();
          } else {
            // Add new token
            tokenMap.set(asset.tokenId, {
              tokenId: asset.tokenId,
              amount: asset.amount,
              name: asset.name || 'Unknown Token',
              decimals: asset.decimals || 0,
              description: '',
              imageUrl: ''
            });
          }
        });
      }
    });
    console.log(`Processed ${utxos.length} UTXOs with ${totalAssets} total assets, found ${tokenMap.size} unique tokens`);
  } catch (error) {
    console.error('Error during first pass token processing:', error);
    return [];
  }
  
  // Second pass: Fetch additional metadata for each token
  try {
    const tokenIds = Array.from(tokenMap.keys());
    console.log(`Starting metadata retrieval for ${tokenIds.length} tokens...`);
    
    const tokenInfoPromises = tokenIds.map(async (tokenId, index) => {
      try {
        console.log(`Fetching info for token ${index + 1}/${tokenIds.length}: ${tokenId.substring(0, 8)}...`);
        // Fetch basic token info from v1 API
        const tokenInfo = await fetch(`https://api.ergoplatform.com/api/v1/tokens/${tokenId}`).then(r => r.json());
        
        const token = tokenMap.get(tokenId);
        
        // Update token with additional info
        if (tokenInfo) {
          token.name = tokenInfo.name || token.name;
          token.decimals = tokenInfo.decimals ?? token.decimals;
          token.description = tokenInfo.description || '';
          
          // For tokens with amount = 1 (likely NFTs), fetch image data
          if (token.amount === "1") {
            console.log(`Token ${tokenId.substring(0, 8)}... appears to be an NFT, fetching metadata...`);
            try {
              // Try to get the issuing box with full metadata
              const issuingBoxResponse = await fetch(`https://api.ergoplatform.com/api/v0/assets/${tokenId}/issuingBox`).then(r => r.json());
              
              if (issuingBoxResponse && issuingBoxResponse[0]) {
                const issuingBox = issuingBoxResponse[0];
                const additionalRegisters = issuingBox.additionalRegisters || {};
                
                // Extract image URL from R9 (often contains IPFS or HTTP URL)
                if (additionalRegisters.R9) {
                  const imageUrl = toUtf8String(additionalRegisters.R9).substr(2);
                  token.imageUrl = resolveIpfs(imageUrl);
                  console.log(`Found image URL for ${tokenId.substring(0, 8)}...`);
                }
                
                // Extract additional metadata from R5
                if (additionalRegisters.R5) {
                  try {
                    const metadataString = toUtf8String(additionalRegisters.R5).substr(2);
                    console.log(`Checking R5 metadata for ${tokenId.substring(0, 8)}...`, metadataString.substring(0, 50) + '...');
                    if (isValidJson(metadataString)) {
                      console.log(`Valid JSON found in R5 for ${tokenId.substring(0, 8)}...`);
                      const metadata = JSON.parse(metadataString);
                      if (metadata.name) token.name = metadata.name;
                      if (metadata.description) token.description = metadata.description;
                      if (metadata.collection) token.collection = metadata.collection;
                    }
                  } catch (e) {
                    console.error(`Error parsing R5 metadata for token ${tokenId.substring(0, 8)}...`, e);
                  }
                }
              }
            } catch (e) {
              console.error(`Error fetching NFT metadata for token ${tokenId.substring(0, 8)}...`, e);
            }
          }
        }
        
        return token;
      } catch (error) {
        console.error(`Error fetching token info for ${tokenId.substring(0, 8)}...`, error);
        return tokenMap.get(tokenId);
      }
    });
    
    // Wait for all token info to be fetched
    console.log('Waiting for all token metadata to be fetched...');
    const tokens = await Promise.all(tokenInfoPromises);
    console.log(`Successfully retrieved metadata for ${tokens.length} tokens`);
    
    return tokens;
  } catch (error) {
    console.error('Error during token metadata retrieval:', error);
    // If metadata fetching fails, return the basic token data
    return Array.from(tokenMap.values());
  }
};

// Function to get all NFTs from wallet
export const getWalletNFTs = async (): Promise<any[]> => {
  try {
    if (!window.ergoConnector) return [];
    
    const connected = await window.ergoConnector.nautilus.isConnected();
    if (!connected) return [];
    
    // Make sure ergo context is initialized
    if (!window.ergo) {
      window.ergo = await window.ergoConnector.nautilus.getContext();
    }
    
    // Get UTXOs from wallet
    const utxos = await window.ergo.get_utxos();
    
    // Extract NFTs (tokens with quantity = 1)
    const nftTokenIds: string[] = [];
    utxos.forEach((utxo: any) => {
      utxo.assets?.forEach((asset: any) => {
        // Most NFTs have a quantity of 1
        if (asset.amount === "1") {
          nftTokenIds.push(asset.tokenId);
        }
      });
    });
    
    // Fetch metadata for each NFT
    const nftsWithMetadata = await Promise.all(
      nftTokenIds.map(tokenId => fetchNFTMetadata(tokenId))
    );
    
    return nftsWithMetadata.filter(Boolean); // Remove any null results
  } catch (error) {
    console.error('Error getting wallet NFTs:', error);
    return [];
  }
};

// Function to fetch NFT metadata
export const fetchNFTMetadata = async (tokenId: string): Promise<any> => {
  try {
    // First get basic token info
    const tokenInfo = await fetch(`https://api.ergoplatform.com/api/v1/tokens/${tokenId}`).then(r => r.json());
    
    // Then get the issuing box which contains the full metadata
    const issuingBoxResponse = await fetch(`https://api.ergoplatform.com/api/v0/assets/${tokenId}/issuingBox`).then(r => r.json());
    
    if (!issuingBoxResponse || !issuingBoxResponse[0]) {
      console.error('Could not fetch issuing box for token', tokenId);
      return null;
    }

    const issuingBox = issuingBoxResponse[0];
    const additionalRegisters = issuingBox.additionalRegisters || {};
    
    // Convert hex to UTF8 string for various registers
    const name = tokenInfo.name || 'Unknown NFT';
    const description = tokenInfo.description || '';
    
    // Default object structure
    const nftData = {
      tokenId: tokenId,
      name: name,
      description: description,
      imageUrl: '',
      collection: '',
      attributes: []
    };
    
    // Try to extract metadata from R5 (usually contains JSON metadata)
    if (additionalRegisters.R5) {
      try {
        // Convert hex to string, removing prefix bytes
        const metadataString = toUtf8String(additionalRegisters.R5).substr(2);
        
        // Check if the string is valid JSON
        if (isValidJson(metadataString)) {
          const metadata = JSON.parse(metadataString);
          
          // Update NFT data with extracted metadata
          if (metadata.name) nftData.name = metadata.name;
          if (metadata.description) nftData.description = metadata.description;
          
          // Handle collection names
          if (metadata.collection) {
            nftData.collection = metadata.collection;
          } else if (name.includes('#')) {
            // Extract collection name from pattern like "Collection Name #123"
            nftData.collection = name.split('#')[0].trim();
          }
          
          // Extract attributes/traits
          if (metadata.attributes || metadata.traits) {
            nftData.attributes = metadata.attributes || metadata.traits;
          }
        }
      } catch (e) {
        console.error('Error parsing metadata from R5:', e);
      }
    }
    
    // Extract image URL from R9 (often contains IPFS or HTTP URL to image)
    if (additionalRegisters.R9) {
      try {
        const imageUrl = toUtf8String(additionalRegisters.R9).substr(2);
        nftData.imageUrl = resolveIpfs(imageUrl);
      } catch (e) {
        console.error('Error extracting image URL from R9:', e);
      }
    }
    
    // If no image URL was found, generate a placeholder
    if (!nftData.imageUrl) {
      const hash = tokenId.substring(0, 6);
      nftData.imageUrl = `https://via.placeholder.com/400/${hash}?text=${encodeURIComponent(nftData.name)}`;
    }
    
    return nftData;
  } catch (error) {
    console.error('Error fetching NFT metadata:', error);
    return null;
  }
};

// Helper to convert hex to UTF8 string
function toUtf8String(hexString: string): string {
  try {
    console.log('Converting hex to UTF8:', hexString ? hexString.substring(0, 20) + '...' : 'null');
    
    // Use the original implementation which was working correctly
    if (!hexString) return '';
    let str = '';
    for (let i = 0; i < hexString.length; i += 2) {
      str += String.fromCharCode(parseInt(hexString.substr(i, 2), 16));
    }
    
    console.log('Conversion result length:', str.length);
    return str;
  } catch (error) {
    console.error('Error converting hex to UTF8:', error, 'Input:', hexString);
    return '';
  }
}

// Helper function to resolve IPFS URLs to HTTP URLs
function resolveIpfs(url: string): string {
  const ipfsPrefix = 'ipfs://';
  if (!url.startsWith(ipfsPrefix)) return url;
  return url.replace(ipfsPrefix, 'https://cloudflare-ipfs.com/ipfs/');
}

// Add this function to the file to check if a string contains 721 JSON metadata
/**
 * Checks if a string is a potential 721 JSON metadata
 * @param text The text to check
 * @returns True if the text appears to be 721 metadata
 */
export const is721Metadata = (text: string): boolean => {
  if (!text) return false;
  try {
    const trimmed = text.trim();
    // Look for {"721": at the start of the string
    if (!trimmed.startsWith('{"721":')) return false;
    
    const parsed = JSON.parse(trimmed);
    return parsed && parsed['721'] !== undefined;
  } catch (e) {
    return false;
  }
}; 