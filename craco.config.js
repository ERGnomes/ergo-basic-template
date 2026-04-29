/**
 * CRACO configuration to enable WebAssembly (used by ergo-lib-wasm-browser)
 * and to provide Node-style polyfills the Dynamic SDK expects in the browser.
 *
 * The Dynamic Labs SDK and several of its transitive dependencies (e.g.
 * WalletConnect) reference Node built-ins (Buffer, process, stream, ...).
 * CRA 5 / webpack 5 does not polyfill these by default, so we add fallbacks.
 */

const webpack = require("webpack");

module.exports = {
  babel: {
    plugins: [require.resolve("@babel/plugin-syntax-import-attributes")],
  },
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.experiments = {
        ...(webpackConfig.experiments || {}),
        asyncWebAssembly: true,
      };

      webpackConfig.module.rules.push({
        test: /\.wasm$/,
        type: "webassembly/async",
      });

      webpackConfig.resolve = webpackConfig.resolve || {};
      webpackConfig.resolve.fallback = {
        ...(webpackConfig.resolve.fallback || {}),
        buffer: require.resolve("buffer/"),
        process: require.resolve("process/browser.js"),
        stream: require.resolve("stream-browserify"),
        crypto: require.resolve("crypto-browserify"),
        assert: require.resolve("assert/"),
        http: require.resolve("stream-http"),
        https: require.resolve("https-browserify"),
        os: require.resolve("os-browserify/browser"),
        url: require.resolve("url/"),
        zlib: require.resolve("browserify-zlib"),
        path: require.resolve("path-browserify"),
        vm: require.resolve("vm-browserify"),
        fs: false,
        net: false,
        tls: false,
        child_process: false,
        // React-Native-only optional dep used by some MetaMask/WalletConnect
        // transitive packages. Stub out so the bundler doesn't fail.
        "@react-native-async-storage/async-storage": false,
      };

      webpackConfig.plugins = [
        ...(webpackConfig.plugins || []),
        new webpack.ProvidePlugin({
          Buffer: ["buffer", "Buffer"],
          process: "process/browser.js",
        }),
      ];

      webpackConfig.ignoreWarnings = [
        ...(webpackConfig.ignoreWarnings || []),
        /Failed to parse source map/,
      ];

      return webpackConfig;
    },
  },
};
