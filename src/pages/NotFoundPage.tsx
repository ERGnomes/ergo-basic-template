import React from "react";
import { Box, Button, Heading, Text, VStack } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";

const NotFoundPage: React.FC = () => {
  return (
    <Box maxW="560px" mx="auto" py={12} textAlign="center">
      <VStack spacing={5}>
        <Heading size="xl">404</Heading>
        <Text color="gray.600" _dark={{ color: "whiteAlpha.800" }}>
          This route does not exist. If you forked the template, add your own
          routes in <code>App.tsx</code>.
        </Text>
        <Button as={RouterLink} to="/" colorScheme="blue">
          Go to dashboard
        </Button>
        <Button as={RouterLink} to="/developers" variant="outline" size="sm">
          Developer guide
        </Button>
      </VStack>
    </Box>
  );
};

export default NotFoundPage;
