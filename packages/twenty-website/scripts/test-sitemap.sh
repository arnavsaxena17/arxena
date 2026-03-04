#!/bin/bash
# Test sitemap endpoints. Ensure twenty-website dev server is running.
# SITEMAP_EXPOSED_BATCH_COUNT is read at server start - set in .env or when starting.
# Org chart URLs require twenty-server (port 3000) with ES_ENDPOINT configured.
#
# Usage: ./scripts/test-sitemap.sh [PORT]
# Example: PORT=3002 ./scripts/test-sitemap.sh

PORT=${1:-${PORT:-3002}}
BASE="http://localhost:$PORT"
SERVER_BASE="${SERVER_BASE_URL:-http://localhost:3000}"

echo "Testing sitemap endpoints (website port $PORT, server $SERVER_BASE)"
echo ""

echo "=== Backend APIs (org chart URLs) ==="
BATCH_PARAMS=$(curl -s "$BASE/api/org-chart/companies/sitemap-batch-params?batchIndex=0")
URLS_JSON=$(curl -s "$BASE/api/org-chart/companies/sitemap-urls?country=global&type=fullcompany&offset=0&limit=5")
URL_COUNT=$(echo "$URLS_JSON" | grep -o '"companyId"' | wc -l | tr -d ' ')
echo "Batch params: $BATCH_PARAMS"
echo "Org chart URLs (first 5): $URL_COUNT"
if [ "$URL_COUNT" -eq 0 ]; then
  echo "  -> No org chart URLs. Ensure twenty-server has ES_ENDPOINT set and index has data."
fi
echo ""

echo "=== /sitemap-index.xml (index) ==="
curl -s -w "\nHTTP: %{http_code}\n" "$BASE/sitemap-index.xml" | head -25
echo ""

echo "=== /sitemap-001.xml (first child) ==="
curl -s -w "\nHTTP: %{http_code}\n" "$BASE/sitemap-001.xml" | head -30
echo ""

echo "=== /sitemap-002.xml (second child, if count>=2) ==="
curl -s -w "\nHTTP: %{http_code}\n" "$BASE/sitemap-002.xml" | head -15
echo ""

echo "=== /sitemap-999.xml (out of range, expect 404) ==="
curl -s -o /dev/null -w "HTTP: %{http_code}\n" "$BASE/sitemap-999.xml"
