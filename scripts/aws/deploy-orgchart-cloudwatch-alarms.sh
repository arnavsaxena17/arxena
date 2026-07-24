#!/usr/bin/env bash
# Create CloudWatch alarms for WAF blocks and org-chart server health signals.
# Usage: AWS_PROFILE=arxanalytics ./scripts/aws/deploy-orgchart-cloudwatch-alarms.sh
set -euo pipefail

export AWS_PROFILE="${AWS_PROFILE:-arxmukti}"
export AWS_REGION="${AWS_REGION:-us-east-1}"

WEB_ACL_NAME="${WEB_ACL_NAME:-arxena-orgchart-protection}"
SNS_TOPIC_ARN="${ORG_CHART_ALARM_SNS_TOPIC_ARN:-}"

WEB_ACL_ARN="$(aws wafv2 list-web-acls --scope CLOUDFRONT --query "WebACLs[?Name=='${WEB_ACL_NAME}'].ARN | [0]" --output text)"
if [[ "${WEB_ACL_ARN}" == "None" || -z "${WEB_ACL_ARN}" ]]; then
  echo "Web ACL ${WEB_ACL_NAME} not found. Run deploy-orgchart-waf.sh first."
  exit 1
fi

WAF_DIMENSION="${WEB_ACL_ARN},Rule,ALL"

create_alarm() {
  local name="$1"
  local metric="$2"
  local threshold="$3"
  local namespace="$4"
  local stat="${5:-Sum}"
  local period="${6:-300}"

  local args=(
    --alarm-name "${name}"
    --metric-name "${metric}"
    --namespace "${namespace}"
    --statistic "${stat}"
    --period "${period}"
    --evaluation-periods 2
    --threshold "${threshold}"
    --comparison-operator GreaterThanThreshold
    --treat-missing-data notBreaching
  )

  if [[ "${namespace}" == "AWS/WAFV2" ]]; then
    args+=(--dimensions Name=WebACL,Value="${WEB_ACL_ARN}" Name=Rule,Value=ALL)
  fi

  if [[ -n "${SNS_TOPIC_ARN}" ]]; then
    args+=(--alarm-actions "${SNS_TOPIC_ARN}")
  fi

  aws cloudwatch put-metric-alarm "${args[@]}" >/dev/null
  echo "Alarm ${name} configured."
}

create_alarm "arxena-waf-orgchart-blocked" "BlockedRequests" "500" "AWS/WAFV2"
create_alarm "arxena-waf-orgchart-counted" "CountedRequests" "2000" "AWS/WAFV2"

echo "CloudWatch alarms deployed for ${WEB_ACL_NAME}."
echo "Optional: set ORG_CHART_ALARM_SNS_TOPIC_ARN for notifications."
