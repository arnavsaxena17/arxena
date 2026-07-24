#!/usr/bin/env bash
# Create/update CloudFront origin request policy with viewer IP + Sec-Fetch headers.
# Usage: AWS_PROFILE=arxanalytics ./scripts/aws/deploy-cloudfront-orgchart-origin-headers.sh
set -euo pipefail

export AWS_PROFILE="${AWS_PROFILE:-arxmukti}"

CLOUDFRONT_DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID:-EBBO9OCCU9TPA}"
POLICY_NAME="${ORIGIN_REQUEST_POLICY_NAME:-arxena-orgchart-viewer-headers}"
REPLACE_POLICY_ID="${REPLACE_ORIGIN_REQUEST_POLICY_ID:-acba4595-bd28-49b8-b9fe-13317c0390fa}"

POLICY_CONFIG_FILE="$(mktemp)"
cat > "${POLICY_CONFIG_FILE}" <<'EOF'
{
  "Name": "arxena-orgchart-viewer-headers",
  "HeadersConfig": {
    "HeaderBehavior": "whitelist",
    "Headers": {
      "Quantity": 6,
      "Items": [
        "CloudFront-Viewer-Address",
        "user-agent",
        "referer",
        "sec-fetch-site",
        "sec-fetch-mode",
        "sec-ch-ua"
      ]
    }
  },
  "CookiesConfig": { "CookieBehavior": "none" },
  "QueryStringsConfig": { "QueryStringBehavior": "all" }
}
EOF

python3 -c "
import json
with open('${POLICY_CONFIG_FILE}') as f:
    cfg = json.load(f)
cfg['Name'] = '${POLICY_NAME}'
with open('${POLICY_CONFIG_FILE}', 'w') as f:
    json.dump(cfg, f)
"

EXISTING_ID="$(aws cloudfront list-origin-request-policies --type custom --query "OriginRequestPolicyList.Items[?OriginRequestPolicy.OriginRequestPolicyConfig.Name=='${POLICY_NAME}'].OriginRequestPolicy.Id | [0]" --output text)"

if [[ "${EXISTING_ID}" == "None" || -z "${EXISTING_ID}" ]]; then
  echo "Creating origin request policy ${POLICY_NAME}..."
  POLICY_ID="$(aws cloudfront create-origin-request-policy \
    --origin-request-policy-config "file://${POLICY_CONFIG_FILE}" \
    --query 'OriginRequestPolicy.Id' --output text)"
else
  POLICY_ID="${EXISTING_ID}"
  ETAG="$(aws cloudfront get-origin-request-policy --id "${POLICY_ID}" --query 'ETag' --output text)"
  echo "Updating origin request policy ${POLICY_NAME} (${POLICY_ID})..."
  aws cloudfront update-origin-request-policy \
    --id "${POLICY_ID}" \
    --if-match "${ETAG}" \
    --origin-request-policy-config "file://${POLICY_CONFIG_FILE}" >/dev/null
fi
echo "Origin request policy ID: ${POLICY_ID}"

ETAG="$(aws cloudfront get-distribution-config --id "${CLOUDFRONT_DISTRIBUTION_ID}" --query ETag --output text)"
aws cloudfront get-distribution-config --id "${CLOUDFRONT_DISTRIBUTION_ID}" --output json > /tmp/cf-dist-full.json
export POLICY_ID REPLACE_POLICY_ID
python3 <<'PY'
import json, os
with open("/tmp/cf-dist-full.json") as f:
    payload = json.load(f)
config = payload["DistributionConfig"]
policy_id = os.environ["POLICY_ID"]
replace_id = os.environ["REPLACE_POLICY_ID"]
config["DefaultCacheBehavior"]["OriginRequestPolicyId"] = policy_id
for item in config.get("CacheBehaviors", {}).get("Items", []) or []:
    if item.get("OriginRequestPolicyId") == replace_id:
        item["OriginRequestPolicyId"] = policy_id
with open("/tmp/cf-dist-config-body.json", "w") as f:
    json.dump(config, f)
PY

aws cloudfront update-distribution \
  --id "${CLOUDFRONT_DISTRIBUTION_ID}" \
  --if-match "${ETAG}" \
  --distribution-config file:///tmp/cf-dist-config-body.json \
  --query 'Distribution.Status' --output text

rm -f "${POLICY_CONFIG_FILE}"
echo "CloudFront ${CLOUDFRONT_DISTRIBUTION_ID} updated."
