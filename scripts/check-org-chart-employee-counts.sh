#!/bin/bash
# Check employee counts for org chart companies
# Usage: ./scripts/check-org-chart-employee-counts.sh [BASE_URL]
# Default BASE_URL: http://localhost:3000 (twenty-server)
# For website proxy use: http://localhost:3002 (then path is /api/org-chart/COMPANY_ID)
#
# Raw curl commands (server on localhost:3000, 100-400 employee companies):
#   curl -s "http://localhost:3000/org-chart/litify" | jq '.result.count_org'
#   curl -s "http://localhost:3000/org-chart/hellosign" | jq '.result.count_org'
#   curl -s "http://localhost:3000/org-chart/launchdarkly" | jq '.result.count_org'
#   curl -s "http://localhost:3000/org-chart/slack" | jq '.result.count_org'
#   curl -s "http://localhost:3000/org-chart/figma" | jq '.result.count_org'
#   curl -s "http://localhost:3000/org-chart/pandadoc" | jq '.result.count_org'
#   curl -s "http://localhost:3000/org-chart/airtable" | jq '.result.count_org'
#   curl -s "http://localhost:3000/org-chart/evernote" | jq '.result.count_org'
#   curl -s "http://localhost:3000/org-chart/intercom" | jq '.result.count_org'
#   curl -s "http://localhost:3000/org-chart/egnyte" | jq '.result.count_org'

BASE_URL="${1:-http://localhost:3000}"
# If using website proxy, the path prefix is /api/org-chart; if server direct, it's /org-chart
if [[ "$BASE_URL" == *"3002"* ]] || [[ "$BASE_URL" == *"arxena.com"* ]]; then
  PREFIX="/api/org-chart"
else
  PREFIX="/org-chart"
fi

COMPANIES="litify hellosign launchdarkly slack figma pandadoc airtable evernote intercom egnyte"

echo "Checking org chart employee counts (BASE_URL=$BASE_URL, PREFIX=$PREFIX)"
echo "---"

for company in $COMPANIES; do
  response=$(curl -s -w "\n%{http_code}" "${BASE_URL}${PREFIX}/${company}")
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" != "200" ]; then
    echo "$company: HTTP $http_code (no data or error)"
    continue
  fi
  
  # API returns { result: {...}, status: 'ok' }
  # count_org = employee/profile count; is_blank_template = true when not in ES (placeholder)
  count_org=$(echo "$body" | jq -r '.result.count_org // empty')
  item_count=$(echo "$body" | jq -r '.result.item_count // empty')
  profile_count=$(echo "$body" | jq -r '.result.profile_count // empty')
  is_blank=$(echo "$body" | jq -r '.result.is_blank_template // false')
  
  if [ "$is_blank" = "true" ]; then
    echo "$company: NOT IN ES (blank template)"
  elif [ -n "$count_org" ] && [ "$count_org" != "null" ]; then
    echo "$company: $count_org employees"
  elif [ -n "$item_count" ] && [ "$item_count" != "null" ]; then
    echo "$company: $item_count employees"
  elif [ -n "$profile_count" ] && [ "$profile_count" != "null" ]; then
    echo "$company: $profile_count employees"
  else
    echo "$company: (no count in response)"
  fi
done
