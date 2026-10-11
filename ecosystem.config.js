const path = require('path');

const repoRoot = __dirname;

module.exports = {
  apps: [
    {
      name: 'twenty-server',
      script: './pm2_start_server.sh',
      cwd: repoRoot,
      watch: false,
      env: {
        PORT: 3000,
        NODE_ENV: 'production',
        NODE_OPTIONS: '--max-old-space-size=4096',
      },
      env_production: {
        PORT: 3000,
        NODE_ENV: 'production',
        NODE_OPTIONS: '--max-old-space-size=4096',
      },
    },
    {
      name: 'twenty-worker',
      script: './pm2_start_worker.sh',
      cwd: repoRoot,
      watch: false,
    },
    {
      name: 'twenty-website',
      script: './pm2_start_website.sh',
      cwd: repoRoot,
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
