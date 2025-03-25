import React, { ReactNode } from 'react';
import { Box, Container } from "@chakra-ui/react";
import { Navbar } from './Navbar';

interface PageLayoutProps {
  title: string;
  navbarRightComponent?: ReactNode;
  children: ReactNode;
}

export const PageLayout: React.FC<PageLayoutProps> = ({
  title,
  navbarRightComponent,
  children
}) => {
  return (
    <Box minH="100vh" bg="ergnome.bg">
      <Navbar title={title} rightComponent={navbarRightComponent} />
      <Container maxW="container.xl" py={6}>
        {children}
      </Container>
    </Box>
  );
}; 