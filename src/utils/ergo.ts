/**
 * Ergo Utility Functions
 * These functions provide common functionality for working with the Ergo blockchain
 * and can be reused across different components.
 */

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
  if (!window.ergoConnector) return false;
  return await window.ergoConnector.nautilus.isConnected();
};

// Connect to wallet
export const connectWallet = async (): Promise<boolean> => {
  if (!window.ergoConnector) {
    console.error('Nautilus wallet not found. Please install the extension.');
    return false;
  }
  
  try {
    // Explicitly check if already connected first
    const isConnected = await window.ergoConnector.nautilus.isConnected();
    
    // If already connected, just reinitialize the context
    if (isConnected) {
      window.ergo = await window.ergoConnector.nautilus.getContext();
      return true;
    }
    
    // Attempt to connect if not already connected
    const connected = await window.ergoConnector.nautilus.connect();
    
    // Initialize window.ergo for dApp API
    if (connected) {
      window.ergo = await window.ergoConnector.nautilus.getContext();
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
  if (!utxos || !utxos.length) return [];
  
  // Create a map to aggregate tokens with the same ID
  const tokenMap = new Map();
  
  // First pass: Collect basic token info from UTXOs
  utxos.forEach(utxo => {
    if (utxo.assets) {
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
  
  // Second pass: Fetch additional metadata for each token
  const tokenIds = Array.from(tokenMap.keys());
  const tokenInfoPromises = tokenIds.map(async (tokenId) => {
    try {
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
              }
              
              // Extract additional metadata from R5
              if (additionalRegisters.R5) {
                try {
                  const metadataString = toUtf8String(additionalRegisters.R5).substr(2);
                  if (isValidJson(metadataString)) {
                    const metadata = JSON.parse(metadataString);
                    if (metadata.name) token.name = metadata.name;
                    if (metadata.description) token.description = metadata.description;
                    if (metadata.collection) token.collection = metadata.collection;
                  }
                } catch (e) {
                  console.error('Error parsing R5 metadata for token', tokenId, e);
                }
              }
            }
          } catch (e) {
            console.error('Error fetching NFT metadata for token', tokenId, e);
          }
        }
      }
      
      return token;
    } catch (error) {
      console.error('Error fetching token info for', tokenId, error);
      return tokenMap.get(tokenId);
    }
  });
  
  // Wait for all token info to be fetched
  const tokens = await Promise.all(tokenInfoPromises);
  
  return tokens;
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

// Helper function to convert hex to UTF8 string
function toUtf8String(hex: string): string {
  if (!hex) return '';
  let str = '';
  for (let i = 0; i < hex.length; i += 2) {
    str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
  }
  return str;
}

// Helper function to resolve IPFS URLs to HTTP URLs
function resolveIpfs(url: string): string {
  const ipfsPrefix = 'ipfs://';
  if (!url.startsWith(ipfsPrefix)) return url;
  return url.replace(ipfsPrefix, 'https://cloudflare-ipfs.com/ipfs/');
}

// Helper function to check if a string is valid JSON
function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
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