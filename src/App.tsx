import React, { useRef } from 'react';
import { ChakraProvider } from "@chakra-ui/react";
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import theme from './theme';
import { PageLayout } from './components/layout/PageLayout';
import { WalletConnector } from './components/wallet/WalletConnector';
import { WalletDashboard } from './components/wallet/WalletDashboard';
import NFTGalleryPage from './pages/NFTGalleryPage';
import { WalletProvider } from './context/WalletContext';
import RosenBridgeTest from './components/RosenBridgeTest';

export const App = () => {
  // Ref to trigger wallet connect from components that need it
  const connectWalletRef = useRef<() => void>(() => {});

  return (
    <ChakraProvider theme={theme}>
      <WalletProvider>
        <Router>
          <PageLayout 
            title="Ergo Wallet Explorer"
            navbarRightComponent={<WalletConnector ref={connectWalletRef} />}
            navLinks={[
              { label: 'Dashboard', to: '/' },
              { label: 'NFT Gallery', to: '/nft-gallery' },
              { label: 'Metadata Test', to: '/rosen-test' }
            ]}
          >
            <Routes>
              <Route path="/" element={<WalletDashboard />} />
              <Route path="/nft-gallery" element={<NFTGalleryPage />} />
              <Route path="/rosen-test" element={<RosenBridgeTest />} />
            </Routes>
          </PageLayout>
        </Router>
      </WalletProvider>
    </ChakraProvider>
  );
};
