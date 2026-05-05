import React, { ReactNode } from 'react';
import {
  Flex,
  Heading,
  Box,
  HStack,
  Button,
  useColorMode,
  Image,
  IconButton,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Stack,
  useDisclosure,
} from "@chakra-ui/react";
import { HamburgerIcon } from "@chakra-ui/icons";
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
  const { isOpen, onOpen, onClose } = useDisclosure();

  const linkButtonProps = {
    variant: "ghost" as const,
    color: colorMode === 'light' ? 'ergnome.heading.light' : 'ergnome.heading.dark',
    _hover: {
      bg: colorMode === 'light' ? 'ergnome.hover.light' : 'ergnome.hover.dark',
      color: colorMode === 'light' ? 'ergnome.heading.light' : 'ergnome.heading.dark',
    },
  };

  return (
    <Flex 
      as="nav" 
      align="center" 
      justify="space-between" 
      wrap="wrap" 
      gap={3}
      padding="1.5rem" 
      bg={colorMode === 'light' ? 'ergnome.bg.light' : 'ergnome.bg.dark'}
      color={colorMode === 'light' ? 'ergnome.heading.light' : 'ergnome.heading.dark'}
      borderBottom="2px solid"
      borderColor="ergnome.blue"
    >
      {/* Logo and Title */}
      <Flex align="center" mr={{ md: 5 }} minW={0} flex="1 1 auto">
        <Image 
          src="/logo512.png" 
          alt="Ergo Logo" 
          height="40px"
          width="40px"
          mr={3}
          borderRadius="full"
          flexShrink={0}
          transition="all 0.3s ease"
          _hover={{ transform: 'scale(1.1)' }}
          filter={colorMode === 'dark' ? 'invert(1) brightness(100%)' : 'none'}
        />
        <Heading 
          as="h1" 
          size="lg" 
          letterSpacing="tight" 
          noOfLines={2}
          color={colorMode === 'light' ? 'ergnome.heading.light' : 'ergnome.heading.dark'}
        >
          {title}
        </Heading>
      </Flex>

      {/* Navigation Links (desktop) */}
      {navLinks.length > 0 && (
        <HStack spacing={1} display={{ base: 'none', md: 'flex' }} flexWrap="wrap" justify="center">
          {navLinks.map((link) => (
            <Button
              key={link.to}
              as={Link}
              to={link.to}
              {...linkButtonProps}
            >
              {link.label}
            </Button>
          ))}
        </HStack>
      )}

      {/* Right: wallet, mobile menu, theme */}
      <Flex align="center" gap={1} flexShrink={0}>
        {rightComponent && (
          <Box mr={{ base: 1, md: 2 }}>
            {rightComponent}
          </Box>
        )}
        {navLinks.length > 0 && (
          <>
            <IconButton
              display={{ base: 'flex', md: 'none' }}
              aria-label="Open navigation menu"
              icon={<HamburgerIcon boxSize={6} />}
              variant="ghost"
              onClick={onOpen}
              color={colorMode === 'light' ? 'ergnome.heading.light' : 'ergnome.heading.dark'}
            />
            <Drawer isOpen={isOpen} placement="right" onClose={onClose} size="xs">
              <DrawerOverlay />
              <DrawerContent>
                <DrawerCloseButton />
                <DrawerHeader borderBottomWidth="1px">Menu</DrawerHeader>
                <DrawerBody>
                  <Stack spacing={1} align="stretch">
                    {navLinks.map((link) => (
                      <Button
                        key={link.to}
                        as={Link}
                        to={link.to}
                        {...linkButtonProps}
                        justifyContent="flex-start"
                        onClick={onClose}
                      >
                        {link.label}
                      </Button>
                    ))}
                  </Stack>
                </DrawerBody>
              </DrawerContent>
            </Drawer>
          </>
        )}
        <ColorModeSwitcher />
      </Flex>
    </Flex>
  );
}; 