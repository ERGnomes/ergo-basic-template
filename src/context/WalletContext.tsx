import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { connectWallet, disconnectWallet, isWalletConnected, getTokensFromUtxos, formatErgAmount } from '../utils/ergo';
import { WalletData } from '../components/wallet/WalletConnector';

interface WalletContextType {
  walletData: WalletData;
  connectToWallet: () => Promise<void>;
  disconnectFromWallet: () => Promise<void>;
  checkWalletConnection: () => Promise<boolean>;
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
  checkWalletConnection: async () => false
});

export const useWallet = () => useContext(WalletContext);

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [walletData, setWalletData] = useState<WalletData>(defaultWalletData);

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

  // Define connectToWallet before it's used in checkWalletConnection
  const connectToWallet = async (): Promise<void> => {
    try {
      console.log("Connecting to wallet...");
      const connected = await connectWallet();
      
      if (connected) {
        // Ensure ergo context is initialized
        if (window.ergoConnector && !window.ergo) {
          window.ergo = await window.ergoConnector.nautilus.getContext();
        }
        
        // Get UTXOs
        const utxos = await window.ergo.get_utxos();
        
        // Calculate ERG balance
        const totalErg = utxos.reduce((acc: number, utxo: any) => {
          return acc + parseInt(utxo.value);
        }, 0);
        
        const formattedErgBalance = formatErgAmount(totalErg);
        
        // Get all tokens
        const tokenArray = await getTokensFromUtxos(utxos);
        
        // Update wallet data
        setWalletData({
          isConnected: true,
          ergBalance: formattedErgBalance,
          tokens: tokenArray,
          walletStatus: 'Connected'
        });
        
        console.log("Wallet connected successfully");
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
        walletStatus: 'Error connecting'
      });
    }
  };

  // Now the useEffect with proper dependencies
  useEffect(() => {
    const initWallet = async () => {
      const connected = await isWalletConnected();
      if (connected) {
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
    checkWalletConnection
  };

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
}; 