import React, { ReactNode } from 'react';
import { Box, Container } from "@chakra-ui/react";
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
  return (
    <Box minH="100vh" bg="ergnome.bg">
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