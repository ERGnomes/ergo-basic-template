import React from 'react';
import { Container } from '@chakra-ui/react';
import { NFTGallery } from '../components/gallery/NFTGallery';
import { WalletProvider } from '../context/WalletContext';

const NFTGalleryPage: React.FC = () => {
  return (
    <WalletProvider>
      <Container maxW="container.xl" py={8}>
        <NFTGallery title="NFT Gallery" />
      </Container>
    </WalletProvider>
  );
};

export default NFTGalleryPage; 