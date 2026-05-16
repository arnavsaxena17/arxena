#!/usr/bin/env bash
# Deploy CloudFront-scoped WAF for arxena.com org-chart protection.
# Usage: AWS_PROFILE=arxanalytics ./scripts/aws/deploy-orgchart-waf.sh
set -euo pipefail

export AWS_PROFILE="${AWS_PROFILE:-arxanalytics}"
export AWS_REGION="${AWS_REGION:-us-east-1}"

CLOUDFRONT_DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID:-E3AHPTNSVZ97HT}"
WEB_ACL_NAME="${WEB_ACL_NAME:-arxena-orgchart-protection}"
IP_SET_NAME="${IP_SET_NAME:-arxena-orgchart-blocked-cidrs}"
BLOCKED_CIDRS="${ORG_CHART_WAF_BLOCKED_CIDRS:-43.173.0.0/16 43.172.0.0/16}"

echo "Using AWS profile=${AWS_PROFILE} region=${AWS_REGION}"

read -r -a CIDR_ARRAY <<< "${BLOCKED_CIDRS}"

IP_SET_ID="$(aws wafv2 list-ip-sets --scope CLOUDFRONT --query "IPSets[?Name=='${IP_SET_NAME}'].Id | [0]" --output text)"
if [[ "${IP_SET_ID}" == "None" || -z "${IP_SET_ID}" ]]; then
  echo "Creating IP set ${IP_SET_NAME}..."
  IP_SET_ARN="$(aws wafv2 create-ip-set \
    --name "${IP_SET_NAME}" \
    --scope CLOUDFRONT \
    --ip-address-version IPV4 \
    --addresses "${CIDR_ARRAY[@]}" \
    --query 'Summary.ARN' --output text)"
else
  IP_SET_ARN="$(aws wafv2 get-ip-set --scope CLOUDFRONT --id "${IP_SET_ID}" --name "${IP_SET_NAME}" --query 'IPSet.ARN' --output text)"
  LOCK_TOKEN="$(aws wafv2 get-ip-set --scope CLOUDFRONT --id "${IP_SET_ID}" --name "${IP_SET_NAME}" --query 'LockToken' --output text)"
  echo "Updating IP set ${IP_SET_NAME}..."
  aws wafv2 update-ip-set \
    --name "${IP_SET_NAME}" \
    --scope CLOUDFRONT \
    --id "${IP_SET_ID}" \
    --lock-token "${LOCK_TOKEN}" \
    --addresses "${CIDR_ARRAY[@]}" >/dev/null
fi
echo "IP set ARN: ${IP_SET_ARN}"

RULES_FILE="$(mktemp)"
export IP_SET_ARN
python3 <<'PY' > "${RULES_FILE}"
import base64
import json
import os

def b64(value: str) -> str:
    return base64.b64encode(value.encode("utf-8")).decode("utf-8")

def uri_path_contains(fragment: str) -> dict:
    return {
        "ByteMatchStatement": {
            "SearchString": b64(fragment),
            "FieldToMatch": {"UriPath": {}},
            "TextTransformations": [{"Priority": 0, "Type": "NONE"}],
            "PositionalConstraint": "CONTAINS",
        }
    }

def uri_path_excludes(fragment: str) -> dict:
    return {"NotStatement": {"Statement": uri_path_contains(fragment)}}

ip_set_arn = os.environ["IP_SET_ARN"]
rules = [
  {
    "Name": "BlockScraperCidrs",
    "Priority": 0,
    "Statement": {"IPSetReferenceStatement": {"ARN": ip_set_arn}},
    "Action": {"Block": {}},
    "VisibilityConfig": {
      "SampledRequestsEnabled": True,
      "CloudWatchMetricsEnabled": True,
      "MetricName": "BlockScraperCidrs",
    },
  },
  {
    "Name": "RateLimitOrgChartApi",
    "Priority": 1,
    "Statement": {
      "RateBasedStatement": {
        "Limit": 60,
        "AggregateKeyType": "IP",
        "ScopeDownStatement": {
          "AndStatement": {
            "Statements": [
              uri_path_contains("/api/org-chart"),
              uri_path_excludes("company-logo"),
              uri_path_excludes("image-proxy"),
            ]
          }
        },
      }
    },
    "Action": {"Block": {}},
    "VisibilityConfig": {
      "SampledRequestsEnabled": True,
      "CloudWatchMetricsEnabled": True,
      "MetricName": "RateLimitOrgChartApi",
    },
  },
  {
    "Name": "AWSIpReputation",
    "Priority": 2,
    "Statement": {
      "ManagedRuleGroupStatement": {
        "VendorName": "AWS",
        "Name": "AWSManagedRulesAmazonIpReputationList",
      }
    },
    "OverrideAction": {"None": {}},
    "VisibilityConfig": {
      "SampledRequestsEnabled": True,
      "CloudWatchMetricsEnabled": True,
      "MetricName": "AWSIpReputation",
    },
  },
]
print(json.dumps(rules))
PY

WEB_ACL_ID="$(aws wafv2 list-web-acls --scope CLOUDFRONT --query "WebACLs[?Name=='${WEB_ACL_NAME}'].Id | [0]" --output text)"
VISIBILITY="SampledRequestsEnabled=true,CloudWatchMetricsEnabled=true,MetricName=${WEB_ACL_NAME}"

if [[ "${WEB_ACL_ID}" == "None" || -z "${WEB_ACL_ID}" ]]; then
  echo "Creating Web ACL ${WEB_ACL_NAME}..."
  WEB_ACL_ARN="$(aws wafv2 create-web-acl \
    --name "${WEB_ACL_NAME}" \
    --scope CLOUDFRONT \
    --default-action 'Allow={}' \
    --rules "file://${RULES_FILE}" \
    --visibility-config "${VISIBILITY}" \
    --query 'Summary.ARN' --output text)"
else
  LOCK_TOKEN="$(aws wafv2 get-web-acl --scope CLOUDFRONT --id "${WEB_ACL_ID}" --name "${WEB_ACL_NAME}" --query 'LockToken' --output text)"
  echo "Updating Web ACL ${WEB_ACL_NAME}..."
  aws wafv2 update-web-acl \
    --name "${WEB_ACL_NAME}" \
    --scope CLOUDFRONT \
    --id "${WEB_ACL_ID}" \
    --lock-token "${LOCK_TOKEN}" \
    --default-action 'Allow={}' \
    --rules "file://${RULES_FILE}" \
    --visibility-config "${VISIBILITY}" >/dev/null
  WEB_ACL_ARN="$(aws wafv2 get-web-acl --scope CLOUDFRONT --id "${WEB_ACL_ID}" --name "${WEB_ACL_NAME}" --query 'WebACL.ARN' --output text)"
fi
echo "Web ACL ARN: ${WEB_ACL_ARN}"

ETAG="$(aws cloudfront get-distribution-config --id "${CLOUDFRONT_DISTRIBUTION_ID}" --query ETag --output text)"
aws cloudfront get-distribution-config --id "${CLOUDFRONT_DISTRIBUTION_ID}" --output json > /tmp/cf-dist-full.json
export WEB_ACL_ARN
python3 <<'PY'
import json, os
with open("/tmp/cf-dist-full.json") as f:
    payload = json.load(f)
config = payload["DistributionConfig"]
config["WebACLId"] = os.environ["WEB_ACL_ARN"]
with open("/tmp/cf-dist-config-body.json", "w") as f:
    json.dump(config, f)
PY

aws cloudfront update-distribution \
  --id "${CLOUDFRONT_DISTRIBUTION_ID}" \
  --if-match "${ETAG}" \
  --distribution-config file:///tmp/cf-dist-config-body.json \
  --query 'Distribution.Status' --output text

rm -f "${RULES_FILE}"
echo "WAF deployed and attached to CloudFront ${CLOUDFRONT_DISTRIBUTION_ID}."
