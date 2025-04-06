import { crx } from '@crxjs/vite-plugin';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig, Plugin } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

import manifest from './src/manifest';

const viteManifestHack: Plugin & {
  renderCrxManifest: (manifest: unknown, bundle: unknown) => void;
} = {
  // Workaround from https://github.com/crxjs/chrome-extension-tools/issues/846#issuecomment-1861880919.
  name: 'manifestHack',
  renderCrxManifest: (_manifest, bundle: any) => {
    bundle['manifest.json'] = bundle['.vite/manifest.json'];
    bundle['manifest.json'].fileName = 'manifest.json';
    delete bundle['.vite/manifest.json'];
  },
};

export default defineConfig(() => {
  return {
    root: __dirname,
    cacheDir: '../../node_modules/.vite/packages/twenty-chrome-extension',

    build: {
      emptyOutDir: true,
      outDir: 'dist',
      rollupOptions: {
        input: {
          'content-script/index': 'src/contentScript/index.ts',
          'content-script/insertSettingsButton': 'src/contentScript/insertSettingsButton.ts',
          'content-script/extractCompanyProfile': 'src/contentScript/extractCompanyProfile.ts',
          'content-script/extractPersonProfile': 'src/contentScript/extractPersonProfile.ts',
          'page-inaccessible': resolve(__dirname, 'page-inaccessible.html'),
        },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
          manualChunks: {
            'twenty-shared': ['twenty-shared'],
            'db': ['src/db/company.db.ts', 'src/db/person.db.ts'],
          },
        },
      },
      target: 'ES2022',
    },

    resolve: {
      alias: {
        'twenty-shared': resolve(__dirname, '../../node_modules/twenty-shared/dist/index.mjs'),
        '~': resolve(__dirname, 'src'),
      },
    },

    // Adding this to fix websocket connection error.
    server: {
      port: 3002,
      strictPort: true,
      hmr: { port: 3002 },
    },

    plugins: [react(), tsconfigPaths(), viteManifestHack, crx({ manifest })],
    optimizeDeps: {
      exclude: ['react-refresh'],
      include: ['twenty-shared'],
    },
  };
});
