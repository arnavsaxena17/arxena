#!/usr/bin/env bash
# Deploy Arxena MCP HTTP on production (app.arxena.com).
# Run from repo root after building twenty-mcp-server locally or on the server.
#
# Usage:
#   AWS_PROFILE=arxanalytics ./scripts/aws/setup-mcp-arxena-dns.sh
#   ./scripts/deploy-mcp-arxena-production.sh

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SSH_HOST="${MCP_DEPLOY_SSH:-app.arxena.com}"
REMOTE_TWENTY="/home/ubuntu/twenty"
REMOTE_MCP="${REMOTE_TWENTY}/packages/twenty-mcp-server"

echo "==> Building twenty-mcp-server locally"
cd "$REPO_DIR/packages/twenty-mcp-server"
yarn build

echo "==> Syncing dist + config to ${SSH_HOST}"
rsync -avz --delete \
  "$REPO_DIR/packages/twenty-mcp-server/dist/" \
  "${SSH_HOST}:${REMOTE_MCP}/dist/"
rsync -avz \
  "$REPO_DIR/ecosystem.config.js" \
  "$REPO_DIR/pm2_start_website.sh" \
  "$REPO_DIR/packages/twenty-mcp-server/package.json" \
  "${SSH_HOST}:${REMOTE_TWENTY}/"
rsync -avz \
  "$REPO_DIR/packages/twenty-mcp-server/ecosystem.config.cjs" \
  "${SSH_HOST}:${REMOTE_MCP}/"
rsync -avz \
  "$REPO_DIR/scripts/nginx/mcp-arxena.conf.snippet" \
  "${SSH_HOST}:${REMOTE_TWENTY}/scripts/nginx/mcp-arxena.conf.snippet"

echo "==> Route53 DNS (mcp.arxena.com -> EC2)"
AWS_PROFILE="${AWS_PROFILE:-arxanalytics}" "$REPO_DIR/scripts/aws/setup-mcp-arxena-dns.sh"

echo "==> Remote nginx + certbot + pm2"
ssh "$SSH_HOST" bash -s <<'REMOTE'
set -euo pipefail
REMOTE_TWENTY="/home/ubuntu/twenty"
NGINX_AVAILABLE="/etc/nginx/sites-available/mcp-arxena.conf"
NGINX_ENABLED="/etc/nginx/sites-enabled/mcp-arxena.conf"

sudo mkdir -p /var/www/certbot

if [ ! -f /etc/letsencrypt/live/mcp.arxena.com/fullchain.pem ]; then
  echo "Staging HTTP-only nginx for certbot..."
  sudo tee "$NGINX_AVAILABLE" >/dev/null <<'NGINX_HTTP'
server {
  listen 80;
  server_name mcp.arxena.com;

  location /.well-known/acme-challenge/ {
    root /var/www/certbot;
  }

  location / {
    return 200 'mcp pending cert\n';
    add_header Content-Type text/plain;
  }
}
NGINX_HTTP
  sudo ln -sf "$NGINX_AVAILABLE" "$NGINX_ENABLED"
  sudo nginx -t
  sudo systemctl reload nginx
  sleep 5
  echo "Requesting Let's Encrypt cert for mcp.arxena.com..."
  sudo certbot certonly --webroot -w /var/www/certbot \
    -d mcp.arxena.com \
    --non-interactive --agree-tos -m support@arxena.com
fi

sudo cp "$REMOTE_TWENTY/scripts/nginx/mcp-arxena.conf.snippet" "$NGINX_AVAILABLE"
sudo ln -sf "$NGINX_AVAILABLE" "$NGINX_ENABLED"
sudo nginx -t
sudo systemctl reload nginx

cd "$REMOTE_TWENTY/packages/twenty-mcp-server"
# MCP SDK 1.26 needs zod >= 3.25 (exports zod/v4). Avoid full monorepo yarn install on prod.
if ! node -e "require('zod/v4')" 2>/dev/null; then
  echo "Upgrading zod in twenty-mcp-server/node_modules..."
  npm install --no-save --no-package-lock zod@3.25.76
fi

chmod +x "$REMOTE_TWENTY/pm2_start_website.sh" 2>/dev/null || true
cd "$REMOTE_TWENTY"
pm2 startOrRestart ecosystem.config.js --only arxena-mcp-http || pm2 start ecosystem.config.js --only arxena-mcp-http
pm2 save

sleep 2
curl -sf http://127.0.0.1:3005/health && echo " MCP health OK"
REMOTE

echo "==> Done. Test: curl -s https://mcp.arxena.com/health"
