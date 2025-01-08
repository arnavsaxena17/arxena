import react from '@vitejs/plugin-react-swc';
import wyw from '@wyw-in-js/vite';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import checker from 'vite-plugin-checker';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';

type Checkers = Parameters<typeof checker>[0];

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  /*
    Using explicit env variables, there is no need to expose all of them (security).
  */
  const { REACT_APP_SERVER_BASE_URL, VITE_BUILD_SOURCEMAP, REACT_APP_SOCKET_PATH_FRONT, REACT_APP_SERVER_SOCKET_URL } = env;

  const isBuildCommand = command === 'build';

  // const checkers: Checkers = {
  //   typescript: {
  //     tsconfigPath: path.resolve(__dirname, './tsconfig.app.json'),
  //   },
  //   overlay: false,
  // };

  // if (!isBuildCommand) {
  //   checkers['eslint'] = {
  //     lintCommand:
  //       'eslint . --report-unused-disable-directives --max-warnings 0 --config .eslintrc.cjs',
  //   };
  // }

  return {
    root: __dirname,
    cacheDir: '../../node_modules/.vite/packages/twenty-front',

    server: {
      port: 3001,
      host: 'localhost',
      proxy: {
        '^/api/favicon-proxy': {  // Add ^ to ensure exact path matching
          target: 'https://www.google.com',
          // target: 'https://favicon.twenty.com',
          changeOrigin: true,
          secure: false,

          rewrite: (path) => {
            const searchParams = new URLSearchParams(path.split('?')[1]);
            const domain = searchParams.get('domain');
            // return `/${domain}`;
            return `/s2/favicons?domain=${domain}&sz=32`;
          },
            middleware: (req:any, res:any, next:any) => {
            // Remove any double slashes in the path
            req.url = req.url.replace(/\/+/g, '/');
            next();
          },      
          configure: (proxy, options) => {
            // Add error handling
            proxy.on('error', (err, req, res) => {
              console.error('Proxy error:', err);
            });
            // Add logging if needed
            proxy.on('proxyRes', (proxyRes, req, res) => {
              // Add CORS headers
              proxyRes.headers['Access-Control-Allow-Origin'] = '*';
              // Remove COEP headers
              delete proxyRes.headers['Cross-Origin-Embedder-Policy'];
              delete proxyRes.headers['Cross-Origin-Resource-Policy'];
            });
            }  
        },

        // '/google-sheets': {
        //   target: 'https://docs.google.com',
        //   changeOrigin: true,
        //   secure: false,
        //   configure: (proxy, options) => {
        //     proxy.on('error', (err, req, res) => {
        //       console.error('Google Sheets Proxy error:', err);
        //     });
        //     proxy.on('proxyRes', (proxyRes, req, res) => {
        //       proxyRes.headers['Access-Control-Allow-Origin'] = '*';
        //       delete proxyRes.headers['Cross-Origin-Embedder-Policy'];
        //       delete proxyRes.headers['Cross-Origin-Resource-Policy'];
        //     });
        //   }
        // }
    
        
      },
      
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Embedder-Policy': 'unsafe-none',  // This is key for embedding Google content
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Cross-Origin-Opener-Policy': 'unsafe-none'
      }
    

  
    },
    

    plugins: [
      react({ jsxImportSource: '@emotion/react' }),
      tsconfigPaths({
        projects: ['tsconfig.json', '../twenty-ui/tsconfig.json'],
      }),
      svgr(),
      {
        name: 'configure-response-headers',
        configureServer: server => {
          server.middlewares.use((_req, res, next) => {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
            res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

            next();
          });
        },
      },
      // checker(checkers),
      // TODO: fix this, we have to restrict the include to only the components that are using linaria
      // Otherwise the build will fail because wyw tries to include emotion styled components
      wyw({
        include: [
          '**/CurrencyDisplay.tsx',
          '**/EllipsisDisplay.tsx',
          '**/ContactLink.tsx',
          '**/BooleanDisplay.tsx',
          '**/LinksDisplay.tsx',
          '**/RoundedLink.tsx',
          '**/OverflowingTextWithTooltip.tsx',
          '**/Chip.tsx',
          '**/Tag.tsx',
          '**/MultiSelectFieldDisplay.tsx',
          '**/RatingInput.tsx',
        ],
        babelOptions: {
          presets: ['@babel/preset-typescript', '@babel/preset-react'],
        },
      }),
    ],

    build: {
      outDir: 'build',
      sourcemap: VITE_BUILD_SOURCEMAP === 'true',
    },

    envPrefix: 'REACT_APP_',

    define: {
      'process.env': {
        REACT_APP_SERVER_BASE_URL,
        REACT_APP_SOCKET_PATH_FRONT,
        REACT_APP_SERVER_SOCKET_URL,
      },
    },

    optimizeDeps: {
      include: ['pdfjs-dist/build/pdf.worker.mjs'],
    },
  
    css: {
      modules: {
        localsConvention: 'camelCaseOnly',
      },
    },
  };
});
