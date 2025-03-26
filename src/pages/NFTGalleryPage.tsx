import React from 'react';
import { Box } from '@chakra-ui/react';
import NFTGallery from '../components/gallery/NFTGallery';
import { WalletProvider } from '../context/WalletContext';

const NFTGalleryPage: React.FC = () => {
  return (
    <WalletProvider>
      <Box maxW="1200px" mx="auto">
        <NFTGallery title="Ergo NFT Gallery" />
      </Box>
    </WalletProvider>
  );
};

export default NFTGalleryPage; 