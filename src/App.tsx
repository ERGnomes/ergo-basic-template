import React, { useRef } from 'react';
import { ChakraProvider } from "@chakra-ui/react";
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import theme from './theme';
import { PageLayout } from './components/layout/PageLayout';
import { WalletConnector } from './components/wallet/WalletConnector';
import { WalletDashboard } from './components/wallet/WalletDashboard';
import NFTGalleryPage from './pages/NFTGalleryPage';
import DeveloperGuidePage from './pages/DeveloperGuidePage';
import NotFoundPage from './pages/NotFoundPage';
import { WalletProvider } from './context/WalletContext';
import RosenBridgeTest from './components/RosenBridgeTest';
import { DynamicProvider } from './lib/DynamicProvider';
import { ErgoWallet } from './components/ErgoWallet';
import { TicTacToePage } from './components/games/TicTacToePage';
import { SuperTicTacToePage } from './components/games/SuperTicTacToePage';
import { devToolsNavEnabled, dynamicAuthRoutesEnabled } from './lib/appEnv';
import { siteName } from './lib/siteBranding';
import { useDocumentMeta } from './lib/useDocumentMeta';

export const App = () => {
  useDocumentMeta();
  // Ref to trigger wallet connect from components that need it
  const connectWalletRef = useRef<() => void>(() => {});

  const navLinks = [
    { label: 'Dashboard', to: '/' },
    ...(dynamicAuthRoutesEnabled
      ? [{ label: 'Dynamic Login', to: '/dynamic' as const }]
      : []),
    { label: 'Tic-Tac-Toe', to: '/games/tic-tac-toe' },
    { label: 'Super Tic-Tac-Toe', to: '/games/xoxo' },
    { label: 'NFT Gallery', to: '/nft-gallery' },
    { label: 'Developer guide', to: '/developers' },
    ...(devToolsNavEnabled
      ? [{ label: 'Metadata test (dev)', to: '/rosen-test' as const }]
      : []),
  ];

  return (
    <ChakraProvider theme={theme}>
      <DynamicProvider>
        <WalletProvider>
          <Router>
            <PageLayout
              title={siteName}
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
                <Route path="/games/xoxo" element={<SuperTicTacToePage />} />
                <Route path="/nft-gallery" element={<NFTGalleryPage />} />
                <Route path="/developers" element={<DeveloperGuidePage />} />
                {devToolsNavEnabled ? (
                  <Route path="/rosen-test" element={<RosenBridgeTest />} />
                ) : (
                  <Route path="/rosen-test" element={<Navigate to="/" replace />} />
                )}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </PageLayout>
          </Router>
        </WalletProvider>
      </DynamicProvider>
    </ChakraProvider>
  );
};
