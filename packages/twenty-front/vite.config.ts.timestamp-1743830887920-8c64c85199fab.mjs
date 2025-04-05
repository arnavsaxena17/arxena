// packages/twenty-front/vite.config.ts
import { lingui } from "file:///Users/arnavsaxena/arxena/twenty/node_modules/@lingui/vite-plugin/dist/index.cjs";
import { isNonEmptyString } from "file:///Users/arnavsaxena/arxena/twenty/node_modules/@sniptt/guards/build/index.js";
import react from "file:///Users/arnavsaxena/arxena/twenty/node_modules/@vitejs/plugin-react-swc/index.mjs";
import wyw from "file:///Users/arnavsaxena/arxena/twenty/node_modules/@wyw-in-js/vite/esm/index.mjs";
import fs from "fs";
import path from "path";
import { defineConfig, loadEnv, searchForWorkspaceRoot } from "file:///Users/arnavsaxena/arxena/twenty/node_modules/vite/dist/node/index.js";
import checker from "file:///Users/arnavsaxena/arxena/twenty/node_modules/vite-plugin-checker/dist/esm/main.js";
import svgr from "file:///Users/arnavsaxena/arxena/twenty/node_modules/vite-plugin-svgr/dist/index.js";
import tsconfigPaths from "file:///Users/arnavsaxena/arxena/twenty/node_modules/vite-tsconfig-paths/dist/index.mjs";
var __vite_injected_original_dirname = "/Users/arnavsaxena/arxena/twenty/packages/twenty-front";
var vite_config_default = defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const {
    REACT_APP_SERVER_BASE_URL,
    VITE_BUILD_SOURCEMAP,
    VITE_DISABLE_TYPESCRIPT_CHECKER,
    VITE_DISABLE_ESLINT_CHECKER,
    VITE_HOST,
    SSL_CERT_PATH,
    SSL_KEY_PATH,
    REACT_APP_PORT
  } = env;
  const port = isNonEmptyString(REACT_APP_PORT) ? parseInt(REACT_APP_PORT) : 3001;
  const isBuildCommand = command === "build";
  const tsConfigPath = isBuildCommand ? path.resolve(__vite_injected_original_dirname, "./tsconfig.build.json") : path.resolve(__vite_injected_original_dirname, "./tsconfig.dev.json");
  const checkers = {
    overlay: false
  };
  if (VITE_DISABLE_TYPESCRIPT_CHECKER === "true") {
    console.log(
      `VITE_DISABLE_TYPESCRIPT_CHECKER: ${VITE_DISABLE_TYPESCRIPT_CHECKER}`
    );
  }
  if (VITE_DISABLE_ESLINT_CHECKER === "true") {
    console.log(`VITE_DISABLE_ESLINT_CHECKER: ${VITE_DISABLE_ESLINT_CHECKER}`);
  }
  if (VITE_BUILD_SOURCEMAP === "true") {
    console.log(`VITE_BUILD_SOURCEMAP: ${VITE_BUILD_SOURCEMAP}`);
  }
  if (VITE_DISABLE_TYPESCRIPT_CHECKER !== "true") {
    checkers["typescript"] = {
      tsconfigPath: tsConfigPath
    };
  }
  if (VITE_DISABLE_ESLINT_CHECKER !== "true") {
    checkers["eslint"] = {
      lintCommand: "cd ../.. && eslint packages/twenty-front --report-unused-disable-directives --max-warnings 0 --config .eslintrc.cjs"
    };
  }
  return {
    root: __vite_injected_original_dirname,
    cacheDir: "../../node_modules/.vite/packages/twenty-front",
    server: {
      port,
      ...VITE_HOST ? { host: VITE_HOST } : {},
      ...SSL_KEY_PATH && SSL_CERT_PATH ? {
        protocol: "https",
        https: {
          key: fs.readFileSync(env.SSL_KEY_PATH),
          cert: fs.readFileSync(env.SSL_CERT_PATH)
        }
      } : {
        protocol: "http"
      },
      fs: {
        allow: [
          searchForWorkspaceRoot(process.cwd()),
          "**/@blocknote/core/src/fonts/**"
        ]
      }
    },
    plugins: [
      react({
        jsxImportSource: "@emotion/react",
        plugins: [["@lingui/swc-plugin", {}]]
      }),
      tsconfigPaths({
        projects: ["tsconfig.json", "../twenty-ui/tsconfig.json"]
      }),
      svgr(),
      lingui({
        configPath: path.resolve(__vite_injected_original_dirname, "./lingui.config.ts")
      }),
      checker(checkers),
      // TODO: fix this, we have to restrict the include to only the components that are using linaria
      // Otherwise the build will fail because wyw tries to include emotion styled components
      wyw({
        include: [
          "**/CurrencyDisplay.tsx",
          "**/EllipsisDisplay.tsx",
          "**/ContactLink.tsx",
          "**/BooleanDisplay.tsx",
          "**/LinksDisplay.tsx",
          "**/RoundedLink.tsx",
          "**/OverflowingTextWithTooltip.tsx",
          "**/Chip.tsx",
          "**/Tag.tsx",
          "**/MultiSelectFieldDisplay.tsx",
          "**/RatingInput.tsx",
          "**/RecordTableCellContainer.tsx",
          "**/RecordTableCellDisplayContainer.tsx",
          "**/Avatar.tsx",
          "**/RecordTableBodyDroppable.tsx",
          "**/RecordTableCellBaseContainer.tsx",
          "**/RecordTableCellTd.tsx",
          "**/RecordTableTd.tsx",
          "**/RecordTableHeaderDragDropColumn.tsx",
          "**/ActorDisplay.tsx",
          "**/AvatarChip.tsx"
        ],
        babelOptions: {
          presets: ["@babel/preset-typescript", "@babel/preset-react"]
        }
      })
    ],
    optimizeDeps: {
      exclude: ["../../node_modules/.vite", "../../node_modules/.cache"],
      include: ["react", "react-dom"],
      // Force exclude GoJS to prevent bundling issues
      force: true
    },
    build: {
      outDir: "build",
      sourcemap: VITE_BUILD_SOURCEMAP === "true",
      rollupOptions: {
        output: {
          manualChunks: {
            // Create a separate chunk for GoJS
            "gojs-vendor": ["gojs"],
            "gojs-react-vendor": ["gojs-react"],
            // Group major React libraries
            "react-vendor": [
              "react",
              "react-dom",
              "react-router-dom",
              "@emotion/react",
              "@emotion/styled"
            ],
            // Group utilities
            "utils-vendor": [
              "lodash",
              "date-fns"
              // other utility libraries
            ]
          }
        }
      },
      chunkSizeWarningLimit: 1500
    },
    envPrefix: "REACT_APP_",
    define: {
      _env_: {
        REACT_APP_SERVER_BASE_URL
      },
      "process.env": {
        REACT_APP_SERVER_BASE_URL
      }
    },
    css: {
      modules: {
        localsConvention: "camelCaseOnly"
      }
    },
    resolve: {
      alias: {
        path: "rollup-plugin-node-polyfills/polyfills/path"
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsicGFja2FnZXMvdHdlbnR5LWZyb250L3ZpdGUuY29uZmlnLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL1VzZXJzL2FybmF2c2F4ZW5hL2FyeGVuYS90d2VudHkvcGFja2FnZXMvdHdlbnR5LWZyb250XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvYXJuYXZzYXhlbmEvYXJ4ZW5hL3R3ZW50eS9wYWNrYWdlcy90d2VudHktZnJvbnQvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL2FybmF2c2F4ZW5hL2FyeGVuYS90d2VudHkvcGFja2FnZXMvdHdlbnR5LWZyb250L3ZpdGUuY29uZmlnLnRzXCI7LyogZXNsaW50LWRpc2FibGUgbm8tY29uc29sZSAqL1xuaW1wb3J0IHsgbGluZ3VpIH0gZnJvbSAnQGxpbmd1aS92aXRlLXBsdWdpbic7XG5pbXBvcnQgeyBpc05vbkVtcHR5U3RyaW5nIH0gZnJvbSAnQHNuaXB0dC9ndWFyZHMnO1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0LXN3Yyc7XG5pbXBvcnQgd3l3IGZyb20gJ0B3eXctaW4tanMvdml0ZSc7XG5pbXBvcnQgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBkZWZpbmVDb25maWcsIGxvYWRFbnYsIHNlYXJjaEZvcldvcmtzcGFjZVJvb3QgfSBmcm9tICd2aXRlJztcbmltcG9ydCBjaGVja2VyIGZyb20gJ3ZpdGUtcGx1Z2luLWNoZWNrZXInO1xuaW1wb3J0IHN2Z3IgZnJvbSAndml0ZS1wbHVnaW4tc3Zncic7XG5pbXBvcnQgdHNjb25maWdQYXRocyBmcm9tICd2aXRlLXRzY29uZmlnLXBhdGhzJztcblxudHlwZSBDaGVja2VycyA9IFBhcmFtZXRlcnM8dHlwZW9mIGNoZWNrZXI+WzBdO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgY29tbWFuZCwgbW9kZSB9KSA9PiB7XG4gIGNvbnN0IGVudiA9IGxvYWRFbnYobW9kZSwgcHJvY2Vzcy5jd2QoKSwgJycpO1xuXG4gIGNvbnN0IHtcbiAgICBSRUFDVF9BUFBfU0VSVkVSX0JBU0VfVVJMLFxuICAgIFZJVEVfQlVJTERfU09VUkNFTUFQLFxuICAgIFZJVEVfRElTQUJMRV9UWVBFU0NSSVBUX0NIRUNLRVIsXG4gICAgVklURV9ESVNBQkxFX0VTTElOVF9DSEVDS0VSLFxuICAgIFZJVEVfSE9TVCxcbiAgICBTU0xfQ0VSVF9QQVRILFxuICAgIFNTTF9LRVlfUEFUSCxcbiAgICBSRUFDVF9BUFBfUE9SVCxcbiAgfSA9IGVudjtcblxuICBjb25zdCBwb3J0ID0gaXNOb25FbXB0eVN0cmluZyhSRUFDVF9BUFBfUE9SVClcbiAgICA/IHBhcnNlSW50KFJFQUNUX0FQUF9QT1JUKVxuICAgIDogMzAwMTtcblxuICBjb25zdCBpc0J1aWxkQ29tbWFuZCA9IGNvbW1hbmQgPT09ICdidWlsZCc7XG5cbiAgY29uc3QgdHNDb25maWdQYXRoID0gaXNCdWlsZENvbW1hbmRcbiAgICA/IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL3RzY29uZmlnLmJ1aWxkLmpzb24nKVxuICAgIDogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vdHNjb25maWcuZGV2Lmpzb24nKTtcblxuICBjb25zdCBjaGVja2VyczogQ2hlY2tlcnMgPSB7XG4gICAgb3ZlcmxheTogZmFsc2UsXG4gIH07XG5cbiAgaWYgKFZJVEVfRElTQUJMRV9UWVBFU0NSSVBUX0NIRUNLRVIgPT09ICd0cnVlJykge1xuICAgIGNvbnNvbGUubG9nKFxuICAgICAgYFZJVEVfRElTQUJMRV9UWVBFU0NSSVBUX0NIRUNLRVI6ICR7VklURV9ESVNBQkxFX1RZUEVTQ1JJUFRfQ0hFQ0tFUn1gLFxuICAgICk7XG4gIH1cblxuICBpZiAoVklURV9ESVNBQkxFX0VTTElOVF9DSEVDS0VSID09PSAndHJ1ZScpIHtcbiAgICBjb25zb2xlLmxvZyhgVklURV9ESVNBQkxFX0VTTElOVF9DSEVDS0VSOiAke1ZJVEVfRElTQUJMRV9FU0xJTlRfQ0hFQ0tFUn1gKTtcbiAgfVxuXG4gIGlmIChWSVRFX0JVSUxEX1NPVVJDRU1BUCA9PT0gJ3RydWUnKSB7XG4gICAgY29uc29sZS5sb2coYFZJVEVfQlVJTERfU09VUkNFTUFQOiAke1ZJVEVfQlVJTERfU09VUkNFTUFQfWApO1xuICB9XG5cbiAgaWYgKFZJVEVfRElTQUJMRV9UWVBFU0NSSVBUX0NIRUNLRVIgIT09ICd0cnVlJykge1xuICAgIGNoZWNrZXJzWyd0eXBlc2NyaXB0J10gPSB7XG4gICAgICB0c2NvbmZpZ1BhdGg6IHRzQ29uZmlnUGF0aCxcbiAgICB9O1xuICB9XG5cbiAgaWYgKFZJVEVfRElTQUJMRV9FU0xJTlRfQ0hFQ0tFUiAhPT0gJ3RydWUnKSB7XG4gICAgY2hlY2tlcnNbJ2VzbGludCddID0ge1xuICAgICAgbGludENvbW1hbmQ6XG4gICAgICAgICdjZCAuLi8uLiAmJiBlc2xpbnQgcGFja2FnZXMvdHdlbnR5LWZyb250IC0tcmVwb3J0LXVudXNlZC1kaXNhYmxlLWRpcmVjdGl2ZXMgLS1tYXgtd2FybmluZ3MgMCAtLWNvbmZpZyAuZXNsaW50cmMuY2pzJyxcbiAgICB9O1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICByb290OiBfX2Rpcm5hbWUsXG4gICAgY2FjaGVEaXI6ICcuLi8uLi9ub2RlX21vZHVsZXMvLnZpdGUvcGFja2FnZXMvdHdlbnR5LWZyb250JyxcblxuICAgIHNlcnZlcjoge1xuICAgICAgcG9ydDogcG9ydCxcbiAgICAgIC4uLihWSVRFX0hPU1QgPyB7IGhvc3Q6IFZJVEVfSE9TVCB9IDoge30pLFxuICAgICAgLi4uKFNTTF9LRVlfUEFUSCAmJiBTU0xfQ0VSVF9QQVRIXG4gICAgICAgID8ge1xuICAgICAgICAgICAgcHJvdG9jb2w6ICdodHRwcycsXG4gICAgICAgICAgICBodHRwczoge1xuICAgICAgICAgICAgICBrZXk6IGZzLnJlYWRGaWxlU3luYyhlbnYuU1NMX0tFWV9QQVRIKSxcbiAgICAgICAgICAgICAgY2VydDogZnMucmVhZEZpbGVTeW5jKGVudi5TU0xfQ0VSVF9QQVRIKSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfVxuICAgICAgICA6IHtcbiAgICAgICAgICAgIHByb3RvY29sOiAnaHR0cCcsXG4gICAgICAgICAgfSksXG4gICAgICBmczoge1xuICAgICAgICBhbGxvdzogW1xuICAgICAgICAgIHNlYXJjaEZvcldvcmtzcGFjZVJvb3QocHJvY2Vzcy5jd2QoKSksXG4gICAgICAgICAgJyoqL0BibG9ja25vdGUvY29yZS9zcmMvZm9udHMvKionLFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICB9LFxuXG4gICAgcGx1Z2luczogW1xuICAgICAgcmVhY3Qoe1xuICAgICAgICBqc3hJbXBvcnRTb3VyY2U6ICdAZW1vdGlvbi9yZWFjdCcsXG4gICAgICAgIHBsdWdpbnM6IFtbJ0BsaW5ndWkvc3djLXBsdWdpbicsIHt9XV0sXG4gICAgICB9KSxcbiAgICAgIHRzY29uZmlnUGF0aHMoe1xuICAgICAgICBwcm9qZWN0czogWyd0c2NvbmZpZy5qc29uJywgJy4uL3R3ZW50eS11aS90c2NvbmZpZy5qc29uJ10sXG4gICAgICB9KSxcbiAgICAgIHN2Z3IoKSxcbiAgICAgIGxpbmd1aSh7XG4gICAgICAgIGNvbmZpZ1BhdGg6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL2xpbmd1aS5jb25maWcudHMnKSxcbiAgICAgIH0pLFxuICAgICAgY2hlY2tlcihjaGVja2VycyksXG4gICAgICAvLyBUT0RPOiBmaXggdGhpcywgd2UgaGF2ZSB0byByZXN0cmljdCB0aGUgaW5jbHVkZSB0byBvbmx5IHRoZSBjb21wb25lbnRzIHRoYXQgYXJlIHVzaW5nIGxpbmFyaWFcbiAgICAgIC8vIE90aGVyd2lzZSB0aGUgYnVpbGQgd2lsbCBmYWlsIGJlY2F1c2Ugd3l3IHRyaWVzIHRvIGluY2x1ZGUgZW1vdGlvbiBzdHlsZWQgY29tcG9uZW50c1xuICAgICAgd3l3KHtcbiAgICAgICAgaW5jbHVkZTogW1xuICAgICAgICAgICcqKi9DdXJyZW5jeURpc3BsYXkudHN4JyxcbiAgICAgICAgICAnKiovRWxsaXBzaXNEaXNwbGF5LnRzeCcsXG4gICAgICAgICAgJyoqL0NvbnRhY3RMaW5rLnRzeCcsXG4gICAgICAgICAgJyoqL0Jvb2xlYW5EaXNwbGF5LnRzeCcsXG4gICAgICAgICAgJyoqL0xpbmtzRGlzcGxheS50c3gnLFxuICAgICAgICAgICcqKi9Sb3VuZGVkTGluay50c3gnLFxuICAgICAgICAgICcqKi9PdmVyZmxvd2luZ1RleHRXaXRoVG9vbHRpcC50c3gnLFxuICAgICAgICAgICcqKi9DaGlwLnRzeCcsXG4gICAgICAgICAgJyoqL1RhZy50c3gnLFxuICAgICAgICAgICcqKi9NdWx0aVNlbGVjdEZpZWxkRGlzcGxheS50c3gnLFxuICAgICAgICAgICcqKi9SYXRpbmdJbnB1dC50c3gnLFxuICAgICAgICAgICcqKi9SZWNvcmRUYWJsZUNlbGxDb250YWluZXIudHN4JyxcbiAgICAgICAgICAnKiovUmVjb3JkVGFibGVDZWxsRGlzcGxheUNvbnRhaW5lci50c3gnLFxuICAgICAgICAgICcqKi9BdmF0YXIudHN4JyxcbiAgICAgICAgICAnKiovUmVjb3JkVGFibGVCb2R5RHJvcHBhYmxlLnRzeCcsXG4gICAgICAgICAgJyoqL1JlY29yZFRhYmxlQ2VsbEJhc2VDb250YWluZXIudHN4JyxcbiAgICAgICAgICAnKiovUmVjb3JkVGFibGVDZWxsVGQudHN4JyxcbiAgICAgICAgICAnKiovUmVjb3JkVGFibGVUZC50c3gnLFxuICAgICAgICAgICcqKi9SZWNvcmRUYWJsZUhlYWRlckRyYWdEcm9wQ29sdW1uLnRzeCcsXG4gICAgICAgICAgJyoqL0FjdG9yRGlzcGxheS50c3gnLFxuICAgICAgICAgICcqKi9BdmF0YXJDaGlwLnRzeCcsXG4gICAgICAgIF0sXG4gICAgICAgIGJhYmVsT3B0aW9uczoge1xuICAgICAgICAgIHByZXNldHM6IFsnQGJhYmVsL3ByZXNldC10eXBlc2NyaXB0JywgJ0BiYWJlbC9wcmVzZXQtcmVhY3QnXSxcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgIF0sXG5cbiAgICBvcHRpbWl6ZURlcHM6IHtcbiAgICAgIGV4Y2x1ZGU6IFsnLi4vLi4vbm9kZV9tb2R1bGVzLy52aXRlJywgJy4uLy4uL25vZGVfbW9kdWxlcy8uY2FjaGUnXSxcbiAgICAgIGluY2x1ZGU6IFsncmVhY3QnLCAncmVhY3QtZG9tJ10sXG4gICAgICAvLyBGb3JjZSBleGNsdWRlIEdvSlMgdG8gcHJldmVudCBidW5kbGluZyBpc3N1ZXNcbiAgICAgIGZvcmNlOiB0cnVlLFxuXG4gICAgfSxcblxuICAgIGJ1aWxkOiB7XG4gICAgICBvdXREaXI6ICdidWlsZCcsXG4gICAgICBzb3VyY2VtYXA6IFZJVEVfQlVJTERfU09VUkNFTUFQID09PSAndHJ1ZScsXG4gICAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICAgIG91dHB1dDoge1xuICAgICAgICAgIG1hbnVhbENodW5rczoge1xuICAgICAgICAgICAgLy8gQ3JlYXRlIGEgc2VwYXJhdGUgY2h1bmsgZm9yIEdvSlNcbiAgICAgICAgICAgICdnb2pzLXZlbmRvcic6IFsnZ29qcyddLFxuICAgICAgICAgICAgJ2dvanMtcmVhY3QtdmVuZG9yJzogWydnb2pzLXJlYWN0J10sXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEdyb3VwIG1ham9yIFJlYWN0IGxpYnJhcmllc1xuICAgICAgICAgICAgJ3JlYWN0LXZlbmRvcic6IFtcbiAgICAgICAgICAgICAgJ3JlYWN0JywgXG4gICAgICAgICAgICAgICdyZWFjdC1kb20nLCBcbiAgICAgICAgICAgICAgJ3JlYWN0LXJvdXRlci1kb20nLFxuICAgICAgICAgICAgICAnQGVtb3Rpb24vcmVhY3QnLFxuICAgICAgICAgICAgICAnQGVtb3Rpb24vc3R5bGVkJ1xuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gR3JvdXAgdXRpbGl0aWVzXG4gICAgICAgICAgICAndXRpbHMtdmVuZG9yJzogW1xuICAgICAgICAgICAgICAnbG9kYXNoJyxcbiAgICAgICAgICAgICAgJ2RhdGUtZm5zJyxcbiAgICAgICAgICAgICAgLy8gb3RoZXIgdXRpbGl0eSBsaWJyYXJpZXNcbiAgICAgICAgICAgIF1cbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcblxuXG5cblxuICAgICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiAxNTAwLFxuXG4gICAgfSxcblxuICAgIGVudlByZWZpeDogJ1JFQUNUX0FQUF8nLFxuXG4gICAgZGVmaW5lOiB7XG4gICAgICBfZW52Xzoge1xuICAgICAgICBSRUFDVF9BUFBfU0VSVkVSX0JBU0VfVVJMLFxuICAgICAgfSxcbiAgICAgICdwcm9jZXNzLmVudic6IHtcbiAgICAgICAgUkVBQ1RfQVBQX1NFUlZFUl9CQVNFX1VSTCxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBjc3M6IHtcbiAgICAgIG1vZHVsZXM6IHtcbiAgICAgICAgbG9jYWxzQ29udmVudGlvbjogJ2NhbWVsQ2FzZU9ubHknLFxuICAgICAgfSxcbiAgICB9LFxuICAgIHJlc29sdmU6IHtcbiAgICAgIGFsaWFzOiB7XG4gICAgICAgIHBhdGg6ICdyb2xsdXAtcGx1Z2luLW5vZGUtcG9seWZpbGxzL3BvbHlmaWxscy9wYXRoJyxcbiAgICAgIH0sXG4gICAgfSxcbiAgfTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUNBLFNBQVMsY0FBYztBQUN2QixTQUFTLHdCQUF3QjtBQUNqQyxPQUFPLFdBQVc7QUFDbEIsT0FBTyxTQUFTO0FBQ2hCLE9BQU8sUUFBUTtBQUNmLE9BQU8sVUFBVTtBQUNqQixTQUFTLGNBQWMsU0FBUyw4QkFBOEI7QUFDOUQsT0FBTyxhQUFhO0FBQ3BCLE9BQU8sVUFBVTtBQUNqQixPQUFPLG1CQUFt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
