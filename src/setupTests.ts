// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom"
import { TextDecoder, TextEncoder } from "util"

// React Router 7 expects Web APIs that jsdom does not provide by default.
Object.assign(globalThis, { TextDecoder, TextEncoder })

const matchMediaPolyfill = (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
})

// jsdom's matchMedia can be incomplete; Chakra + framer-motion need addListener.
delete (window as { matchMedia?: typeof window.matchMedia }).matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,
  value: matchMediaPolyfill,
})
