import React, { ReactNode } from 'react';
import { Box, Container, Flex, useColorMode } from "@chakra-ui/react";
import { Navbar } from './Navbar';
import { SiteFooter } from './SiteFooter';

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
    <Flex
      minH="100vh"
      direction="column"
      bg={colorMode === 'light' ? 'ergnome.bg.light' : 'ergnome.bg.dark'}
    >
      <Navbar 
        title={title} 
        rightComponent={navbarRightComponent} 
        navLinks={navLinks}
      />
      <Box flex="1">
        <Container maxW="container.xl" py={6}>
          {children}
        </Container>
      </Box>
      <SiteFooter />
    </Flex>
  );
}; 