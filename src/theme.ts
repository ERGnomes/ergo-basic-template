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
    bg: {
      light: "#94a3b8",  // Medium gray for light mode background
      dark: "#111827"    // Current dark color
    },
    cardBg: {
      light: "#cbd5e1",  // Lighter gray for cards in light mode
      dark: "#1f2937"    // Current dark color
    },
    text: {
      light: "#0f172a",  // Much darker text for light mode (almost black)
      dark: "#f3f4f6"    // Current light text for dark mode
    },
    heading: {
      light: "#020617",  // Even darker for headings in light mode
      dark: "#f3f4f6"    // Current light text for dark mode
    },
    hover: {
      light: "#64748b",  // Slightly darker gray for hover
      dark: "#2d3748"    // Dark gray hover for dark mode
    }
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
    baseStyle: (props: { colorMode: string }) => ({
      bg: props.colorMode === 'light' ? colors.ergnome.cardBg.light : colors.ergnome.cardBg.dark,
      borderColor: colors.ergnome.blue,
      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
      borderRadius: "md",
      p: 2,
    }),
  },
  MenuItem: {
    baseStyle: (props: { colorMode: string }) => ({
      borderRadius: "md",
      _hover: {
        bg: props.colorMode === 'light' ? colors.ergnome.hover.light : colors.ergnome.hover.dark,
      },
      transition: "all 0.2s",
    }),
  },
  Heading: {
    baseStyle: (props: { colorMode: string }) => ({
      fontWeight: "bold", 
      letterSpacing: "tight",
      color: props.colorMode === 'light' ? colors.ergnome.heading.light : colors.ergnome.heading.dark,
    }),
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
  global: (props: { colorMode: string }) => ({
    body: {
      bg: props.colorMode === 'light' ? colors.ergnome.bg.light : colors.ergnome.bg.dark,
      color: props.colorMode === 'light' ? colors.ergnome.text.light : colors.ergnome.text.dark,
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
  }),
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