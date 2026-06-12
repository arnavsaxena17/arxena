import * as path from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/twenty-orgchart',

  plugins: [
    tsconfigPaths(),
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
      external: [
        'react',
        'react-dom',
        '@emotion/react',
        '@emotion/styled',
      ],
    },
  },
});
