#!/usr/bin/env bash
# =============================================================================
# Sync billing catalog from Stripe into Postgres
# =============================================================================
# Use after a database reset (local or production) when IS_BILLING_ENABLED=true.
#
# What it does:
#   1. Ensures required Stripe products/prices + Twenty metadata exist
#      (PRO BASE_PRODUCT + PRO RESOURCE_CREDIT monthly)
#   2. Syncs meters/products/prices from Stripe into core billing tables
#
# Prerequisites:
#   - packages/twenty-server/.env has billing Stripe keys configured
#   - BILLING_STRIPE_BASE_PLAN_PRODUCT_ID points at your PRO base product
#   - twenty-server has been built (dist/command/command.js exists)
#
# Usage (from repo root):
#   bash packages/twenty-utils/sync-billing-catalog.sh
#   bash packages/twenty-utils/sync-billing-catalog.sh --dry-run
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

DRY_RUN_ARGS=()
for arg in "$@"; do
  case "$arg" in
    --dry-run|-d) DRY_RUN_ARGS+=(--dry-run) ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

cd "$REPO_ROOT"

if [ ! -f packages/twenty-server/dist/command/command.js ]; then
  echo "=> Building twenty-server command entrypoint..."
  npx nx run twenty-server:build
fi

echo "=> Ensuring Stripe catalog and syncing billing plans into the database..."
if [ "${#DRY_RUN_ARGS[@]}" -gt 0 ]; then
  npx nx run twenty-server:command-no-deps -- billing:sync-plans-data --ensure-catalog "${DRY_RUN_ARGS[@]}"
else
  npx nx run twenty-server:command-no-deps -- billing:sync-plans-data --ensure-catalog
fi

echo "=> Billing catalog sync complete."
