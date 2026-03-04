#!/bin/bash
# Test SITEMAP_EXPOSED_BATCH_COUNT rollout: sitemap index, sitemap URLs, /companies, /companies/{country}.
#
# Prerequisites:
#   - twenty-website dev server running (port 3002)
#   - twenty-server running (port 3000) with ES_ENDPOINT configured
#
# Usage:
#   For each test, set SITEMAP_EXPOSED_BATCH_COUNT in .env and RESTART the website, then run:
#     bash scripts/test-sitemap-rollout.sh
#
#   To test SITEMAP_EXPOSED_BATCH_COUNT > 50 (e.g. 51, 100):
#     1. Edit packages/twenty-website/.env: SITEMAP_EXPOSED_BATCH_COUNT=51
#     2. Restart the twenty-website dev server
#     3. Run: bash scripts/test-sitemap-rollout.sh
#     4. Verify: sitemap count 51, sitemap-051.xml returns 200, sitemap-101.xml returns 404
#
# The script infers the actual count from the sitemap index response.

PORT=${PORT:-3002}
BASE="http://localhost:$PORT"
SERVER_BASE="${SERVER_BASE_URL:-http://localhost:3000}"

echo "=== SITEMAP_EXPOSED_BATCH_COUNT rollout test ==="
echo "Website: $BASE | Server: $SERVER_BASE"
echo ""

# 1. Sitemap index
echo "--- 1. Sitemap index (/sitemap-index.xml) ---"
INDEX_XML=$(curl -s "$BASE/sitemap-index.xml")
if [ -z "$INDEX_XML" ]; then
  echo "FAIL: No response from sitemap index"
  exit 1
fi
SITEMAP_COUNT=$(echo "$INDEX_XML" | grep -c '<sitemap>' || true)
echo "Sitemap count: $SITEMAP_COUNT"
if [ "$SITEMAP_COUNT" -eq 0 ]; then
  echo "FAIL: No sitemap entries (SITEMAP_EXPOSED_BATCH_COUNT may be 0 or unset)"
fi
echo ""

# 2. Sitemap URLs - first batch
echo "--- 2. Sitemap 001 (first batch) ---"
SITEMAP_001=$(curl -s "$BASE/sitemap-001.xml")
URL_COUNT_001=$(echo "$SITEMAP_001" | grep -c '<url>' || true)
ORGCHART_COUNT_001=$(echo "$SITEMAP_001" | grep -c '/org-chart/' || true)
echo "Total URLs: $URL_COUNT_001 (static + org charts: $ORGCHART_COUNT_001)"
if [ "$URL_COUNT_001" -lt 7 ]; then
  echo "WARN: Expected at least 7 static URLs"
fi
echo ""

# 3. Sitemap URLs - batch 51 (when count >= 51)
echo "--- 3. Sitemap 051 (batch 51, when count >= 51) ---"
HTTP_051=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/sitemap-051.xml")
if [ "$HTTP_051" = "200" ]; then
  SITEMAP_051=$(curl -s "$BASE/sitemap-051.xml")
  URL_COUNT_051=$(echo "$SITEMAP_051" | grep -c '<url>' || true)
  echo "OK: sitemap-051 exists, HTTP $HTTP_051, URLs: $URL_COUNT_051"
else
  echo "Expected: 404 when count < 51, 200 when count >= 51. Got HTTP $HTTP_051"
fi
echo ""

# 4. Sitemap URLs - batch 51 via API (batchIndex 50)
echo "--- 4. Sitemap batch params (batchIndex 50) ---"
BATCH_50=$(curl -s "$BASE/api/org-chart/companies/sitemap-batch-params?batchIndex=50")
echo "Batch 50 params: $BATCH_50"
echo ""

# 5. Sitemap 101 (when count >= 101)
echo "--- 5. Sitemap 101 (batch 101, when count >= 101) ---"
HTTP_101=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/sitemap-101.xml")
echo "sitemap-101: HTTP $HTTP_101"
echo ""

# 6. /companies endpoint
echo "--- 6. /companies (index) ---"
HTTP_COMPANIES=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/companies")
echo "/companies: HTTP $HTTP_COMPANIES"
if [ "$HTTP_COMPANIES" != "200" ]; then
  echo "FAIL: Expected 200"
fi
echo ""

# 7. /companies/a-1 (letter browse) - needs maxExposedCount from getMaxExposedUrlCount(count)
echo "--- 7. /companies/a-1 (letter browse) ---"
# maxExposedCount = sum of batch sizes. Backend caps at 10000.
# count=1: 500; count=2: 3000; count=3: 8000; count>=4: use 10000
MAX_EXPOSED=500
if [ "$SITEMAP_COUNT" -ge 2 ]; then MAX_EXPOSED=3000; fi
if [ "$SITEMAP_COUNT" -ge 3 ]; then MAX_EXPOSED=8000; fi
if [ "$SITEMAP_COUNT" -ge 4 ]; then MAX_EXPOSED=10000; fi
LIST_RES=$(curl -s "$BASE/api/org-chart/companies/list?letter=a&page=1&maxExposedCount=$MAX_EXPOSED")
if echo "$LIST_RES" | grep -q '"companyIds"'; then
  COMPANY_COUNT=$(echo "$LIST_RES" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('companyIds',[])))" 2>/dev/null || echo "0")
  echo "Letter a page 1: $COMPANY_COUNT companies"
else
  echo "Response: $LIST_RES"
fi
echo ""

# 8. /companies/united-states (country browse)
echo "--- 8. /companies/united-states (country browse) ---"
COUNTRY_RES=$(curl -s "$BASE/api/org-chart/companies/list-by-country?country=united-states&page=1&maxExposedCount=$MAX_EXPOSED")
if echo "$COUNTRY_RES" | grep -q '"companyIds"'; then
  COUNTRY_COUNT=$(echo "$COUNTRY_RES" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('companyIds',[])))" 2>/dev/null || echo "0")
  echo "United States page 1: $COUNTRY_COUNT companies"
else
  echo "Response: $COUNTRY_RES"
fi
echo ""

# 9. /companies/united-states/sales (country + function)
echo "--- 9. /companies/united-states/sales (country + function) ---"
FUNC_RES=$(curl -s "$BASE/api/org-chart/companies/list-by-country-function?country=united-states&type=sales&page=1&maxExposedCount=$MAX_EXPOSED")
if echo "$FUNC_RES" | grep -q '"companyIds"'; then
  FUNC_COUNT=$(echo "$FUNC_RES" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('companyIds',[])))" 2>/dev/null || echo "0")
  echo "United States / sales: $FUNC_COUNT companies"
else
  echo "Response: $FUNC_RES"
fi
echo ""

# 10. /companies page (HTML)
echo "--- 10. /companies page (HTML) ---"
HTTP_COMPANIES_PAGE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/companies")
echo "/companies: HTTP $HTTP_COMPANIES_PAGE"
echo ""

# 11. /companies/a-1 page (HTML)
echo "--- 11. /companies/a-1 page (HTML) ---"
HTTP_A1=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/companies/a-1")
echo "/companies/a-1: HTTP $HTTP_A1"
echo ""

# 12. /companies/united-states page (HTML)
echo "--- 12. /companies/united-states page (HTML) ---"
HTTP_US=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/companies/united-states")
echo "/companies/united-states: HTTP $HTTP_US"
echo ""

echo "=== Test complete ==="
