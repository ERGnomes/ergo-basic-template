import React from 'react';
import { Container } from '@chakra-ui/react';
import NFTGallery from '../components/gallery/NFTGallery';

const GalleryPage: React.FC = () => {
  return (
    <Container maxW="container.xl" py={8}>
      <NFTGallery title="Ergo NFT Gallery" />
    </Container>
  );
};

export default GalleryPage; 