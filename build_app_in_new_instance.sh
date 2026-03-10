#!/bin/bash

# Load build config (branch name, etc.) - single source of truth
# Scripts may live in ~/ (production) or ~/twenty/ (repo); config is in repo
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for config in "$SCRIPT_DIR/build.config" "$HOME/twenty/build.config" "/home/ubuntu/twenty/build.config"; do
  if [ -f "$config" ]; then
    source "$config"
    break
  fi
done
BUILD_BRANCH="${BUILD_BRANCH:-without-payment}"

# Function to cleanup and terminate the instance
cleanup() {
    echo "Cleaning up and terminating instance..."
    aws ec2 terminate-instances --instance-ids $TEMP_INSTANCE_ID
    exit
}

# Set up trap to call cleanup function on script exit
trap cleanup EXIT
trap cleanup EXIT INT

# Set to exit immediately if a command exits with a non-zero status
set -e

start_time=$(date +%s)

# 0. Sync production server repo with build branch (ensures package.json has new deps before yarn install)
if [ -d /home/ubuntu/twenty/.git ]; then
  echo "Syncing repo with build branch ($BUILD_BRANCH)..."
  cd /home/ubuntu/twenty
  git fetch origin
  git checkout "$BUILD_BRANCH"
  git pull origin "$BUILD_BRANCH" || true
  cd /home/ubuntu
fi

# 1. Create temporary EC2 instance
TEMP_INSTANCE_ID=$(aws ec2 run-instances --image-id ami-09e12010e9d1fb5a3 --instance-type t2.xlarge --key-name arx-analytics-key --security-group-ids sg-04efe18d868d9a023 --subnet-id subnet-0fe5d2cdf8329f8a5 --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":30,"VolumeType":"gp2"}}]' --query 'Instances[0].InstanceId' --output text)
# Wait for instance to be running
echo $TEMP_INSTANCE_ID
echo "EC2 instance is starting, please wait....."
aws ec2 wait instance-status-ok --instance-ids $TEMP_INSTANCE_ID
end_time=$(date +%s)
elapsed_time=$((end_time - start_time))
echo "Instance creation took $elapsed_time seconds."




# Get public IP of temporary instance
TEMP_DNS=$(aws ec2 describe-instances --instance-ids $TEMP_INSTANCE_ID --query 'Reservations[0].Instances[0].PublicDnsName' --output text)
# Copy script file
echo $TEMP_DNS
scp -i ~/arx-analytics-key.pem -o StrictHostKeyChecking=no ~/script_to_build_app_in_new_instance.sh ubuntu@$TEMP_DNS:/home/ubuntu/
# Copy build.config to temp instance (from repo or script dir)
for config in "$SCRIPT_DIR/build.config" "$HOME/twenty/build.config" "/home/ubuntu/twenty/build.config"; do
  if [ -f "$config" ]; then
    scp -i ~/arx-analytics-key.pem -o StrictHostKeyChecking=no "$config" ubuntu@$TEMP_DNS:/home/ubuntu/
    break
  fi
done
scp -i ~/arx-analytics-key.pem -o StrictHostKeyChecking=no ~/twenty/packages/twenty-front/.env ubuntu@$TEMP_DNS:/home/ubuntu/.env_front
scp -i ~/arx-analytics-key.pem -o StrictHostKeyChecking=no ~/twenty/packages/twenty-server/.env ubuntu@$TEMP_DNS:/home/ubuntu/.env_server
scp -i ~/arx-analytics-key.pem -o StrictHostKeyChecking=no ~/twenty/packages/twenty-website/.env ubuntu@$TEMP_DNS:/home/ubuntu/.env_website
echo "Maybe finished copying pem files"
# 2. Set up build environment (you'll need to SSH and do this manually or use a script)
# 3. Build your project (SSH and run build commands)
ssh -i ~/arx-analytics-key.pem -o StrictHostKeyChecking=no ubuntu@$TEMP_DNS "BUILD_BRANCH=$BUILD_BRANCH chmod +x script_to_build_app_in_new_instance.sh && BUILD_BRANCH=$BUILD_BRANCH ./script_to_build_app_in_new_instance.sh"

# Resolve a list of candidate remote directories and return first match.
resolve_remote_dir() {
  local package_name="$1"
  shift
  for candidate in "$@"; do
    if ssh -i ~/arx-analytics-key.pem -o StrictHostKeyChecking=no ubuntu@$TEMP_DNS "[ -d '$candidate' ]"; then
      echo "$candidate"
      return 0
    fi
  done
  echo "Unable to locate built $package_name on remote host $TEMP_DNS" >&2
  return 1
}

copy_remote_dir() {
  local remote_path="$1"
  local local_path="$2"

  mkdir -p "$local_path"
  sudo rm -rf "$local_path"/*
  scp -i ~/arx-analytics-key.pem -o StrictHostKeyChecking=no -r "ubuntu@$TEMP_DNS:$remote_path/*" "$local_path/"
}

# 4. Transfer build files

# For server files
# First ensure the dist directory exists
REMOTE_TWENTY_SERVER_DIST="$(resolve_remote_dir "twenty-server dist" \
  /home/ubuntu/twenty/packages/twenty-server/dist \
  /home/ubuntu/dist/packages/twenty-server \
  /home/ubuntu/twenty/dist/packages/twenty-server)"
copy_remote_dir "$REMOTE_TWENTY_SERVER_DIST" /home/ubuntu/twenty/packages/twenty-server/dist

# For frontend files
# First ensure the build directory exists
REMOTE_TWENTY_FRONT_BUILD="$(resolve_remote_dir "twenty-front build" \
  /home/ubuntu/twenty/packages/twenty-front/build \
  /home/ubuntu/twenty/dist/packages/twenty-front \
  /home/ubuntu/dist/packages/twenty-front)"
copy_remote_dir "$REMOTE_TWENTY_FRONT_BUILD" /home/ubuntu/twenty/packages/twenty-front/build

REMOTE_TWENTY_SHARED_DIST="$(resolve_remote_dir "twenty-shared dist" \
  /home/ubuntu/twenty/packages/twenty-shared/dist \
  /home/ubuntu/twenty/dist/packages/twenty-shared \
  /home/ubuntu/dist/packages/twenty-shared)"
copy_remote_dir "$REMOTE_TWENTY_SHARED_DIST" /home/ubuntu/twenty/packages/twenty-shared/dist

REMOTE_TWENTY_ORGCHART_DIST="$(resolve_remote_dir "twenty-orgchart dist" \
  /home/ubuntu/twenty/packages/twenty-orgchart/dist \
  /home/ubuntu/twenty/dist/packages/twenty-orgchart \
  /home/ubuntu/dist/packages/twenty-orgchart)"
copy_remote_dir "$REMOTE_TWENTY_ORGCHART_DIST" /home/ubuntu/twenty/packages/twenty-orgchart/dist

mkdir -p /home/ubuntu/twenty/packages/twenty-front/src/locales/generated
# Clear existing files
sudo rm -rf /home/ubuntu/twenty/packages/twenty-front/src/locales/generated/*
# Copy new locale files
REMOTE_TWENTY_FRONT_LOCALES="$(resolve_remote_dir "twenty-front generated locales" \
  /home/ubuntu/twenty/packages/twenty-front/src/locales/generated \
  /home/ubuntu/dist/packages/twenty-front/src/locales/generated)"
copy_remote_dir "$REMOTE_TWENTY_FRONT_LOCALES" /home/ubuntu/twenty/packages/twenty-front/src/locales/generated

# For server locale files (if needed)
mkdir -p /home/ubuntu/twenty/packages/twenty-server/src/engine/core-modules/i18n/locales/generated
# Clear existing files
sudo rm -rf /home/ubuntu/twenty/packages/twenty-server/src/engine/core-modules/i18n/locales/generated/*
# Copy new locale files
REMOTE_TWENTY_SERVER_LOCALES="$(resolve_remote_dir "twenty-server generated locales" \
  /home/ubuntu/twenty/packages/twenty-server/src/engine/core-modules/i18n/locales/generated \
  /home/ubuntu/dist/packages/twenty-server/src/engine/core-modules/i18n/locales/generated)"
copy_remote_dir "$REMOTE_TWENTY_SERVER_LOCALES" /home/ubuntu/twenty/packages/twenty-server/src/engine/core-modules/i18n/locales/generated


# For emails files
mkdir -p /home/ubuntu/twenty/packages/twenty-emails/dist
# Clear existing files
sudo rm -rf /home/ubuntu/twenty/packages/twenty-emails/dist/*
# Copy new emails files
REMOTE_TWENTY_EMAILS_DIST="$(resolve_remote_dir "twenty-emails dist" \
  /home/ubuntu/twenty/packages/twenty-emails/dist \
  /home/ubuntu/twenty/dist/packages/twenty-emails \
  /home/ubuntu/dist/packages/twenty-emails)"
copy_remote_dir "$REMOTE_TWENTY_EMAILS_DIST" /home/ubuntu/twenty/packages/twenty-emails/dist

# For twenty-mcp-server files
mkdir -p /home/ubuntu/twenty/packages/twenty-mcp-server/dist
# Clear existing files
sudo rm -rf /home/ubuntu/twenty/packages/twenty-mcp-server/dist/*
# Copy new twenty-mcp-server files
REMOTE_TWENTY_MCP_SERVER_DIST="$(resolve_remote_dir "twenty-mcp-server dist" \
  /home/ubuntu/twenty/packages/twenty-mcp-server/dist \
  /home/ubuntu/twenty/dist/packages/twenty-mcp-server \
  /home/ubuntu/dist/packages/twenty-mcp-server)"
copy_remote_dir "$REMOTE_TWENTY_MCP_SERVER_DIST" /home/ubuntu/twenty/packages/twenty-mcp-server/dist

mkdir -p /home/ubuntu/twenty/packages/twenty-website/.next
# Clear existing files
sudo rm -rf /home/ubuntu/twenty/packages/twenty-website/.next/*
# Copy new twenty-website files (Next.js outputs to .next, not dist)
REMOTE_TWENTY_WEBSITE_NEXT="$(resolve_remote_dir "twenty-website .next" \
  /home/ubuntu/twenty/packages/twenty-website/.next \
  /home/ubuntu/twenty/dist/packages/twenty-website/.next \
  /home/ubuntu/dist/packages/twenty-website/.next)"
copy_remote_dir "$REMOTE_TWENTY_WEBSITE_NEXT" /home/ubuntu/twenty/packages/twenty-website/.next

# Copy package.json and yarn.lock so production has same deps as build (avoids missing new packages like apify-client)
scp -i ~/arx-analytics-key.pem -o StrictHostKeyChecking=no ubuntu@$TEMP_DNS:/home/ubuntu/twenty/package.json /home/ubuntu/twenty/package.json
scp -i ~/arx-analytics-key.pem -o StrictHostKeyChecking=no ubuntu@$TEMP_DNS:/home/ubuntu/twenty/yarn.lock /home/ubuntu/twenty/yarn.lock
# Copy workspace package.json files (twenty-server, etc.) so deps match exactly
for pkg in twenty-server twenty-front twenty-website twenty-worker twenty-shared twenty-orgchart twenty-emails twenty-mcp-server; do
  if [ -d "/home/ubuntu/twenty/packages/$pkg" ]; then
    scp -i ~/arx-analytics-key.pem -o StrictHostKeyChecking=no "ubuntu@$TEMP_DNS:/home/ubuntu/twenty/packages/$pkg/package.json" "/home/ubuntu/twenty/packages/$pkg/package.json" 2>/dev/null || true
  fi
done

echo "Installing dependencies (ensures new packages like apify-client are available)"
cd /home/ubuntu/twenty
yarn install --frozen-lockfile || yarn install

# Compile lingui catalogs for server
cd /home/ubuntu/twenty/packages/twenty-server
npx lingui compile --verbose || npx nx run twenty-server:lingui:compile

# Compile lingui catalogs for frontend  
cd /home/ubuntu/twenty/packages/twenty-front
npx lingui compile --verbose || npx nx run twenty-front:lingui:compile

echo "Restarting NGINX and PM2"
# 6. Restart services
sudo systemctl restart nginx
pm2 restart all

TZ=Asia/Kolkata date "+%Y-%m-%d %H:%M:%S %Z"

echo "Operations Complete, Will Power Off"
