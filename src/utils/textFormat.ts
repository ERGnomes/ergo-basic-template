/**
 * Shortens a blockchain address or token ID with ellipsis
 * @param text The address or token ID to shorten
 * @param startChars Number of characters to show at start (default: 6)
 * @param endChars Number of characters to show at end (default: 6)
 */
export const shortenAddress = (text: string, startChars = 6, endChars = 6): string => {
  if (!text) return '';
  if (text.length <= startChars + endChars + 3) return text;
  return `${text.substring(0, startChars)}...${text.substring(text.length - endChars)}`;
};

/**
 * Determines appropriate font size based on text length
 * @param text The text content
 * @param baseSize The base size class (e.g., "xl", "2xl")
 */
export const dynamicFontSize = (text: string): string => {
  if (!text) return "4xl";
  
  if (text.length <= 4) return "6xl";
  if (text.length <= 10) return "5xl";
  if (text.length <= 20) return "4xl";
  return "3xl";
};

/**
 * Truncates a title with consideration for readability
 * @param title The title to format
 * @param maxLength Maximum length before truncating
 */
export const formatTitle = (title: string, maxLength = 30): string => {
  if (!title) return '';
  if (title.length <= maxLength) return title;
  return `${title.substring(0, maxLength)}...`;
};

/**
 * Converts text to display-friendly formatted text for placeholders
 * @param text Text to format
 * @param maxChars Maximum characters to display
 */
export const formatPlaceholderText = (text: string, maxChars = 4): string => {
  if (!text) return '??';
  
  // For very short texts, display the whole thing
  if (text.length <= maxChars) {
    return text.toUpperCase();
  }
  
  // For longer texts, take first two characters
  return text.substring(0, 2).toUpperCase();
};

/**
 * Calculates a color based on a token ID for consistent color assignment
 * @param tokenId The token ID to derive color from
 */
export const getTokenColor = (tokenId: string): string => {
  if (!tokenId) return '#6B7280'; // Default gray
  return `#${tokenId.substring(0, 6)}`;
};

/**
 * Standardized token card styling
 */
export const tokenCardStyles = {
  borderWidth: "3px",
  borderRadius: "lg",
  boxShadow: "0px 5px 15px rgba(0, 0, 0, 0.2)",
  hoverTransform: 'translateY(-8px) rotateZ(1deg)',
  hoverShadow: '0px 8px 20px rgba(0, 0, 0, 0.3)',
  imageHeight: "180px"
}; 