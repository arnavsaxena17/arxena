#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for config in "$SCRIPT_DIR/build.config" "$HOME/twenty/build.config" "/home/ubuntu/twenty/build.config"; do
  if [ -f "$config" ]; then
    # shellcheck disable=SC1090
    source "$config"
    break
  fi
done

CHATWOOT_BUILD_BRANCH="${CHATWOOT_BUILD_BRANCH:-arxena/onboarding-workspace}"
CHATWOOT_REPO_URL="${CHATWOOT_REPO_URL:-https://github.com/arnavsaxena17/chatwoot.git}"
CHATWOOT_IMAGE_NAME="${CHATWOOT_IMAGE_NAME:-arxena/chatwoot-local:latest}"
CHATWOOT_SOURCE_DIR="${CHATWOOT_SOURCE_DIR:-$SCRIPT_DIR/tools/chatwoot-source}"
CHATWOOT_COMPOSE_DIR="${CHATWOOT_COMPOSE_DIR:-$SCRIPT_DIR/tools/chatwoot-local}"
CHATWOOT_BUILDER_VOLUME_SIZE="${CHATWOOT_BUILDER_VOLUME_SIZE:-80}"
CHATWOOT_BUILDER_INSTANCE_TYPE="${CHATWOOT_BUILDER_INSTANCE_TYPE:-t3.xlarge}"
CHATWOOT_DEPLOY_AFTER_BUILD="${CHATWOOT_DEPLOY_AFTER_BUILD:-1}"

AWS_PROFILE="${AWS_PROFILE:-arxanalytics}"
AWS_CLI_PROFILE_ARGS=()
if [ -n "${AWS_PROFILE:-}" ]; then
  AWS_CLI_PROFILE_ARGS=(--profile "$AWS_PROFILE")
fi

SSH_KEY_PATH="${SSH_KEY_PATH:-$HOME/arx-analytics-key.pem}"
EC2_IMAGE_ID="${EC2_IMAGE_ID:-ami-09e12010e9d1fb5a3}"
EC2_KEY_NAME="${EC2_KEY_NAME:-arx-analytics-key}"
EC2_SECURITY_GROUP_ID="${EC2_SECURITY_GROUP_ID:-sg-04efe18d868d9a023}"
EC2_SUBNET_ID="${EC2_SUBNET_ID:-subnet-0fe5d2cdf8329f8a5}"

TEMP_INSTANCE_ID=""
STAGING_ROOT=""
BUILD_STATUS_LOCAL_FILE=""

shell_quote() {
  printf "%q" "$1"
}

cleanup() {
  local exit_code=$?

  if [ -n "$STAGING_ROOT" ] && [ -d "$STAGING_ROOT" ]; then
    rm -rf "$STAGING_ROOT"
  fi

  if [ -n "$BUILD_STATUS_LOCAL_FILE" ] && [ -f "$BUILD_STATUS_LOCAL_FILE" ]; then
    rm -f "$BUILD_STATUS_LOCAL_FILE"
  fi

  if [ -n "$TEMP_INSTANCE_ID" ]; then
    echo "Cleaning up and terminating Chatwoot builder instance $TEMP_INSTANCE_ID..."
    aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 terminate-instances --instance-ids "$TEMP_INSTANCE_ID" >/dev/null || true
  fi

  exit "$exit_code"
}

trap cleanup EXIT INT

start_time=$(date +%s)

if [ -d "$CHATWOOT_SOURCE_DIR/.git" ]; then
  echo "Syncing Chatwoot source repo with $CHATWOOT_BUILD_BRANCH..."
  git -C "$CHATWOOT_SOURCE_DIR" fetch origin "$CHATWOOT_BUILD_BRANCH"
  git -C "$CHATWOOT_SOURCE_DIR" checkout "$CHATWOOT_BUILD_BRANCH"
  git -C "$CHATWOOT_SOURCE_DIR" merge --ff-only "origin/$CHATWOOT_BUILD_BRANCH"
fi

echo "Creating temporary Chatwoot build instance..."
TEMP_INSTANCE_ID="$(
  aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 run-instances \
    --image-id "$EC2_IMAGE_ID" \
    --instance-type "$CHATWOOT_BUILDER_INSTANCE_TYPE" \
    --key-name "$EC2_KEY_NAME" \
    --security-group-ids "$EC2_SECURITY_GROUP_ID" \
    --subnet-id "$EC2_SUBNET_ID" \
    --block-device-mappings "[{\"DeviceName\":\"/dev/sda1\",\"Ebs\":{\"VolumeSize\":$CHATWOOT_BUILDER_VOLUME_SIZE,\"VolumeType\":\"gp3\"}}]" \
    --query 'Instances[0].InstanceId' \
    --output text
)"

echo "$TEMP_INSTANCE_ID"
echo "EC2 instance is starting, please wait..."
aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 wait instance-status-ok --instance-ids "$TEMP_INSTANCE_ID"

end_time=$(date +%s)
elapsed_time=$((end_time - start_time))
echo "Instance creation took $elapsed_time seconds."

TEMP_DNS="$(
  aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 describe-instances \
    --instance-ids "$TEMP_INSTANCE_ID" \
    --query 'Reservations[0].Instances[0].PublicDnsName' \
    --output text
)"

echo "$TEMP_DNS"

scp -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no \
  "$SCRIPT_DIR/script_to_build_chatwoot_in_new_instance.sh" \
  "ubuntu@$TEMP_DNS:/home/ubuntu/"

for config in "$SCRIPT_DIR/build.config" "$HOME/twenty/build.config" "/home/ubuntu/twenty/build.config"; do
  if [ -f "$config" ]; then
    scp -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "$config" "ubuntu@$TEMP_DNS:/home/ubuntu/"
    break
  fi
done

BUILD_STATUS_LOCAL_FILE="$(mktemp /tmp/chatwoot-build-status.XXXXXX)"
STAGING_ROOT="$(mktemp -d /tmp/chatwoot-build-stage.XXXXXX)"
REMOTE_BUILD_EXIT_CODE=0

set +e
REMOTE_BRANCH="$(shell_quote "$CHATWOOT_BUILD_BRANCH")"
REMOTE_REPO_URL="$(shell_quote "$CHATWOOT_REPO_URL")"
REMOTE_IMAGE_NAME="$(shell_quote "$CHATWOOT_IMAGE_NAME")"
ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "ubuntu@$TEMP_DNS" \
  "chmod +x script_to_build_chatwoot_in_new_instance.sh && CHATWOOT_BUILD_BRANCH=$REMOTE_BRANCH CHATWOOT_REPO_URL=$REMOTE_REPO_URL CHATWOOT_IMAGE_NAME=$REMOTE_IMAGE_NAME ./script_to_build_chatwoot_in_new_instance.sh"
REMOTE_BUILD_EXIT_CODE=$?
set -e

scp -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no \
  "ubuntu@$TEMP_DNS:/home/ubuntu/build_status.env" \
  "$BUILD_STATUS_LOCAL_FILE" 2>/dev/null || true

get_build_status() {
  if [ ! -f "$BUILD_STATUS_LOCAL_FILE" ]; then
    echo "unknown"
    return 0
  fi

  grep '^BUILD_CHATWOOT_IMAGE=' "$BUILD_STATUS_LOCAL_FILE" 2>/dev/null | tail -n 1 | cut -d= -f2 || true
}

CHATWOOT_BUILD_STATUS="$(get_build_status)"
CHATWOOT_BUILD_STATUS="${CHATWOOT_BUILD_STATUS:-unknown}"

if [ "$REMOTE_BUILD_EXIT_CODE" -ne 0 ] || [ "$CHATWOOT_BUILD_STATUS" != "success" ]; then
  echo "Chatwoot image build failed or status is unknown. Keeping existing production image."
  echo "Remote build exit code: $REMOTE_BUILD_EXIT_CODE"
  echo "Build status: $CHATWOOT_BUILD_STATUS"
  exit 1
fi

echo "Copying Chatwoot image artifact from builder..."
scp -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no \
  "ubuntu@$TEMP_DNS:/home/ubuntu/chatwoot-image.tar.gz" \
  "$STAGING_ROOT/chatwoot-image.tar.gz"

scp -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no \
  "ubuntu@$TEMP_DNS:/home/ubuntu/chatwoot-image.sha256" \
  "$STAGING_ROOT/chatwoot-image.sha256" 2>/dev/null || true

if [ -f "$STAGING_ROOT/chatwoot-image.sha256" ]; then
  if command -v sha256sum >/dev/null 2>&1; then
    (cd "$STAGING_ROOT" && sha256sum -c chatwoot-image.sha256)
  else
    (cd "$STAGING_ROOT" && shasum -a 256 -c chatwoot-image.sha256)
  fi
fi

if [ "$CHATWOOT_DEPLOY_AFTER_BUILD" != "1" ]; then
  echo "Chatwoot image built successfully. Deployment skipped because CHATWOOT_DEPLOY_AFTER_BUILD=$CHATWOOT_DEPLOY_AFTER_BUILD."
  echo "Artifact: $STAGING_ROOT/chatwoot-image.tar.gz"
  TZ=Asia/Kolkata date "+%Y-%m-%d %H:%M:%S %Z"
  STAGING_ROOT=""
  exit 0
fi

if [ ! -d "$CHATWOOT_COMPOSE_DIR" ]; then
  echo "Chatwoot compose directory not found: $CHATWOOT_COMPOSE_DIR"
  exit 1
fi

echo "Loading Chatwoot image into local Docker daemon..."
gzip -dc "$STAGING_ROOT/chatwoot-image.tar.gz" | docker load

echo "Preparing Chatwoot database and restarting rails/sidekiq..."
cd "$CHATWOOT_COMPOSE_DIR"
docker compose run --rm rails bundle exec rails db:chatwoot_prepare
docker compose up -d rails sidekiq
docker compose ps

echo "Verifying Chatwoot plan guard..."
docker compose exec -T rails bundle exec rails runner "Internal::CheckNewVersionsJob.perform_now; GlobalConfig.clear_cache; names = %w[DEPLOYMENT_ENV INSTALLATION_PRICING_PLAN INSTALLATION_PRICING_PLAN_QUANTITY]; result = names.to_h { |name| c = InstallationConfig.find_by(name: name); [name, { value: c.value, locked: c.locked }] }; puts result.to_json"

docker builder prune -af || true
docker image prune -f || true

echo "Chatwoot image build and deployment complete."
TZ=Asia/Kolkata date "+%Y-%m-%d %H:%M:%S %Z"
