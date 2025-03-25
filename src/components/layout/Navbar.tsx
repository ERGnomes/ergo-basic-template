import React, { ReactNode } from 'react';
import {
  Flex,
  Heading,
  Box,
} from "@chakra-ui/react";
import { ColorModeSwitcher } from "../../ColorModeSwitcher";

interface NavbarProps {
  title: string;
  rightComponent?: ReactNode;
}

export const Navbar: React.FC<NavbarProps> = ({ title, rightComponent }) => {
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