import React, { ReactNode } from 'react';
import {
  Flex,
  Heading,
  Box,
  HStack,
  Button,
  useColorMode,
  Image,
} from "@chakra-ui/react";
import { Link } from 'react-router-dom';
import { ColorModeSwitcher } from "../../ColorModeSwitcher";

interface NavLink {
  label: string;
  to: string;
}

interface NavbarProps {
  title: string;
  rightComponent?: ReactNode;
  navLinks?: NavLink[];
}

export const Navbar: React.FC<NavbarProps> = ({ title, rightComponent, navLinks = [] }) => {
  const { colorMode } = useColorMode();
  
  return (
    <Flex 
      as="nav" 
      align="center" 
      justify="space-between" 
      wrap="wrap" 
      padding="1.5rem" 
      bg={colorMode === 'light' ? 'ergnome.bg.light' : 'ergnome.bg.dark'}
      color={colorMode === 'light' ? 'ergnome.heading.light' : 'ergnome.heading.dark'}
      borderBottom="2px solid"
      borderColor="ergnome.blue"
    >
      {/* Logo and Title */}
      <Flex align="center" mr={5}>
        <Image 
          src="/logo512.png" 
          alt="Ergo Logo" 
          height="40px"
          width="40px"
          mr={3}
          borderRadius="full"
          transition="all 0.3s ease"
          _hover={{ transform: 'scale(1.1)' }}
          filter={colorMode === 'dark' ? 'invert(1) brightness(100%)' : 'none'}
        />
        <Heading 
          as="h1" 
          size="lg" 
          letterSpacing="tight" 
          color={colorMode === 'light' ? 'ergnome.heading.light' : 'ergnome.heading.dark'}
        >
          {title}
        </Heading>
      </Flex>

      {/* Navigation Links */}
      {navLinks.length > 0 && (
        <HStack spacing={4} display={{ base: 'none', md: 'flex' }}>
          {navLinks.map((link) => (
            <Button
              key={link.to}
              as={Link}
              to={link.to}
              variant="ghost"
              color={colorMode === 'light' ? 'ergnome.heading.light' : 'ergnome.heading.dark'}
              _hover={{ 
                bg: colorMode === 'light' ? 'ergnome.hover.light' : 'ergnome.hover.dark',
                color: colorMode === 'light' ? 'ergnome.heading.light' : 'ergnome.heading.dark'
              }}
            >
              {link.label}
            </Button>
          ))}
        </HStack>
      )}

      {/* Right component slot */}
      <Flex align="center">
        {rightComponent && (
          <Box mr={4}>
            {rightComponent}
          </Box>
        )}
        <ColorModeSwitcher />
      </Flex>
    </Flex>
  );
}; 