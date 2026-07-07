import * as path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/twenty-orgchart-embed',
  plugins: [react()],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'arxenaOrgChartInline',
      formats: ['iife'],
      fileName: () => 'arxena-orgchart.inline.js',
    },
    rollupOptions: {
      output: {
        extend: true,
      },
    },
  },
});
