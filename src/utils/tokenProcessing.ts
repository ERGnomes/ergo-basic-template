import { TokenData } from '../components/common/TokenCard';
import { parseMetadata, TokenMetadata, MetadataOptions } from './metadata';
import { isUrl } from './textFormat';

// Token types for better categorization
export enum TokenType {
  NFT = 'nft',
  FUNGIBLE = 'fungible',
  UNKNOWN = 'unknown'
}

// Processing options to customize token handling
export interface TokenProcessingOptions {
  metadataOptions?: MetadataOptions;
  includeRawData?: boolean;
  detectCollections?: boolean;
  generatePlaceholderImage?: boolean;
}

/**
 * Determines if a token is likely an NFT based on amount and metadata
 * @param token Raw token data
 * @returns Boolean indicating if token appears to be an NFT
 */
export const isNFT = (token: any): boolean => {
  // Check if amount is 1
  const amount = typeof token.amount === 'string' 
    ? token.amount 
    : String(token.amount || '');
    
  // Most NFTs have amount of exactly 1
  if (amount !== '1') return false;
  
  // If it has image or description it's more likely to be an NFT
  if (token.imageUrl || token.image) return true;
  if (token.description && token.description.length > 0) return true;
  
  // If the token name includes '#' it's often an NFT from a collection
  if (token.name && token.name.includes('#')) return true;
  
  return false;
};

/**
 * Generates a placeholder image URL for tokens without images
 * @param token Token data
 * @returns URL for placeholder image
 */
export const generatePlaceholderImage = (token: any): string => {
  const hash = token.tokenId?.substring(0, 6) || 'ffffff';
  const name = encodeURIComponent(token.name || 'Unknown Token');
  return `https://via.placeholder.com/400/${hash}?text=${name}`;
};

/**
 * Processes raw token data into a standardized format
 * @param token Raw token data from the wallet
 * @param options Processing options
 * @returns Processed TokenData object
 */
export const processTokenData = (token: any, options: TokenProcessingOptions = {}): TokenData => {
  // Set default options
  const opts = {
    metadataOptions: options.metadataOptions || {},
    includeRawData: options.includeRawData || false,
    detectCollections: options.detectCollections || true,
    generatePlaceholderImage: options.generatePlaceholderImage || true,
  };

  // Extract basic token properties
  const tokenId = token.tokenId || token.id || '';
  let imageUrl = token.imageUrl || token.image || '';
  let description = token.description || '';
  let name = token.name || 'Unknown Token';
  let collection = token.collection || '';
  let attributes = [...(token.attributes || [])]; // Clone to avoid mutating the original
  let decimals = token.decimals || 0;
  let tokenType = TokenType.UNKNOWN;
  
  // Parse metadata from description or metadata property
  let parsedMetadata: TokenMetadata | null = null;
  
  // First try to use existing metadata object if present
  if (token.metadata && typeof token.metadata === 'object') {
    // Convert the metadata object to a string and parse it
    try {
      parsedMetadata = parseMetadata(JSON.stringify(token.metadata), opts.metadataOptions);
    } catch (e) {
      console.error('Error parsing token.metadata object:', e);
    }
  }
  
  // If no metadata found yet, try to parse from description
  if (!parsedMetadata && description) {
    try {
      parsedMetadata = parseMetadata(description, opts.metadataOptions);
    } catch (e) {
      console.error('Error parsing metadata from description:', e);
    }
  }
  
  // Update fields from metadata if available
  if (parsedMetadata) {
    // Only override if the metadata actually provides these fields
    if (parsedMetadata.name) name = parsedMetadata.name;
    if (parsedMetadata.description) description = parsedMetadata.description;
    if (parsedMetadata.image && isUrl(parsedMetadata.image)) {
      imageUrl = parsedMetadata.image;
    }
    if (parsedMetadata.collection) collection = parsedMetadata.collection;
    
    // Special collection handling for different metadata types
    if (parsedMetadata.type === 'rosenBridge' && !collection) {
      collection = 'Rosen Bridge Wrapped Tokens';
    }
    
    // Convert metadata traits to attributes for unified filtering
    if (parsedMetadata.traits && Object.keys(parsedMetadata.traits).length > 0) {
      // Track existing trait types to avoid duplicates
      const existingTraitTypes = new Set(
        attributes.map(attr => attr.trait_type.toLowerCase())
      );
      
      // Add traits from metadata that don't already exist in attributes
      Object.entries(parsedMetadata.traits).forEach(([trait_type, value]) => {
        const lowerTraitType = trait_type.toLowerCase();
        if (!existingTraitTypes.has(lowerTraitType)) {
          attributes.push({
            trait_type: trait_type,
            value: String(value)
          });
          existingTraitTypes.add(lowerTraitType);
        }
      });
    }
  }

  // If no image found in metadata, check if description is a URL
  if (!imageUrl && isUrl(description)) {
    imageUrl = description;
    description = '';
  }
  
  // Generate placeholder image if needed
  if (!imageUrl && opts.generatePlaceholderImage) {
    imageUrl = generatePlaceholderImage({tokenId, name});
  }
  
  // Detect collection from name if not already set
  if (!collection && opts.detectCollections && name.includes('#')) {
    collection = name.split('#')[0].trim();
  }
  
  // Determine token type
  tokenType = isNFT(token) ? TokenType.NFT : 
              (parseInt(token.amount || '0') > 1 ? TokenType.FUNGIBLE : TokenType.UNKNOWN);

  // Create standardized token data structure
  const tokenData: TokenData = {
    tokenId,
    name,
    description,
    imageUrl,
    amount: token.amount,
    decimals,
    collection,
    attributes,
    tokenType,
    metadata: parsedMetadata || undefined
  };
  
  // Include raw data if requested
  if (opts.includeRawData) {
    tokenData.rawData = token;
  }
  
  return tokenData;
};

/**
 * Processes an array of tokens
 * @param tokens Array of raw token data
 * @param options Processing options
 * @returns Array of processed TokenData objects
 */
export const processTokens = (tokens: any[], options: TokenProcessingOptions = {}): TokenData[] => {
  return tokens.map(token => processTokenData(token, options));
};

/**
 * Filters tokens to return only NFTs
 * @param tokens Array of processed token data
 * @returns Array containing only NFT tokens
 */
export const filterNFTs = (tokens: TokenData[]): TokenData[] => {
  return tokens.filter(token => token.tokenType === TokenType.NFT);
};

/**
 * Filters tokens to return only fungible tokens
 * @param tokens Array of processed token data
 * @returns Array containing only fungible tokens
 */
export const filterFungibleTokens = (tokens: TokenData[]): TokenData[] => {
  return tokens.filter(token => token.tokenType === TokenType.FUNGIBLE);
};

/**
 * Groups tokens by collection
 * @param tokens Array of processed token data
 * @returns Object with collection names as keys and arrays of tokens as values
 */
export const groupByCollection = (tokens: TokenData[]): Record<string, TokenData[]> => {
  return tokens.reduce((groups: Record<string, TokenData[]>, token) => {
    const collection = token.collection || 'Uncategorized';
    if (!groups[collection]) {
      groups[collection] = [];
    }
    groups[collection].push(token);
    return groups;
  }, {});
}; 