import { defineManifest } from '@crxjs/vite-plugin';

import packageData from '../package.json';

const external_sites =
  process.env.VITE_MODE === 'development'
    ? [`https://app.arxena.com/*`, `http://localhost:3001/*`, `http://localhost:3000/*`]
    : [`https://arxena.com/*`];

export default defineManifest({
  manifest_version: 3,
  name: 'Arx Twenty Crx',
  description: packageData.description,
  version: packageData.version,

  icons: {
    16: 'logo/32-32.png',
    32: 'logo/32-32.png',
    48: 'logo/32-32.png',
  },

  action: {
    default_popup: 'popup.html',
    default_icon: {
      16: 'logo/32-32.png',
      32: 'logo/32-32.png',
      48: 'logo/32-32.png',
    },
  },

  //TODO: change this to a documenation page
  // options_page: 'sidepanel.html',
  // action: {},

  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },

  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: [
        'src/contentScript/index.ts',
        'src/contentScript/insertSettingsButton.ts',      
      ],
      run_at: 'document_start',
    },
  ],

  web_accessible_resources: [
    {
      resources: [
        'sidepanel.html',
        'page-inaccessible.html',
        'assets/*',
        'vendor/*',
        'node_modules/twenty-shared/dist/*',
        'src/contentScript/*',
        'src/db/*',
        'src/graphql/**/*',
        'src/utils/**/*',
        'src/**/*.ts',
        'src/**/*.js',
        'dist/*'
      ],
      matches: ['<all_urls>'],
    },
  ],

  permissions: ['activeTab', 'storage', 'identity', 'sidePanel', 'cookies'],

  // setting host permissions to all http connections will allow
  // for people who host on their custom domain to get access to
  // extension instead of white listing individual urls
  host_permissions: ['https://*/*', 'http://*/*'],

  externally_connectable: {
    matches: external_sites,
  },
});
