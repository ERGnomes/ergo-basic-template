/**
 * Ergo Utility Functions
 * These functions provide common functionality for working with the Ergo blockchain
 * and can be reused across different components.
 */

// Format a token amount based on its decimals
export const formatTokenAmount = (amount: number | string, decimals: number = 0): string => {
  const amountNum = typeof amount === 'string' ? parseInt(amount) : amount;
  if (decimals === 0) return amountNum.toString();
  const factor = Math.pow(10, decimals);
  return (amountNum / factor).toFixed(decimals);
};

// Format ERG amount (1 ERG = 10^9 nanoERG)
export const formatErgAmount = (nanoErg: number | string, decimals: number = 4): string => {
  const amountNum = typeof nanoErg === 'string' ? parseInt(nanoErg) : nanoErg;
  return (amountNum / 1000000000).toFixed(decimals);
};

// Shorten a token ID for display
export const shortenTokenId = (tokenId: string, startLength: number = 8, endLength: number = 8): string => {
  if (!tokenId || tokenId.length <= startLength + endLength + 3) return tokenId;
  return `${tokenId.substring(0, startLength)}...${tokenId.substring(tokenId.length - endLength)}`;
};

// Check if wallet is connected
export const isWalletConnected = async (): Promise<boolean> => {
  try {
    if (!window.ergoConnector) return false;
    return await window.ergoConnector.nautilus.isConnected();
  } catch (error) {
    console.error('Error checking wallet connection:', error);
    return false;
  }
};

// Connect to wallet
export const connectWallet = async () => {
  try {
    if (!window.ergoConnector) throw new Error('Nautilus wallet not found');
    return await window.ergoConnector.nautilus.connect();
  } catch (error) {
    console.error('Error connecting to wallet:', error);
    throw error;
  }
};

// Disconnect from wallet
export const disconnectWallet = async () => {
  try {
    if (!window.ergoConnector) return;
    return await window.ergoConnector.nautilus.disconnect();
  } catch (error) {
    console.error('Error disconnecting wallet:', error);
    throw error;
  }
};

// Get all tokens from UTXOs with proper formatting
export const getTokensFromUtxos = async (utxos: any[]): Promise<any[]> => {
  if (!utxos || !utxos.length) return [];
  
  const tokenMap = new Map();
  utxos.forEach((utxo: any) => {
    utxo.assets?.forEach((asset: any) => {
      if (!tokenMap.has(asset.tokenId)) {
        tokenMap.set(asset.tokenId, {
          tokenId: asset.tokenId,
          amount: 0,
          name: asset.name || 'Unknown Token',
          decimals: asset.decimals || 0
        });
      }
      const token = tokenMap.get(asset.tokenId);
      token.amount += parseInt(asset.amount);
    });
  });
  return Array.from(tokenMap.values());
}; 