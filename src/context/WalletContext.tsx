import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { connectWallet, disconnectWallet, isWalletConnected, getTokensFromUtxos, formatErgAmount } from '../utils/ergo';
import { WalletData } from '../components/wallet/WalletConnector';
import { processTokens } from '../utils/tokenProcessing';

// Storage key for wallet connection preference
const WALLET_AUTO_CONNECT_KEY = 'ergo_wallet_auto_connect';

interface WalletContextType {
  walletData: WalletData;
  connectToWallet: () => Promise<void>;
  disconnectFromWallet: () => Promise<void>;
  checkWalletConnection: () => Promise<boolean>;
  setAutoConnect: (enabled: boolean) => void;
  autoConnectEnabled: boolean;
}

const defaultWalletData: WalletData = {
  isConnected: false,
  ergBalance: '0',
  tokens: [],
  walletStatus: 'Not connected'
};

const WalletContext = createContext<WalletContextType>({
  walletData: defaultWalletData,
  connectToWallet: async () => {},
  disconnectFromWallet: async () => {},
  checkWalletConnection: async () => false,
  setAutoConnect: () => {},
  autoConnectEnabled: false
});

export const useWallet = () => useContext(WalletContext);

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [walletData, setWalletData] = useState<WalletData>(defaultWalletData);
  const [autoConnectEnabled, setAutoConnectEnabled] = useState<boolean>(() => {
    // Initialize from localStorage
    const savedPreference = localStorage.getItem(WALLET_AUTO_CONNECT_KEY);
    return savedPreference === 'true';
  });

  // Function to set auto-connect preference and save to localStorage
  const setAutoConnect = (enabled: boolean) => {
    setAutoConnectEnabled(enabled);
    localStorage.setItem(WALLET_AUTO_CONNECT_KEY, enabled ? 'true' : 'false');
  };

  // Define connectToWallet before it's used in checkWalletConnection
  const connectToWallet = async (): Promise<void> => {
    try {
      console.log("Connecting to wallet...");
      const connected = await connectWallet();
      console.log("connectWallet result:", connected);
      
      if (connected) {
        // Save auto-connect preference when successful connection is made
        setAutoConnect(true);
        
        // Ensure ergo context is initialized
        console.log("Ergo connector present:", !!window.ergoConnector, "Ergo present:", !!window.ergo);
        if (window.ergoConnector && !window.ergo) {
          console.log("Getting ergo context...");
          try {
            window.ergo = await window.ergoConnector.nautilus.getContext();
            console.log("Context retrieved successfully:", !!window.ergo);
          } catch (contextError) {
            console.error("Error getting context:", contextError);
            throw contextError;
          }
        }
        
        try {
          // Get UTXOs
          console.log("Getting UTXOs...");
          const utxos = await window.ergo.get_utxos();
          console.log("UTXOs retrieved, count:", utxos.length);
          
          // Calculate ERG balance
          const totalErg = utxos.reduce((acc: number, utxo: any) => {
            return acc + parseInt(utxo.value);
          }, 0);
          
          const formattedErgBalance = formatErgAmount(totalErg);
          console.log("ERG balance calculated:", formattedErgBalance);
          
          // Get all tokens
          console.log("Getting tokens from UTXOs...");
          const rawTokens = await getTokensFromUtxos(utxos);
          console.log("Token retrieval complete, count:", rawTokens.length);
          
          // Process tokens with our enhanced processing
          console.log("Processing tokens...");
          const processedTokens = processTokens(rawTokens, {
            metadataOptions: { extractTraits: true },
            detectCollections: true,
            generatePlaceholderImage: true
          });
          console.log("Token processing complete");
          
          // Update wallet data
          setWalletData({
            isConnected: true,
            ergBalance: formattedErgBalance,
            tokens: processedTokens,
            walletStatus: 'Connected'
          });
          
          console.log("Wallet connected successfully");
        } catch (operationError: unknown) {
          console.error("Error performing wallet operations:", operationError);
          setWalletData({
            ...defaultWalletData,
            walletStatus: 'Error: ' + (operationError instanceof Error ? operationError.message : String(operationError))
          });
          throw operationError;
        }
      } else {
        setWalletData({
          ...defaultWalletData,
          walletStatus: 'Connection failed'
        });
        console.log("Wallet connection failed");
      }
    } catch (error) {
      console.error('Error connecting to wallet:', error);
      setWalletData({
        ...defaultWalletData,
        walletStatus: 'Error: ' + (error instanceof Error ? error.message : String(error))
      });
    }
  };

  // Define checkWalletConnection before it's used in useEffect
  const checkWalletConnection = async (): Promise<boolean> => {
    try {
      const connected = await isWalletConnected();
      
      // If wallet state has changed, update it
      if (connected !== walletData.isConnected) {
        if (connected) {
          await connectToWallet();
        } else {
          setWalletData(defaultWalletData);
        }
      }
      
      return connected;
    } catch (error) {
      console.error('Error checking wallet connection:', error);
      return false;
    }
  };

  // Try to auto-connect on first load
  useEffect(() => {
    const initWallet = async () => {
      console.log("Initializing wallet, auto-connect:", autoConnectEnabled);
      
      // First check if wallet is already connected
      const connected = await isWalletConnected();
      
      if (connected) {
        console.log("Wallet already connected, initializing...");
        await connectToWallet();
      } else if (autoConnectEnabled) {
        console.log("Auto-connect enabled, attempting to connect...");
        await connectToWallet();
      }
    };
    
    initWallet();
    
    // Set up timer to periodically check wallet connection
    const interval = setInterval(async () => {
      await checkWalletConnection();
    }, 10000); // Check every 10 seconds
    
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const disconnectFromWallet = async (): Promise<void> => {
    try {
      await disconnectWallet();
      // When user explicitly disconnects, disable auto-connect
      setAutoConnect(false);
      setWalletData(defaultWalletData);
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
      setWalletData({
        ...walletData,
        walletStatus: 'Error disconnecting'
      });
    }
  };

  const contextValue: WalletContextType = {
    walletData,
    connectToWallet,
    disconnectFromWallet,
    checkWalletConnection,
    setAutoConnect,
    autoConnectEnabled
  };

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
}; 