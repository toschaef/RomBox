import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';
import { spawnSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const binDir = path.join(__dirname, '..', 'bin');
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

const config: ForgeConfig = {
  hooks: {
    generateAssets: async () => {
      if (process.platform === 'darwin') {
        console.log('Building macOS native binaries...');
        const buildScript = path.join(__dirname, '..', 'src', 'native', 'build.sh');
        const result = spawnSync('bash', [buildScript], { stdio: 'inherit' });
        if (result.status !== 0) {
          throw new Error(`Failed to build macOS native binaries. Exit code: ${result.status}`);
        }
      }
    }
  },
  packagerConfig: {
    asar: {
      // Leading `**/` in minimatch does not cross dot-directories (e.g. `.webpack`) by
      // default, so relocated native binaries under `.webpack/**/native_modules/win/...`
      // would silently stay inside the asar (and fail to spawn) without the `{.**,**}` segment.
      unpack: "**/{.**,**}/**/{mac,linux,win}/**/*"
    },
    extraResource: ['./bin']
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      mainConfig,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: './src/index.html',
            js: './src/renderer.tsx',
            name: 'main_window',
            preload: {
              js: './src/preload.ts',
            },
          },
        ],
      },
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: true,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: false,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'toschaef',
          name: 'rombox'
        },
        prerelease: true,
        draft: false
      }
    }
  ]
};

export default config;
