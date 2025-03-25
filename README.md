# Ergo Basic Template

A modular React template for building applications on the Ergo blockchain. This template provides a structured foundation with reusable components for wallet connection, token display, and a beautiful dashboard interface.

![Ergo Basic Template](https://ergoplatform.org/en/wp-content/uploads/2023/08/Banner-ERG-2023-1920x1080px-01-1.png)

## ✨ Features

- **Modular Component Structure**: Components are organized by function for easy reuse
- **Nautilus Wallet Integration**: Connect to the Ergo blockchain using Nautilus wallet
- **Complete Wallet Dashboard**: View your ERG balance and all tokens in a beautiful interface
- **Reusable Utilities**: Common functions for working with ERG, tokens, and wallet interaction
- **Responsive UI**: Built with Chakra UI for a beautiful, responsive experience
- **Type Safety**: Written in TypeScript for improved developer experience
- **Theme Customization**: Easily configurable theme with Ergo-inspired styling
- **Animations & Transitions**: Smooth animations for a modern user experience

## 🚀 Getting Started

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/ergo-basic-template.git
   cd ergo-basic-template
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm start
   ```

4. Build for production:
   ```
   npm run build
   ```

## 📂 Project Structure

The project is organized for maximum reusability:

- `src/components/`: Reusable UI components
  - `layout/`: Layout components like Navbar and PageLayout
  - `wallet/`: Wallet connection components and dashboard
  - `tokens/`: Token display components
- `src/utils/`: Utility functions
  - `ergo.ts`: Ergo-specific utility functions
- `src/theme.ts`: Customizable Chakra UI theme

## 🛠️ Extending the Template

This template is designed to be easily extended:

1. **Add New Pages**: Create new page components and add them to your routing
2. **Customize the Theme**: Modify `src/theme.ts` to change colors and styles
3. **Add New Components**: Follow the existing component structure in `/components`
4. **Add New Functionality**: Extend utility functions in `/utils`

## 📚 Tutorials

Check out our step-by-step tutorials to learn how to build different types of applications with this template:

- [**NFT Gallery**](docs/tutorials/01-nft-gallery.md) - Display your NFT collection
- [**NFT Marketplace**](docs/tutorials/02-nft-marketplace.md) - Buy and sell NFTs
- [**Raffle dApp**](docs/tutorials/03-raffle-contract.md) - Create raffles with prizes
- [**NFT Escrow Trading**](docs/tutorials/04-nft-escrow.md) - Trade NFTs securely

These tutorials provide detailed guidance for building real-world Ergo applications. View the [tutorial index](docs/tutorials/README.md) for more information.

## ✅ Key Components

### WalletConnector

A component for connecting to Nautilus wallet with a dropdown menu showing:
- Connection status
- ERG balance
- Preview of tokens with amounts

### WalletDashboard

A dashboard displaying:
- Wallet status and balance overview
- Complete list of tokens with details
- Connect button for non-connected state

### TokensDisplay

A grid display of tokens with:
- Token name
- Token ID (shortened)
- Token amount with proper formatting

## 📚 Resources

- [Fleet SDK Documentation](https://fleet-sdk.github.io/docs/)
- [Ergo Platform](https://ergoplatform.org/en/)
- [Nautilus Wallet](https://chromewebstore.google.com/detail/nautilus-wallet/gjlmehlldlphhljhpnlddaodbjjcchai)
- [Chakra UI Documentation](https://chakra-ui.com/docs/getting-started)

## 🙏 Credits

- Thanks to [@LADOPIXEL](https://github.com/LADOPIXEL) for inspiration
- Built with [Fleet SDK](https://github.com/fleet-sdk) for Ergo blockchain interaction

## 📄 License

MIT