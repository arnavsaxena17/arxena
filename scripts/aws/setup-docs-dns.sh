#!/usr/bin/env bash
# Create or update the docs.arxena.com A record -> production EC2 public IP.

set -euo pipefail

AWS_PROFILE="${AWS_PROFILE:-arxmukti}"

ARXENA_HOSTED_ZONE_ID="${ARXENA_HOSTED_ZONE_ID:-Z07810821LEDHY49LZU73}"
ARXENA_INSTANCE_ID="${ARXENA_INSTANCE_ID:-i-01fa0853163833136}"
TTL="${TTL:-300}"

get_public_ip() {
  local instance_id="$1"

  aws --profile "$AWS_PROFILE" ec2 describe-instances \
    --instance-ids "$instance_id" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text
}

upsert_record() {
  local hosted_zone_id="$1"
  local record_name="$2"
  local target_ip="$3"

  if [ -z "$target_ip" ] || [ "$target_ip" = "None" ]; then
    echo "Could not resolve public IP for ${record_name}"
    exit 1
  fi

  echo "Upserting Route53 A record: ${record_name} -> ${target_ip}"

  local change_batch
  change_batch=$(cat <<EOF
{
  "Comment": "Docs origin for ${record_name}",
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "${record_name}",
      "Type": "A",
      "TTL": ${TTL},
      "ResourceRecords": [{ "Value": "${target_ip}" }]
    }
  }]
}
EOF
)

  aws --profile "$AWS_PROFILE" route53 change-resource-record-sets \
    --hosted-zone-id "$hosted_zone_id" \
    --change-batch "$change_batch"
}

ARXENA_PUBLIC_IP="$(get_public_ip "$ARXENA_INSTANCE_ID")"

upsert_record "$ARXENA_HOSTED_ZONE_ID" docs.arxena.com "$ARXENA_PUBLIC_IP"

echo "DNS upserts submitted."
echo "Verify:"
echo "  dig +short docs.arxena.com"
