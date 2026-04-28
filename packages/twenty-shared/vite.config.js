"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const vite_1 = require("vite");
const vite_plugin_dts_1 = require("vite-plugin-dts");
const vite_tsconfig_paths_1 = require("vite-tsconfig-paths");
exports.default = (0, vite_1.defineConfig)({
    root: __dirname,
    cacheDir: '../../node_modules/.vite/packages/twenty-shared',
    plugins: [
        (0, vite_tsconfig_paths_1.default)(),
        (0, vite_plugin_dts_1.default)({
            entryRoot: 'src',
            tsconfigPath: path.join(__dirname, 'tsconfig.lib.json'),
        }),
    ],
    // Configuration for building your library.
    // See: https://vitejs.dev/guide/build.html#library-mode
    build: {
        outDir: './dist',
        reportCompressedSize: true,
        commonjsOptions: {
            transformMixedEsModules: true,
        },
        lib: {
            entry: 'src/index.ts',
            name: 'twenty-shared',
            fileName: 'index',
            formats: ['es', 'cjs'],
        },
    },
});
//# sourceMappingURL=vite.config.js.map