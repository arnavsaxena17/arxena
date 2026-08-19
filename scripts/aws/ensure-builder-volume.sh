#!/usr/bin/env bash
# Create (if missing) and print the id of the persistent arm64 builder data volume.
# Usage: AWS_PROFILE=arxmukti-key ./scripts/aws/ensure-builder-volume.sh
set -euo pipefail

AWS_PROFILE="${AWS_PROFILE:-arxmukti-key}"
AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="$AWS_REGION"
VOLUME_TAG_NAME="${BUILDER_VOLUME_TAG_NAME:-arxena-builder-workspace}"
VOLUME_SIZE="${BUILDER_DATA_VOLUME_SIZE:-100}"
SUBNET_ID="${EC2_SUBNET_ID:-subnet-026eb73699b4efba7}"

AZ="$(
  aws --profile "$AWS_PROFILE" ec2 describe-subnets \
    --subnet-ids "$SUBNET_ID" \
    --query 'Subnets[0].AvailabilityZone' \
    --output text
)"

EXISTING="$(
  aws --profile "$AWS_PROFILE" ec2 describe-volumes \
    --filters "Name=tag:Name,Values=${VOLUME_TAG_NAME}" "Name=availability-zone,Values=${AZ}" \
    --query 'Volumes[?State!=`deleting`].VolumeId' \
    --output text
)"
EXISTING="$(echo "$EXISTING" | awk '{print $1}')"

if [ -n "${EXISTING:-}" ] && [ "$EXISTING" != "None" ]; then
  echo "$EXISTING"
  exit 0
fi

echo "Creating ${VOLUME_SIZE} GiB gp3 volume ${VOLUME_TAG_NAME} in ${AZ}..." >&2
VOLUME_ID="$(
  aws --profile "$AWS_PROFILE" ec2 create-volume \
    --availability-zone "$AZ" \
    --size "$VOLUME_SIZE" \
    --volume-type gp3 \
    --tag-specifications "ResourceType=volume,Tags=[{Key=Name,Value=${VOLUME_TAG_NAME}},{Key=Purpose,Value=builder-workspace}]" \
    --query 'VolumeId' \
    --output text
)"
aws --profile "$AWS_PROFILE" ec2 wait volume-available --volume-ids "$VOLUME_ID"
echo "$VOLUME_ID"
