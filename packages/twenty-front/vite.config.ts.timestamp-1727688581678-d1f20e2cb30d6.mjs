// packages/twenty-front/vite.config.ts
import react from "file:///home/aditya058/Arxena/twenty/node_modules/@vitejs/plugin-react-swc/index.mjs";
import wyw from "file:///home/aditya058/Arxena/twenty/node_modules/@wyw-in-js/vite/esm/index.mjs";
import { defineConfig, loadEnv } from "file:///home/aditya058/Arxena/twenty/node_modules/vite/dist/node/index.js";
import svgr from "file:///home/aditya058/Arxena/twenty/node_modules/vite-plugin-svgr/dist/index.js";
import tsconfigPaths from "file:///home/aditya058/Arxena/twenty/node_modules/vite-tsconfig-paths/dist/index.mjs";
var __vite_injected_original_dirname = "/home/aditya058/Arxena/twenty/packages/twenty-front";
var vite_config_default = defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const { REACT_APP_SERVER_BASE_URL, VITE_BUILD_SOURCEMAP } = env;
  const isBuildCommand = command === "build";
  return {
    root: __vite_injected_original_dirname,
    cacheDir: "../../node_modules/.vite/packages/twenty-front",
    server: {
      port: 3001,
      host: "localhost"
    },
    plugins: [
      react({ jsxImportSource: "@emotion/react" }),
      tsconfigPaths({
        projects: ["tsconfig.json", "../twenty-ui/tsconfig.json"]
      }),
      svgr(),
      {
        name: "configure-response-headers",
        configureServer: (server) => {
          server.middlewares.use((_req, res, next) => {
            res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
            res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
            next();
          });
        }
      },
      // checker(checkers),
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
          "**/RatingInput.tsx"
        ],
        babelOptions: {
          presets: ["@babel/preset-typescript", "@babel/preset-react"]
        }
      })
    ],
    build: {
      outDir: "build",
      sourcemap: VITE_BUILD_SOURCEMAP === "true"
    },
    envPrefix: "REACT_APP_",
    define: {
      "process.env": {
        REACT_APP_SERVER_BASE_URL
      }
    },
    css: {
      modules: {
        localsConvention: "camelCaseOnly"
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsicGFja2FnZXMvdHdlbnR5LWZyb250L3ZpdGUuY29uZmlnLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL2hvbWUvYWRpdHlhMDU4L0FyeGVuYS90d2VudHkvcGFja2FnZXMvdHdlbnR5LWZyb250XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9hZGl0eWEwNTgvQXJ4ZW5hL3R3ZW50eS9wYWNrYWdlcy90d2VudHktZnJvbnQvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2hvbWUvYWRpdHlhMDU4L0FyeGVuYS90d2VudHkvcGFja2FnZXMvdHdlbnR5LWZyb250L3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0LXN3Yyc7XG5pbXBvcnQgd3l3IGZyb20gJ0B3eXctaW4tanMvdml0ZSc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IGRlZmluZUNvbmZpZywgbG9hZEVudiB9IGZyb20gJ3ZpdGUnO1xuaW1wb3J0IGNoZWNrZXIgZnJvbSAndml0ZS1wbHVnaW4tY2hlY2tlcic7XG5pbXBvcnQgc3ZnciBmcm9tICd2aXRlLXBsdWdpbi1zdmdyJztcbmltcG9ydCB0c2NvbmZpZ1BhdGhzIGZyb20gJ3ZpdGUtdHNjb25maWctcGF0aHMnO1xuXG50eXBlIENoZWNrZXJzID0gUGFyYW1ldGVyczx0eXBlb2YgY2hlY2tlcj5bMF07XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBjb21tYW5kLCBtb2RlIH0pID0+IHtcbiAgY29uc3QgZW52ID0gbG9hZEVudihtb2RlLCBwcm9jZXNzLmN3ZCgpLCAnJyk7XG5cbiAgLypcbiAgICBVc2luZyBleHBsaWNpdCBlbnYgdmFyaWFibGVzLCB0aGVyZSBpcyBubyBuZWVkIHRvIGV4cG9zZSBhbGwgb2YgdGhlbSAoc2VjdXJpdHkpLlxuICAqL1xuICBjb25zdCB7IFJFQUNUX0FQUF9TRVJWRVJfQkFTRV9VUkwsIFZJVEVfQlVJTERfU09VUkNFTUFQIH0gPSBlbnY7XG5cbiAgY29uc3QgaXNCdWlsZENvbW1hbmQgPSBjb21tYW5kID09PSAnYnVpbGQnO1xuXG4gIC8vIGNvbnN0IGNoZWNrZXJzOiBDaGVja2VycyA9IHtcbiAgLy8gICB0eXBlc2NyaXB0OiB7XG4gIC8vICAgICB0c2NvbmZpZ1BhdGg6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL3RzY29uZmlnLmFwcC5qc29uJyksXG4gIC8vICAgfSxcbiAgLy8gICBvdmVybGF5OiBmYWxzZSxcbiAgLy8gfTtcblxuICAvLyBpZiAoIWlzQnVpbGRDb21tYW5kKSB7XG4gIC8vICAgY2hlY2tlcnNbJ2VzbGludCddID0ge1xuICAvLyAgICAgbGludENvbW1hbmQ6XG4gIC8vICAgICAgICdlc2xpbnQgLiAtLXJlcG9ydC11bnVzZWQtZGlzYWJsZS1kaXJlY3RpdmVzIC0tbWF4LXdhcm5pbmdzIDAgLS1jb25maWcgLmVzbGludHJjLmNqcycsXG4gIC8vICAgfTtcbiAgLy8gfVxuXG4gIHJldHVybiB7XG4gICAgcm9vdDogX19kaXJuYW1lLFxuICAgIGNhY2hlRGlyOiAnLi4vLi4vbm9kZV9tb2R1bGVzLy52aXRlL3BhY2thZ2VzL3R3ZW50eS1mcm9udCcsXG5cbiAgICBzZXJ2ZXI6IHtcbiAgICAgIHBvcnQ6IDMwMDEsXG4gICAgICBob3N0OiAnbG9jYWxob3N0JyxcbiAgICB9LFxuXG4gICAgcGx1Z2luczogW1xuICAgICAgcmVhY3QoeyBqc3hJbXBvcnRTb3VyY2U6ICdAZW1vdGlvbi9yZWFjdCcgfSksXG4gICAgICB0c2NvbmZpZ1BhdGhzKHtcbiAgICAgICAgcHJvamVjdHM6IFsndHNjb25maWcuanNvbicsICcuLi90d2VudHktdWkvdHNjb25maWcuanNvbiddLFxuICAgICAgfSksXG4gICAgICBzdmdyKCksXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICdjb25maWd1cmUtcmVzcG9uc2UtaGVhZGVycycsXG4gICAgICAgIGNvbmZpZ3VyZVNlcnZlcjogc2VydmVyID0+IHtcbiAgICAgICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKChfcmVxLCByZXMsIG5leHQpID0+IHtcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0Nyb3NzLU9yaWdpbi1FbWJlZGRlci1Qb2xpY3knLCAncmVxdWlyZS1jb3JwJyk7XG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDcm9zcy1PcmlnaW4tT3BlbmVyLVBvbGljeScsICdzYW1lLW9yaWdpbicpO1xuICAgICAgICAgICAgbmV4dCgpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIC8vIGNoZWNrZXIoY2hlY2tlcnMpLFxuICAgICAgLy8gVE9ETzogZml4IHRoaXMsIHdlIGhhdmUgdG8gcmVzdHJpY3QgdGhlIGluY2x1ZGUgdG8gb25seSB0aGUgY29tcG9uZW50cyB0aGF0IGFyZSB1c2luZyBsaW5hcmlhXG4gICAgICAvLyBPdGhlcndpc2UgdGhlIGJ1aWxkIHdpbGwgZmFpbCBiZWNhdXNlIHd5dyB0cmllcyB0byBpbmNsdWRlIGVtb3Rpb24gc3R5bGVkIGNvbXBvbmVudHNcbiAgICAgIHd5dyh7XG4gICAgICAgIGluY2x1ZGU6IFtcbiAgICAgICAgICAnKiovQ3VycmVuY3lEaXNwbGF5LnRzeCcsXG4gICAgICAgICAgJyoqL0VsbGlwc2lzRGlzcGxheS50c3gnLFxuICAgICAgICAgICcqKi9Db250YWN0TGluay50c3gnLFxuICAgICAgICAgICcqKi9Cb29sZWFuRGlzcGxheS50c3gnLFxuICAgICAgICAgICcqKi9MaW5rc0Rpc3BsYXkudHN4JyxcbiAgICAgICAgICAnKiovUm91bmRlZExpbmsudHN4JyxcbiAgICAgICAgICAnKiovT3ZlcmZsb3dpbmdUZXh0V2l0aFRvb2x0aXAudHN4JyxcbiAgICAgICAgICAnKiovQ2hpcC50c3gnLFxuICAgICAgICAgICcqKi9UYWcudHN4JyxcbiAgICAgICAgICAnKiovTXVsdGlTZWxlY3RGaWVsZERpc3BsYXkudHN4JyxcbiAgICAgICAgICAnKiovUmF0aW5nSW5wdXQudHN4JyxcbiAgICAgICAgXSxcbiAgICAgICAgYmFiZWxPcHRpb25zOiB7XG4gICAgICAgICAgcHJlc2V0czogWydAYmFiZWwvcHJlc2V0LXR5cGVzY3JpcHQnLCAnQGJhYmVsL3ByZXNldC1yZWFjdCddLFxuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgXSxcblxuICAgIGJ1aWxkOiB7XG4gICAgICBvdXREaXI6ICdidWlsZCcsXG4gICAgICBzb3VyY2VtYXA6IFZJVEVfQlVJTERfU09VUkNFTUFQID09PSAndHJ1ZScsXG4gICAgfSxcblxuICAgIGVudlByZWZpeDogJ1JFQUNUX0FQUF8nLFxuXG4gICAgZGVmaW5lOiB7XG4gICAgICAncHJvY2Vzcy5lbnYnOiB7XG4gICAgICAgIFJFQUNUX0FQUF9TRVJWRVJfQkFTRV9VUkwsXG4gICAgICB9LFxuICAgIH0sXG4gICAgY3NzOiB7XG4gICAgICBtb2R1bGVzOiB7XG4gICAgICAgIGxvY2Fsc0NvbnZlbnRpb246ICdjYW1lbENhc2VPbmx5JyxcbiAgICAgIH0sXG4gICAgfSxcbiAgfTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUEyVSxPQUFPLFdBQVc7QUFDN1YsT0FBTyxTQUFTO0FBRWhCLFNBQVMsY0FBYyxlQUFlO0FBRXRDLE9BQU8sVUFBVTtBQUNqQixPQUFPLG1CQUFtQjtBQU4xQixJQUFNLG1DQUFtQztBQVV6QyxJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLFNBQVMsS0FBSyxNQUFNO0FBQ2pELFFBQU0sTUFBTSxRQUFRLE1BQU0sUUFBUSxJQUFJLEdBQUcsRUFBRTtBQUszQyxRQUFNLEVBQUUsMkJBQTJCLHFCQUFxQixJQUFJO0FBRTVELFFBQU0saUJBQWlCLFlBQVk7QUFnQm5DLFNBQU87QUFBQSxJQUNMLE1BQU07QUFBQSxJQUNOLFVBQVU7QUFBQSxJQUVWLFFBQVE7QUFBQSxNQUNOLE1BQU07QUFBQSxNQUNOLE1BQU07QUFBQSxJQUNSO0FBQUEsSUFFQSxTQUFTO0FBQUEsTUFDUCxNQUFNLEVBQUUsaUJBQWlCLGlCQUFpQixDQUFDO0FBQUEsTUFDM0MsY0FBYztBQUFBLFFBQ1osVUFBVSxDQUFDLGlCQUFpQiw0QkFBNEI7QUFBQSxNQUMxRCxDQUFDO0FBQUEsTUFDRCxLQUFLO0FBQUEsTUFDTDtBQUFBLFFBQ0UsTUFBTTtBQUFBLFFBQ04saUJBQWlCLFlBQVU7QUFDekIsaUJBQU8sWUFBWSxJQUFJLENBQUMsTUFBTSxLQUFLLFNBQVM7QUFDMUMsZ0JBQUksVUFBVSxnQ0FBZ0MsY0FBYztBQUM1RCxnQkFBSSxVQUFVLDhCQUE4QixhQUFhO0FBQ3pELGlCQUFLO0FBQUEsVUFDUCxDQUFDO0FBQUEsUUFDSDtBQUFBLE1BQ0Y7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQUlBLElBQUk7QUFBQSxRQUNGLFNBQVM7QUFBQSxVQUNQO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFFBQ0Y7QUFBQSxRQUNBLGNBQWM7QUFBQSxVQUNaLFNBQVMsQ0FBQyw0QkFBNEIscUJBQXFCO0FBQUEsUUFDN0Q7QUFBQSxNQUNGLENBQUM7QUFBQSxJQUNIO0FBQUEsSUFFQSxPQUFPO0FBQUEsTUFDTCxRQUFRO0FBQUEsTUFDUixXQUFXLHlCQUF5QjtBQUFBLElBQ3RDO0FBQUEsSUFFQSxXQUFXO0FBQUEsSUFFWCxRQUFRO0FBQUEsTUFDTixlQUFlO0FBQUEsUUFDYjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsSUFDQSxLQUFLO0FBQUEsTUFDSCxTQUFTO0FBQUEsUUFDUCxrQkFBa0I7QUFBQSxNQUNwQjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
