import { TokenData } from '../components/common/TokenCard';

/**
 * Interface for collection information
 */
export interface Collection {
  id: string;
  name: string;
  description?: string;
  creator?: string;
  contractAddress?: string;
  tokenPrefix?: string;
  verified?: boolean;
}

/**
 * Interface for author information
 */
export interface Author {
  id: string;
  name: string;
  address: string;
  verified?: boolean;
}

/**
 * Interface for contract information
 */
export interface Contract {
  id: string;
  name: string;
  address: string;
  description?: string;
  purpose?: string;
  verified?: boolean;
}

/**
 * Filter tokens by collection ID
 * @param tokens Array of token data
 * @param collectionId ID of the collection to filter by
 * @returns Filtered array of tokens
 */
export const filterByCollection = (tokens: TokenData[], collectionId: string): TokenData[] => {
  return tokens.filter(token => 
    token.collection && token.collection.toLowerCase() === collectionId.toLowerCase()
  );
};

/**
 * Filter tokens by creator/author
 * @param tokens Array of token data
 * @param author Author identifier (name or address)
 * @returns Filtered array of tokens
 */
export const filterByAuthor = (tokens: TokenData[], author: string): TokenData[] => {
  const lowerAuthor = author.toLowerCase();
  return tokens.filter(token => {
    // Check metadata for creator/author fields
    if (token.metadata) {
      const creator = token.metadata.creator?.toLowerCase();
      return creator === lowerAuthor;
    }
    // Check if creator is in raw data
    if (token.rawData && token.rawData.creator) {
      return token.rawData.creator.toLowerCase() === lowerAuthor;
    }
    return false;
  });
};

/**
 * Filter tokens by contract address
 * @param tokens Array of token data
 * @param contractAddress Contract address to filter by
 * @returns Filtered array of tokens
 */
export const filterByContract = (tokens: TokenData[], contractAddress: string): TokenData[] => {
  return tokens.filter(token => {
    if (token.rawData && token.rawData.contractAddress) {
      return token.rawData.contractAddress === contractAddress;
    }
    return false;
  });
};

/**
 * Filter tokens by name search
 * @param tokens Array of token data
 * @param searchTerm Search term to filter by
 * @returns Filtered array of tokens
 */
export const filterByName = (tokens: TokenData[], searchTerm: string): TokenData[] => {
  const lowerSearchTerm = searchTerm.toLowerCase();
  return tokens.filter(token => 
    token.name.toLowerCase().includes(lowerSearchTerm)
  );
};

/**
 * Filter tokens by trait values
 * @param tokens Array of token data
 * @param traits Object with trait_type and value pairs to filter by
 * @returns Filtered array of tokens
 */
export const filterByTraits = (
  tokens: TokenData[], 
  traits: {[trait: string]: string}
): TokenData[] => {
  return tokens.filter(token => {
    // If there are no attributes and no metadata traits, return false
    if ((!token.attributes || token.attributes.length === 0) && 
        (!token.metadata?.traits || Object.keys(token.metadata.traits).length === 0)) {
      return false;
    }
    
    // Check if we match all required trait conditions
    return Object.entries(traits).every(([traitType, value]) => {
      const lowerTraitType = traitType.toLowerCase();
      const lowerValue = value.toLowerCase();
      
      // Check in attributes array first
      if (token.attributes && token.attributes.length > 0) {
        const attributeMatch = token.attributes.some(attr => 
          attr.trait_type.toLowerCase() === lowerTraitType && 
          attr.value.toLowerCase() === lowerValue
        );
        if (attributeMatch) return true;
      }
      
      // Check in metadata.traits if no match was found in attributes
      if (token.metadata?.traits) {
        const metadataTraitKeys = Object.keys(token.metadata.traits);
        const matchingKey = metadataTraitKeys.find(key => key.toLowerCase() === lowerTraitType);
        
        if (matchingKey) {
          const traitValue = String(token.metadata.traits[matchingKey]).toLowerCase();
          return traitValue === lowerValue;
        }
      }
      
      // No match found for this trait
      return false;
    });
  });
};

/**
 * Advanced token filtering with multiple criteria
 * @param tokens Array of token data
 * @param filters Object with filter criteria
 * @returns Filtered array of tokens
 */
export const advancedFilter = (
  tokens: TokenData[], 
  filters: {
    collections?: string[];
    authors?: string[];
    contracts?: string[];
    searchTerm?: string;
    traits?: {[trait: string]: string};
  }
): TokenData[] => {
  let filteredTokens = [...tokens];
  
  // Apply collection filter
  if (filters.collections && filters.collections.length > 0) {
    filteredTokens = filteredTokens.filter(token => 
      token.collection && filters.collections?.includes(token.collection)
    );
  }
  
  // Apply author filter
  if (filters.authors && filters.authors.length > 0) {
    filteredTokens = filteredTokens.filter(token => {
      const creator = token.metadata?.creator || token.rawData?.creator;
      return creator && filters.authors?.includes(creator);
    });
  }
  
  // Apply contract filter
  if (filters.contracts && filters.contracts.length > 0) {
    filteredTokens = filteredTokens.filter(token => {
      const contractAddress = token.rawData?.contractAddress;
      return contractAddress && filters.contracts?.includes(contractAddress);
    });
  }
  
  // Apply search term filter
  if (filters.searchTerm) {
    const lowerSearchTerm = filters.searchTerm.toLowerCase();
    filteredTokens = filteredTokens.filter(token => 
      token.name.toLowerCase().includes(lowerSearchTerm) ||
      token.description.toLowerCase().includes(lowerSearchTerm)
    );
  }
  
  // Apply traits filter
  if (filters.traits && Object.keys(filters.traits).length > 0) {
    filteredTokens = filterByTraits(filteredTokens, filters.traits);
  }
  
  return filteredTokens;
};

/**
 * Whitelist validation for contracts
 * @param contractAddress Contract address to validate
 * @param whitelist List of allowed contract addresses
 * @returns Boolean indicating if contract is whitelisted
 */
export const isContractWhitelisted = (
  contractAddress: string, 
  whitelist: string[]
): boolean => {
  return whitelist.includes(contractAddress);
};

/**
 * Get unique trait types from a collection of tokens
 * @param tokens Array of token data
 * @returns Array of unique trait type names
 */
export const getUniqueTraitTypes = (tokens: TokenData[]): string[] => {
  const traitTypes = new Set<string>();
  
  tokens.forEach(token => {
    // Extract from attributes array
    if (token.attributes) {
      token.attributes.forEach(attr => {
        traitTypes.add(attr.trait_type);
      });
    }
    
    // Extract from metadata.traits object
    if (token.metadata?.traits) {
      Object.keys(token.metadata.traits).forEach(traitKey => {
        traitTypes.add(traitKey);
      });
    }
  });
  
  return Array.from(traitTypes);
};

/**
 * Get all values for a specific trait type
 * @param tokens Array of token data
 * @param traitType Trait type to get values for
 * @returns Array of unique values for the trait type
 */
export const getTraitValues = (tokens: TokenData[], traitType: string): string[] => {
  const values = new Set<string>();
  const lowerTraitType = traitType.toLowerCase();
  
  tokens.forEach(token => {
    // Check in attributes array
    if (token.attributes) {
      token.attributes.forEach(attr => {
        if (attr.trait_type.toLowerCase() === lowerTraitType) {
          values.add(String(attr.value));
        }
      });
    }
    
    // Check in metadata.traits object (case insensitive)
    if (token.metadata?.traits) {
      const metadataTraitKey = Object.keys(token.metadata.traits).find(
        key => key.toLowerCase() === lowerTraitType
      );
      
      if (metadataTraitKey && token.metadata.traits[metadataTraitKey] !== undefined) {
        values.add(String(token.metadata.traits[metadataTraitKey]));
      }
    }
  });
  
  return Array.from(values);
}; 