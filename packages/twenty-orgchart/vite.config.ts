import * as path from 'path';

import react from '@vitejs/plugin-react-swc';
import wyw from '@wyw-in-js/vite';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/twenty-orgchart',

  plugins: [
    tsconfigPaths(),
    react(),
    wyw({
      include: [path.resolve(__dirname, 'src') + '/**/*.{ts,tsx}'],
      babelOptions: {
        presets: ['@babel/preset-typescript', '@babel/preset-react'],
      },
    }),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(__dirname, 'tsconfig.lib.json'),
    }),
  ],

  build: {
    outDir: './dist',
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      entry: {
        index: 'src/index.ts',
        'company-search': 'src/company-search.ts',
        'orgchart-core': 'src/orgchart-core.ts',
      },
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      // Bundle gojs/gojs-react so Next.js consumers never re-parse release/go.js via SWC.
      // Patched node_modules/gojs (postinstall patch-gojs.cjs) is inlined at this build step.
      // Match package roots and subpaths (react/jsx-runtime, twenty-shared/utils, …).
      // Exact-only externals previously bundled a second jsx-runtime into company-search,
      // which crashes Next.js with "Cannot update HotReload while rendering".
      external: (id: string) =>
        [
          'react',
          'react-dom',
          '@linaria/react',
          'twenty-ui',
          'twenty-shared',
          '@tabler/icons-react',
          'use-debounce',
        ].some((dep) => id === dep || id.startsWith(`${dep}/`)),
    },
  },
});
