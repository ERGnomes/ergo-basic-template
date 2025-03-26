import React, { ReactNode } from 'react';
import { Box, Container, useColorMode } from "@chakra-ui/react";
import { Navbar } from './Navbar';

interface NavLink {
  label: string;
  to: string;
}

interface PageLayoutProps {
  title: string;
  navbarRightComponent?: ReactNode;
  navLinks?: NavLink[];
  children: ReactNode;
}

export const PageLayout: React.FC<PageLayoutProps> = ({
  title,
  navbarRightComponent,
  navLinks,
  children
}) => {
  const { colorMode } = useColorMode();
  
  return (
    <Box minH="100vh" bg={colorMode === 'light' ? 'ergnome.bg.light' : 'ergnome.bg.dark'}>
      <Navbar 
        title={title} 
        rightComponent={navbarRightComponent} 
        navLinks={navLinks}
      />
      <Container maxW="container.xl" py={6}>
        {children}
      </Container>
    </Box>
  );
}; 