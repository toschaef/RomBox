import type { Configuration } from 'webpack';

import { rules } from './webpack.rules';
import { plugins } from './webpack.plugins';

// on win32, @vercel/webpack-asset-relocator-loader fails to inject the
// __webpack_require__.ab path it needs to locate native addons at runtime,
// so better-sqlite3 must be excluded from bundling there (see webpack.rules.ts)
export const mainConfig: Configuration = {
  entry: './src/main/main.ts',
  module: {
    rules,
  },
  plugins,
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
  },
  ...(process.platform === 'win32' && {
    externals: {
      'better-sqlite3': 'commonjs better-sqlite3',
    },
  }),
};
