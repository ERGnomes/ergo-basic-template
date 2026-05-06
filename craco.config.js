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
  jest: {
    configure: (jestConfig) => {
      jestConfig.transformIgnorePatterns = [
        "[/\\\\]node_modules[/\\\\](?!(@dynamic-labs|zod|@noble|@twobitedd)[/\\\\]).+\\.(js|jsx|mjs|cjs|ts|tsx)$",
      ];
      jestConfig.moduleNameMapper = {
        ...jestConfig.moduleNameMapper,
        "^@twobitedd/ergo-dapp-kit/env$":
          "<rootDir>/node_modules/@twobitedd/ergo-dapp-kit/dist/env.js",
        "^@twobitedd/ergo-dapp-kit/branding$":
          "<rootDir>/node_modules/@twobitedd/ergo-dapp-kit/dist/branding.js",
      };
      return jestConfig;
    },
  },
  webpack: {
    configure: (webpackConfig) => {
      // `@twobitedd/ergo-dapp-kit` ships ESM without explicit `.js` suffixes on
      // relative imports; CRA/webpack 5 treats those as fully-specified modules.
      const kitDist = /[/\\]ergo-dapp-kit[/\\]dist[/\\]/;
      const oneOfRule = webpackConfig.module.rules.find((r) => r && r.oneOf);
      if (oneOfRule && Array.isArray(oneOfRule.oneOf)) {
        oneOfRule.oneOf.unshift({
          test: /\.m?js$/,
          include: kitDist,
          resolve: { fullySpecified: false },
          sideEffects: true,
        });
      }

      webpackConfig.experiments = {
        ...(webpackConfig.experiments || {}),
        asyncWebAssembly: true,
      };

      webpackConfig.module.rules.push({
        test: /\.wasm$/,
        type: "webassembly/async",
      });

      webpackConfig.resolve = webpackConfig.resolve || {};
      // CRA's `oneOf` rule list has a catch-all "file-loader" entry at the
      // end that swallows any extension webpack doesn't recognize as JS,
      // emitting it as a static asset. That breaks `.cjs` modules — for
      // example openapi-fetch's CJS build, which transitively powers the
      // MetaMask analytics client that Dynamic pulls in. Patch the
      // catch-all so `.cjs` is preserved as a JS module.
      if (oneOfRule && Array.isArray(oneOfRule.oneOf)) {
        const fileLoader = oneOfRule.oneOf.find(
          (r) =>
            r &&
            r.type === "asset/resource" &&
            Array.isArray(r.exclude)
        );
        if (fileLoader) {
          fileLoader.exclude = [...fileLoader.exclude, /\.cjs$/];
        }
      }

      webpackConfig.resolve.extensions = [
        ...(webpackConfig.resolve.extensions || []),
        ".cjs",
      ];
      webpackConfig.resolve.alias = {
        ...(webpackConfig.resolve.alias || {}),
        // openapi-fetch ships an ESM "dist/index.js" as `main` and CJS at
        // "dist/cjs/index.cjs" via `exports.require`. CRA's webpack
        // resolves the ESM build by `main`, but @metamask/sdk-analytics
        // is compiled with esbuild's `__toESM(require("openapi-fetch"))`
        // shim that, after webpack interop, leaves `.default` unset.
        // Force the CJS build, which exposes a real `.default` on the
        // module.exports object.
        "openapi-fetch$": require.resolve("openapi-fetch/dist/cjs/index.cjs"),
      };
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
