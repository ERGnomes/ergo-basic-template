import { extendTheme, ThemeConfig } from "@chakra-ui/react";

// Custom colors for the Ergo theme
const colors = {
  ergnome: {
    purple: "#6247aa",
    blue: "#419dd9",
    green: "#53ba83",
    yellow: "#f5cb5c",
    orange: "#e8871e",
    red: "#e15554",
    bg: "#111827",
    cardBg: "#1f2937",
    text: "#f3f4f6",
  },
};

// Support for dark/light mode
const config: ThemeConfig = {
  initialColorMode: "dark",
  useSystemColorMode: true,
};

// Component style overrides
const components = {
  Button: {
    variants: {
      ergnome: {
        bg: "#419dd9",
        color: "white",
        _hover: {
          bg: "#53ba83",
          transform: "translateY(-2px)",
          boxShadow: "md",
        },
        transition: "all 0.3s ease",
      },
    },
  },
  MenuList: {
    baseStyle: {
      bg: "#1f2937",
      borderColor: "#419dd9",
      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
      borderRadius: "md",
      p: 2,
    },
  },
  MenuItem: {
    baseStyle: {
      borderRadius: "md",
      _hover: {
        bg: "#2d3748",
      },
      transition: "all 0.2s",
    },
  },
  Heading: {
    baseStyle: {
      fontWeight: "bold", 
      letterSpacing: "tight",
    },
  },
  Box: {
    baseStyle: {
      transition: "all 0.3s ease",
    },
  },
  Badge: {
    baseStyle: {
      borderRadius: "full",
      px: 2,
      py: 1,
    },
    variants: {
      ergo: {
        bg: "ergnome.blue",
        color: "white",
      },
    },
  },
};

// Global styles
const styles = {
  global: {
    body: {
      bg: "#111827",
      color: "#f3f4f6",
    },
    // Add smooth scrolling to the page
    html: {
      scrollBehavior: "smooth",
    },
    // Improve focus outline
    "*:focus": {
      outline: "3px solid rgba(65, 157, 217, 0.6)",
      outlineOffset: "2px",
    },
  },
};

// Export the complete theme
const theme = extendTheme({
  colors,
  config,
  components,
  styles,
  fonts: {
    heading: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
    body: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
  },
  shadows: {
    outline: "0 0 0 3px rgba(65, 157, 217, 0.6)",
  },
});

export default theme; 