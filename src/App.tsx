import React, { useRef } from 'react';
import { ChakraProvider } from "@chakra-ui/react";
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import theme from './theme';
import { PageLayout } from './components/layout/PageLayout';
import { WalletConnector } from './components/wallet/WalletConnector';
import { WalletDashboard } from './components/wallet/WalletDashboard';
import NFTGalleryPage from './pages/NFTGalleryPage';
import { WalletProvider } from './context/WalletContext';
import RosenBridgeTest from './components/RosenBridgeTest';
import { DynamicProvider } from './lib/DynamicProvider';
import { ErgoWallet } from './components/ErgoWallet';
import { TicTacToePage } from './components/games/TicTacToePage';
import { dynamicAuthRoutesEnabled } from './lib/appEnv';

export const App = () => {
  // Ref to trigger wallet connect from components that need it
  const connectWalletRef = useRef<() => void>(() => {});

  const navLinks = [
    { label: 'Dashboard', to: '/' },
    ...(dynamicAuthRoutesEnabled
      ? [{ label: 'Dynamic Login', to: '/dynamic' as const }]
      : []),
    { label: 'Tic-Tac-Toe', to: '/games/tic-tac-toe' },
    { label: 'NFT Gallery', to: '/nft-gallery' },
    { label: 'Metadata Test', to: '/rosen-test' },
  ];

  return (
    <ChakraProvider theme={theme}>
      <DynamicProvider>
        <WalletProvider>
          <Router>
            <PageLayout
              title="Ergo Wallet Explorer"
              navbarRightComponent={<WalletConnector ref={connectWalletRef} />}
              navLinks={navLinks}
            >
              <Routes>
                <Route path="/" element={<WalletDashboard />} />
                {dynamicAuthRoutesEnabled && (
                  <Route path="/dynamic" element={<ErgoWallet />} />
                )}
                {!dynamicAuthRoutesEnabled && (
                  <Route path="/dynamic" element={<Navigate to="/" replace />} />
                )}
                <Route path="/games/tic-tac-toe" element={<TicTacToePage />} />
                <Route path="/nft-gallery" element={<NFTGalleryPage />} />
                <Route path="/rosen-test" element={<RosenBridgeTest />} />
              </Routes>
            </PageLayout>
          </Router>
        </WalletProvider>
      </DynamicProvider>
    </ChakraProvider>
  );
};
