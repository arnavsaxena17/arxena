/**
 * @deprecated Use repo-root ecosystem.config.js. Kept so MCP-only deploys can run
 * `pm2 start ecosystem.config.cjs --only arxena-mcp-http` from this package directory.
 */
const root = require('../../ecosystem.config.js');

module.exports = {
  apps: root.apps.filter((app) => app.name === 'arxena-mcp-http'),
};
