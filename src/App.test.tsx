import React from "react"
import { screen } from "@testing-library/react"
import { render } from "./test-utils"

jest.mock("./lib/DynamicProvider", () => ({
  DynamicProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

jest.mock("./context/WalletContext", () => {
  const defaultWalletData = {
    isConnected: false,
    ergBalance: "0",
    tokens: [],
    walletStatus: "Not connected",
  }
  return {
    WalletProvider: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    useWallet: () => ({
      walletData: defaultWalletData,
      connectToWallet: async () => {},
      connectWithNautilusDirect: async () => {},
      connectPrimaryWallet: async () => {},
      disconnectFromWallet: async () => {},
      refreshWallet: async () => {},
      ergoAddress: null,
      source: null,
      setAutoConnect: () => {},
      autoConnectEnabled: false,
    }),
  }
})

jest.mock("./components/ErgoWallet", () => ({
  ErgoWallet: () => <div data-testid="ergo-wallet-mock" />,
}))

jest.mock("./components/games/TicTacToePage", () => ({
  TicTacToePage: () => <div data-testid="tic-tac-toe-mock" />,
}))

const { App } = require("./App")

test("renders app shell with dashboard route", () => {
  render(<App />)
  expect(screen.getByRole("heading", { name: /Ergo Wallet Explorer/i })).toBeInTheDocument()
  expect(screen.getByText("Dashboard")).toBeInTheDocument()
})
