import React, { ReactNode } from 'react';
import {
  Flex,
  Heading,
  Box,
  HStack,
  Button,
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
  return (
    <Flex 
      as="nav" 
      align="center" 
      justify="space-between" 
      wrap="wrap" 
      padding="1.5rem" 
      bg="ergnome.bg" 
      color="ergnome.text"
      borderBottom="2px solid"
      borderColor="ergnome.blue"
    >
      {/* Logo and Title */}
      <Flex align="center" mr={5}>
        <Heading as="h1" size="lg" letterSpacing="tight" color="ergnome.blue">
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
              colorScheme="orange"
              _hover={{ bg: 'ergnome.hover' }}
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