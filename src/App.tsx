import React, { useState, useRef } from 'react';
import { ChakraProvider } from "@chakra-ui/react";
import theme from './theme';
import { PageLayout } from './components/layout/PageLayout';
import { WalletConnector, WalletData } from './components/wallet/WalletConnector';
import { WalletDashboard } from './components/wallet/WalletDashboard';

export const App = () => {
  const [walletData, setWalletData] = useState<WalletData>({
    isConnected: false,
    ergBalance: '0',
    tokens: [],
    walletStatus: 'Not connected'
  });
  
  // Ref to trigger wallet connect from the dashboard button
  const connectWalletRef = useRef<() => void>(() => {});

  const handleWalletConnect = (data: WalletData) => {
    setWalletData(data);
  };

  const handleWalletDisconnect = () => {
    setWalletData({
      isConnected: false,
      ergBalance: '0',
      tokens: [],
      walletStatus: 'Disconnected'
    });
  };

  const handleConnectRequest = () => {
    // Call the connect method via ref
    if (connectWalletRef.current) {
      connectWalletRef.current();
    }
  };

  return (
    <ChakraProvider theme={theme}>
      <PageLayout 
        title="Ergo Wallet Explorer"
        navbarRightComponent={
          <WalletConnector 
            onWalletConnect={handleWalletConnect} 
            onWalletDisconnect={handleWalletDisconnect}
            ref={connectWalletRef}
          />
        }
      >
        <WalletDashboard 
          walletData={walletData}
          onConnectWallet={handleConnectRequest}
        />
      </PageLayout>
    </ChakraProvider>
  );
};
