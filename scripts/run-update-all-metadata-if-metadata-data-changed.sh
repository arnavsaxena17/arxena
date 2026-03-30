#!/usr/bin/env bash
# Run on the app host after deploy when git history is available.
# Compares BASE_REF..HEAD for Arx metadata source files; if any changed, runs the Nest CLI
# (no JWT — uses DB + API keys like the admin HTTP action).
#
# Usage (from repo root, with server built and .env for twenty-server):
#   ./scripts/run-update-all-metadata-if-metadata-data-changed.sh [BASE_REF]
# BASE_REF defaults to HEAD~1. Override with a tag or commit, e.g. last deploy:
#   ./scripts/run-update-all-metadata-if-metadata-data-changed.sh v1.2.3
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

BASE_REF="${1:-HEAD~1}"
PATHS=(
  "packages/twenty-server/src/engine/core-modules/workspace-modifications/object-apis/data/fieldsData.ts"
  "packages/twenty-server/src/engine/core-modules/workspace-modifications/object-apis/data/objectsData.ts"
  "packages/twenty-server/src/engine/core-modules/workspace-modifications/object-apis/data/relationsData.ts"
)

if git diff --quiet "${BASE_REF}" HEAD -- "${PATHS[@]}"; then
  echo "No changes in metadata data files between ${BASE_REF} and HEAD; skipping update-all-metadata-from-code."
  exit 0
fi

echo "Metadata data files changed (${BASE_REF}..HEAD); running workspace:update-all-metadata-from-code..."
yarn workspace twenty-server run command:update-all-metadata-from-code
