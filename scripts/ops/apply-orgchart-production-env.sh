#!/usr/bin/env bash
# Append org-chart protection env vars to production .env_website on twenty-40.
# Run on the server: bash apply-orgchart-production-env.sh
set -euo pipefail

ENV_FILE="${ENV_FILE:-/home/ubuntu/.env_website}"

append_if_missing() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "${ENV_FILE}" 2>/dev/null; then
    echo "Skip ${key} (already set)"
  else
    echo "${key}=${value}" >> "${ENV_FILE}"
    echo "Added ${key}"
  fi
}

touch "${ENV_FILE}"
append_if_missing ORG_CHART_GUARD_MODE log_only
append_if_missing ORG_CHART_ALLOW_VERIFIED_BOTS 1
append_if_missing ORG_CHART_API_RATE_LIMIT_MAX 30
append_if_missing ORG_CHART_API_RATE_LIMIT_EXPENSIVE_MAX 5
append_if_missing ORG_CHART_API_RATE_LIMIT_SITEMAP_MAX 600

echo "Restart twenty-website after deploy: pm2 restart twenty-website --update-env"
echo "After 48h log_only: set ORG_CHART_GUARD_MODE=enforce on website and server .env, then pm2 restart all"
