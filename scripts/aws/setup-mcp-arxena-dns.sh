#!/usr/bin/env bash
# Create or update mcp.arxena.com A record → production EC2 (direct, not CloudFront).
# Usage: AWS_PROFILE=arxmukti ./scripts/aws/setup-mcp-arxena-dns.sh [EC2_PUBLIC_IP]

set -euo pipefail

export AWS_PROFILE="${AWS_PROFILE:-arxmukti}"
HOSTED_ZONE_ID="${ARXENA_HOSTED_ZONE_ID:-Z05402123EAOTC6U2NR1N}"
RECORD_NAME="mcp.arxena.com"
TTL=300

if [ -n "${1:-}" ]; then
  TARGET_IP="$1"
else
  # Default to new arxmukti app EIP until DNS cutover; override via arg or env.
  TARGET_IP="${ARXENA_APP_EIP:-44.221.212.4}"
fi

if [ -z "$TARGET_IP" ]; then
  echo "Could not resolve production EC2 public IP"
  exit 1
fi

echo "Upserting Route53 A record: ${RECORD_NAME} -> ${TARGET_IP}"

CHANGE_BATCH=$(cat <<EOF
{
  "Comment": "Arxena MCP HTTP origin",
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "${RECORD_NAME}",
      "Type": "A",
      "TTL": ${TTL},
      "ResourceRecords": [{ "Value": "${TARGET_IP}" }]
    }
  }]
}
EOF
)

aws route53 change-resource-record-sets \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  --change-batch "$CHANGE_BATCH"

echo "DNS upsert submitted for ${RECORD_NAME} -> ${TARGET_IP}"
echo "Verify: dig +short ${RECORD_NAME}"
