const path = require('path');

const repoRoot = __dirname;
const mcpCwd = path.join(repoRoot, 'packages/twenty-mcp-server');

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
    {
      name: 'arxena-mcp-http',
      script: 'dist/http-index.js',
      cwd: mcpCwd,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        MCP_HTTP_PORT: '3005',
        MCP_HTTP_PATH: '/mcp',
        MCP_PUBLIC_URL: 'https://mcp.arxena.com/mcp',
        MCP_OAUTH_ISSUER_URL: 'https://mcp.arxena.com',
        ARXENA_BASE_URL: 'https://app.arxena.com',
        MCP_PUBLIC_TOOLS_ONLY: 'true',
        MCP_OAUTH_ENABLED: 'true',
        MCP_PRIVACY_POLICY_URL: 'https://arxena.com/legal/privacy/mcp',
        MCP_DOCUMENTATION_URL: 'https://mcp.arxena.com/docs/mcp',
      },
    },
  ],
};
