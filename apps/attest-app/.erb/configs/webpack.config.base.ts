/**
 * Base webpack config used across other specific configs
 */

import path from 'path'
import webpack from 'webpack'
import TsconfigPathsPlugins from 'tsconfig-paths-webpack-plugin'
import webpackPaths from './webpack.paths'
import { dependencies as externals } from '../../release/app/package.json'

const monorepoPackagesPath = path.join(webpackPaths.rootPath, '../../packages')

const configuration: webpack.Configuration = {
  externals: [...Object.keys(externals || {})],

  stats: 'errors-only',

  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: [/node_modules/, /\.d\.ts$/],
        use: {
          loader: 'ts-loader',
          options: {
            // Remove this line to enable type checking in webpack builds
            transpileOnly: true,
            compilerOptions: {
              module: 'esnext',
              moduleResolution: 'node',
            },
          },
        },
      },
      // Special rule for mermaid to transpile static blocks
      {
        test: /\.m?js$/,
        include: /node_modules\/mermaid/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', {
                targets: {
                  chrome: '58',
                  firefox: '60',
                  safari: '11',
                  edge: '16',
                  ios: '11',
                  android: '67'
                }
              }]
            ],
            plugins: [
              '@babel/plugin-transform-class-static-block'
            ]
          }
        }
      },
    ],
  },

  output: {
    path: webpackPaths.srcPath,
    // https://github.com/webpack/webpack/issues/1114
    library: {
      type: 'commonjs2',
    },
  },

  /**
   * Determine the array of extensions that should be used to resolve modules.
   */
  resolve: {
    extensions: ['.js', '.jsx', '.json', '.ts', '.tsx'],
    // Map .js imports to .ts/.tsx source files (TypeScript ESM-style imports)
    extensionAlias: {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.jsx': ['.tsx', '.jsx'],
    },
    modules: [webpackPaths.srcPath, 'node_modules'],
    alias: {
      '@repo/packages-attestations': path.join(monorepoPackagesPath, 'attestations/src'),
      '@repo/packages-near-ai-provider': path.join(monorepoPackagesPath, 'near-ai-provider/src'),
      '@repo/packages-utils': path.join(monorepoPackagesPath, 'utils/src'),
    },
    // Polyfill fallbacks for Node.js core modules not available in browser/renderer
    fallback: {
      util: false,
      buffer: require.resolve('buffer/'),
    },
    plugins: [new TsconfigPathsPlugins()],
  },

  plugins: [
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'production',
      CHATBOX_BUILD_TARGET: 'unknown',
      CHATBOX_BUILD_PLATFORM: 'unknown',
      USE_LOCAL_API: '',
    }),
    // Provide Buffer globally for browser compatibility
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
  ],
}

export default configuration
