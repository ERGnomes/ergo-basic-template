// Type for parsed 721 metadata
export interface Metadata721 {
  project?: string;
  name?: string;
  traits: Record<string, string>;
  series?: string;
  seed?: string;
  creator?: string;
  [key: string]: any;
}

/**
 * Standard metadata interface used across the application
 * This unified format ensures consistent handling of token metadata
 */
export interface TokenMetadata {
  type: 'json' | '721' | 'list' | 'ergo' | 'rosenBridge' | 'unknown';
  data: Record<string, any> | string[];
  image?: string;
  name?: string;
  description?: string;
  traits?: Record<string, string>;
  collection?: string;
  creator?: string;
  royalty?: string;
  standard?: string;
  decimals?: number;
}

/**
 * Metadata processing options
 */
export interface MetadataOptions {
  includeFullData?: boolean;  // Include all available data
  extractTraits?: boolean;    // Extract traits from metadata
}

/**
 * Attempts to parse any metadata string into a structured format
 * @param text String containing potential metadata
 * @param options Options to control metadata parsing
 * @returns Parsed metadata object or null if invalid
 */
export const parseMetadata = (text: string, options: MetadataOptions = {}): TokenMetadata | null => {
  if (!text) return null;
  
  try {
    // First try to parse as JSON
    const trimmed = text.trim();
    
    // Check if it's a 721 metadata format
    if (trimmed.startsWith('{"721":')) {
      return parse721Metadata(trimmed);
    }
    
    // Try parsing as regular JSON
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      const json = JSON.parse(trimmed);
      
      // Handle array format
      if (Array.isArray(json)) {
        return {
          type: 'list',
          data: json.map(String)
        };
      }
      
      // Handle Ergo-specific formats
      if (json.tokenId || json.assetId) {
        return parseErgoTokenMetadata(json);
      }
      
      // Handle Rosen Bridge wrapped token format
      if (json.title && json.originNetwork && json.originToken) {
        return parseRosenBridgeMetadata(json);
      }
      
      // Handle regular JSON format
      return {
        type: 'json',
        data: options.includeFullData ? json : {},
        name: json.name,
        description: json.description,
        image: json.image || json.imageUrl || json.image_url,
        traits: extractTraits(json, options.extractTraits || false),
        collection: json.collection || json.collectionName,
        creator: json.creator || json.artist || json.author,
        standard: detectMetadataStandard(json)
      };
    }
    
    // If it contains newlines, try parsing as a list
    if (text.includes('\n')) {
      const lines = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      if (lines.length > 0) {
        return {
          type: 'list',
          data: lines
        };
      }
    }
    
    // If it's a simple string, treat it as a single-item list
    return {
      type: 'list',
      data: [text]
    };
  } catch (e) {
    console.error('Error parsing metadata:', e);
    // Return the text as a single-item list if parsing fails
    return {
      type: 'unknown',
      data: [text]
    };
  }
};

/**
 * Parses 721 metadata from a string
 * @param text String containing potential 721 metadata
 * @returns Parsed metadata object or null if invalid
 */
export const parse721Metadata = (text: string): TokenMetadata | null => {
  try {
    const json = JSON.parse(text);
    if (!json || !json['721']) return null;
    
    const content = json['721'];
    const policyId = Object.keys(content)[0];
    if (!policyId) return null;
    
    const policyData = content[policyId];
    
    // Handle different 721 metadata structures
    let tokenData: any = {};
    let tokenId = '';
    let collectionName = '';
    let tokenName = '';
    
    // Format: {"721":{"93":{"Cybercitizen":"93","traits":{...}}}}
    // We need to identify "Cybercitizen" as collection, "93" as token ID
    if (typeof policyData === 'object') {
      // Special case: Check if there's a string key with matching value to the policy ID
      // Example: {"Cybercitizen":"93"} where "93" is the policy ID
      const possibleCollectionEntry = Object.entries(policyData).find(
        ([key, value]) => typeof value === 'string' && value === policyId
      );
      
      if (possibleCollectionEntry) {
        // We found the format where a key (collection name) has value equal to policy ID
        collectionName = possibleCollectionEntry[0]; // "Cybercitizen"
        tokenId = policyId; // "93"
        tokenName = tokenId;
        tokenData = policyData;
      }
      // Case 1: Direct project data with no nesting
      else if (policyData.name || policyData.description) {
        tokenData = policyData;
        collectionName = policyId;
        tokenName = policyData.name || policyId;
      } 
      // Case 2: One level of nesting (tokenId -> tokenData)
      else if (Object.keys(policyData).length === 1) {
        tokenId = Object.keys(policyData)[0];
        const nestedData = policyData[tokenId];
        
        if (typeof nestedData === 'object') {
          tokenData = nestedData;
          
          // Check for collection name in first string field
          const firstStringField = Object.entries(nestedData)
            .find(([_, value]) => typeof value === 'string' && value !== tokenId);
            
          if (firstStringField) {
            collectionName = firstStringField[0]; // Use the key as collection name
            tokenName = tokenId; // Use the tokenId as name
          } else {
            collectionName = policyId;
            tokenName = tokenId;
          }
        }
      }
      // Case 3: Assume this is the actual token data
      else {
        tokenData = policyData;
        collectionName = policyId;
        tokenName = policyData.name || policyId;
      }
    }
    
    // Extract traits from different formats
    const traits: Record<string, string> = {};
    
    // Handle explicit traits object
    if (tokenData.traits && typeof tokenData.traits === 'object') {
      Object.entries(tokenData.traits).forEach(([key, value]) => {
        traits[key] = String(value);
      });
    }
    
    // Handle attributes array
    if (Array.isArray(tokenData.attributes)) {
      tokenData.attributes.forEach((attr: any) => {
        if (attr.trait_type && attr.value) {
          traits[attr.trait_type] = String(attr.value);
        }
      });
    }
    
    // Extract additional fields that might be in the metadata
    const series = tokenData.series || '';
    const seed = tokenData.seed || '';
    const creator = tokenData.creator || '';
    
    // Convert to TokenMetadata format
    const metadata: TokenMetadata = {
      type: '721',
      data: tokenData,
      name: tokenName,
      description: tokenData.description || `${collectionName} ${tokenId}`.trim(),
      image: tokenData.image,
      traits: Object.keys(traits).length > 0 ? traits : undefined,
      collection: collectionName,
      creator,
      standard: '721'
    };
    
    // Add any other special fields to the traits
    if (series) traits['Series'] = series;
    if (seed) traits['Seed'] = seed;
    
    // Always use the real token ID, not a name or collection name
    if (tokenId) traits['Token ID'] = policyId; // Use the policy ID (real token ID) not the local tokenId variable
    
    // Make sure traits are assigned
    metadata.traits = Object.keys(traits).length > 0 ? traits : undefined;
    
    return metadata;
  } catch (e) {
    console.error('Error parsing 721 metadata:', e);
    return null;
  }
};

/**
 * Parses Ergo-specific token metadata
 * @param data Token data from Ergo
 * @returns TokenMetadata object
 */
export const parseErgoTokenMetadata = (data: any): TokenMetadata => {
  const traits: Record<string, string> = {};
  
  // Extract traits from attributes if they exist
  if (Array.isArray(data.attributes)) {
    data.attributes.forEach((attr: any) => {
      if (attr.trait_type && attr.value) {
        traits[attr.trait_type] = String(attr.value);
      }
    });
  }
  
  // Try to extract collection name from token name if not explicitly provided
  let collection = data.collection;
  if (!collection && data.name && data.name.includes('#')) {
    collection = data.name.split('#')[0].trim();
  }
  
  return {
    type: 'ergo',
    data: data,
    name: data.name || 'Unknown Token',
    description: data.description || '',
    image: data.imageUrl || data.image || data.image_url,
    traits: Object.keys(traits).length > 0 ? traits : undefined,
    collection,
    creator: data.creator || data.artist || data.minter,
    standard: 'ergo',
    decimals: data.decimals || 0
  };
};

/**
 * Parses Rosen Bridge wrapped token metadata
 * @param data Token data from Rosen Bridge
 * @returns TokenMetadata object
 */
export const parseRosenBridgeMetadata = (data: any): TokenMetadata => {
  // Create traits from the metadata properties
  const traits: Record<string, string> = {};
  
  if (data.originNetwork) {
    traits['Origin Network'] = data.originNetwork;
  }
  
  if (data.originToken) {
    traits['Origin Token'] = data.originToken;
  }
  
  if (data.isNativeToken !== undefined) {
    traits['Is Native Token'] = data.isNativeToken ? 'Yes' : 'No';
  }
  
  // Add any other fields that aren't already included
  Object.entries(data).forEach(([key, value]) => {
    if (!['title', 'originNetwork', 'originToken', 'isNativeToken'].includes(key)) {
      traits[key] = String(value);
    }
  });
  
  return {
    type: 'rosenBridge',
    data: data,
    name: data.title || 'Wrapped Token',
    description: `${data.title} - Wrapped from ${data.originNetwork}`,
    traits: Object.keys(traits).length > 0 ? traits : undefined,
    collection: 'Rosen Bridge Wrapped Tokens',
    standard: 'rosenBridge'
  };
};

/**
 * Attempts to detect the metadata standard based on the properties
 * @param data JSON metadata object
 * @returns Standard name or undefined
 */
export const detectMetadataStandard = (data: any): string | undefined => {
  if (data['721']) return '721';
  if (data['ergo']) return 'ergo';
  if (data['eip']) return `ergo-${data.eip}`;
  
  // Check for Rosen Bridge format
  if (data.title && data.originNetwork && data.originToken) {
    return 'rosenBridge';
  }
  
  // Check for OpenSea compatibility
  if (data.attributes && Array.isArray(data.attributes) && 
      data.attributes.some((attr: any) => attr.trait_type && attr.value)) {
    return 'opensea-compatible';
  }
  
  return undefined;
};

/**
 * Extracts traits from metadata in various formats
 * @param data Metadata object
 * @param extractFromProperties Whether to dig into properties for traits
 * @returns Object with trait key-value pairs
 */
export const extractTraits = (data: any, extractFromProperties: boolean = false): Record<string, string> | undefined => {
  const traits: Record<string, string> = {};
  
  // Handle explicit traits object
  if (data.traits && typeof data.traits === 'object') {
    Object.entries(data.traits).forEach(([key, value]) => {
      traits[key] = String(value);
    });
  }
  
  // Handle attributes array (OpenSea format)
  if (Array.isArray(data.attributes)) {
    data.attributes.forEach((attr: any) => {
      if (attr.trait_type && attr.value !== undefined) {
        traits[attr.trait_type] = String(attr.value);
      }
    });
  }
  
  // Dig into properties if enabled
  if (extractFromProperties && data.properties && typeof data.properties === 'object') {
    Object.entries(data.properties).forEach(([key, value]: [string, any]) => {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        traits[key] = String(value);
      } else if (value && typeof value === 'object' && value.value !== undefined) {
        traits[key] = String(value.value);
      }
    });
  }
  
  return Object.keys(traits).length > 0 ? traits : undefined;
}; 