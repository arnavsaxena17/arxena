#!/bin/bash

# Load build config (branch name, etc.) - single source of truth
# Scripts may live in ~/ (production) or ~/twenty/ (repo); config is in repo
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$SCRIPT_DIR"
for config in "$SCRIPT_DIR/build.config" "$HOME/twenty/build.config" "/home/ubuntu/twenty/build.config"; do
  if [ -f "$config" ]; then
    source "$config"
    break
  fi
done
BUILD_BRANCH="${BUILD_BRANCH:-port/arxena-modules}"

# arxmukti / Graviton defaults (override via env for break-glass)
AWS_PROFILE="${AWS_PROFILE:-arxmukti}"
AWS_CLI_PROFILE_ARGS=()
if [ -n "${AWS_PROFILE:-}" ]; then
  AWS_CLI_PROFILE_ARGS=(--profile "$AWS_PROFILE")
fi
SSH_KEY_PATH="${SSH_KEY_PATH:-$HOME/.ssh/arxmukti-key.pem}"
EC2_IMAGE_ID="${EC2_IMAGE_ID:-ami-0cb194b5ec6f48d24}" # arm64 builder w/ canvas deps (nvm; build script installs Node 24.5.0, yarn, nest, docker)
EC2_INSTANCE_TYPE="${EC2_INSTANCE_TYPE:-t4g.xlarge}"
EC2_KEY_NAME="${EC2_KEY_NAME:-arxmukti-key}"
EC2_SECURITY_GROUP_ID="${EC2_SECURITY_GROUP_ID:-sg-0da9fdd5e7f6c4f1e}"
EC2_SUBNET_ID="${EC2_SUBNET_ID:-subnet-026eb73699b4efba7}"
EC2_VOLUME_SIZE="${EC2_VOLUME_SIZE:-40}"

# 0. Sync production server repo with build branch (ensures package.json has new deps before yarn install).
# Must finish (and re-exec) before bash reads further lines: a mid-run git pull that rewrites
# this file causes "syntax error near unexpected token '('" when the line offsets shift.
if [ "${SKIP_REPO_SYNC:-0}" != "1" ] && [ -d "$REPO_DIR/.git" ]; then
  echo "Syncing repo with build branch ($BUILD_BRANCH)..."
  cd "$REPO_DIR"
  git fetch origin
  git checkout "$BUILD_BRANCH"
  git pull origin "$BUILD_BRANCH" || true
  # Never restore builder scripts from /tmp/build-script-keep — a stale copy
  # previously overwrote the SWC native-binding fix and broke twenty-server on arm64
  # ("Git pulled, going to nest build" with no ensure_swc_native_binding).
  # Orchestrator overrides are opt-in only (KEEP_LOCAL_BUILD_SCRIPTS=1).
  if [ "${KEEP_LOCAL_BUILD_SCRIPTS:-0}" = "1" ]; then
    for f in build_app_in_new_instance.sh build_chatwoot_in_new_instance.sh; do
      if [ -f "/tmp/build-script-keep/$f" ]; then
        echo "Restoring local override from /tmp/build-script-keep/$f"
        cp "/tmp/build-script-keep/$f" "$REPO_DIR/$f"
      fi
    done
  elif [ -d /tmp/build-script-keep ]; then
    echo "Ignoring /tmp/build-script-keep (set KEEP_LOCAL_BUILD_SCRIPTS=1 to restore orchestrator overrides)"
  fi
  cd "$SCRIPT_DIR"
  echo "Re-executing build script after repo sync..."
  exec env SKIP_REPO_SYNC=1 "$REPO_DIR/build_app_in_new_instance.sh" "$@"
fi

# Function to cleanup staging artifacts and terminate the temporary build instance
cleanup() {
    if [ -n "$STAGING_ROOT" ] && [ -d "$STAGING_ROOT" ]; then
        rm -rf "$STAGING_ROOT"
    fi
    if [ -n "$BUILD_STATUS_LOCAL_FILE" ] && [ -f "$BUILD_STATUS_LOCAL_FILE" ]; then
        rm -f "$BUILD_STATUS_LOCAL_FILE"
    fi
    if [ -n "$TEMP_INSTANCE_ID" ]; then
        echo "Cleaning up and terminating instance..."
        aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 terminate-instances --instance-ids $TEMP_INSTANCE_ID
    fi
    exit
}

# Set up trap to call cleanup function on script exit
trap cleanup EXIT
trap cleanup EXIT INT

# Set to exit immediately if a command exits with a non-zero status
set -e

start_time=$(date +%s)

# 1. Create temporary EC2 instance (arm64 builder on arxmukti)
TEMP_INSTANCE_ID=$(aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 run-instances --image-id "$EC2_IMAGE_ID" --instance-type "$EC2_INSTANCE_TYPE" --key-name "$EC2_KEY_NAME" --security-group-ids "$EC2_SECURITY_GROUP_ID" --subnet-id "$EC2_SUBNET_ID" --block-device-mappings "[{\"DeviceName\":\"/dev/sda1\",\"Ebs\":{\"VolumeSize\":$EC2_VOLUME_SIZE,\"VolumeType\":\"gp3\"}}]" --query 'Instances[0].InstanceId' --output text)
# Wait for instance to be running
echo $TEMP_INSTANCE_ID
echo "EC2 instance is starting, please wait....."
aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 wait instance-status-ok --instance-ids $TEMP_INSTANCE_ID
end_time=$(date +%s)
elapsed_time=$((end_time - start_time))
echo "Instance creation took $elapsed_time seconds."




# Prefer private IP when orchestrating from another VPC host (SG self-ref only matches private IP path).
# Fall back to public DNS for laptop-driven builds.
TEMP_PRIVATE_IP=$(aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 describe-instances --instance-ids $TEMP_INSTANCE_ID --query 'Reservations[0].Instances[0].PrivateIpAddress' --output text)
TEMP_PUBLIC_DNS=$(aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 describe-instances --instance-ids $TEMP_INSTANCE_ID --query 'Reservations[0].Instances[0].PublicDnsName' --output text)
IMDS_TOKEN="$(curl -s --connect-timeout 1 -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' || true)"
if [ -n "$IMDS_TOKEN" ] && curl -s --connect-timeout 1 -H "X-aws-ec2-metadata-token: $IMDS_TOKEN" http://169.254.169.254/latest/meta-data/instance-id >/dev/null 2>&1; then
  TEMP_HOST="$TEMP_PRIVATE_IP"
elif [ "${EC2_BUILDER_USE_PRIVATE_IP:-0}" = "1" ]; then
  TEMP_HOST="$TEMP_PRIVATE_IP"
else
  TEMP_HOST="$TEMP_PUBLIC_DNS"
fi
TEMP_DNS="$TEMP_HOST"
# Copy script file
echo "Builder host: $TEMP_DNS (private=$TEMP_PRIVATE_IP public=$TEMP_PUBLIC_DNS)"
# Wait for sshd on the chosen address
for _ in $(seq 1 60); do
  if ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no -o ConnectTimeout=5 "ubuntu@$TEMP_DNS" 'echo ok' >/dev/null 2>&1; then
    break
  fi
  sleep 5
done
scp -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "$SCRIPT_DIR/script_to_build_app_in_new_instance.sh" ubuntu@$TEMP_DNS:/home/ubuntu/
# Copy build.config to temp instance (from repo or script dir)
for config in "$SCRIPT_DIR/build.config" "$REPO_DIR/build.config" "/home/ubuntu/twenty/build.config"; do
  if [ -f "$config" ]; then
    scp -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "$config" ubuntu@$TEMP_DNS:/home/ubuntu/
    break
  fi
done
scp -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "$REPO_DIR/packages/twenty-front/.env" ubuntu@$TEMP_DNS:/home/ubuntu/.env_front
scp -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "$REPO_DIR/packages/twenty-server/.env" ubuntu@$TEMP_DNS:/home/ubuntu/.env_server
scp -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "$REPO_DIR/packages/twenty-website/.env" ubuntu@$TEMP_DNS:/home/ubuntu/.env_website
echo "Maybe finished copying pem files"
# 2. Set up build environment (you'll need to SSH and do this manually or use a script)
# 3. Build your project (SSH and run build commands)
BUILD_STATUS_LOCAL_FILE="$(mktemp /tmp/twenty-build-status.XXXXXX)"
STAGING_ROOT="$(mktemp -d /tmp/twenty-build-stage.XXXXXX)"
REMOTE_BUILD_EXIT_CODE=0

set +e
ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no ubuntu@$TEMP_DNS "BUILD_BRANCH=$BUILD_BRANCH chmod +x script_to_build_app_in_new_instance.sh && BUILD_BRANCH=$BUILD_BRANCH ./script_to_build_app_in_new_instance.sh"
REMOTE_BUILD_EXIT_CODE=$?
set -e

scp -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no ubuntu@$TEMP_DNS:/home/ubuntu/build_status.env "$BUILD_STATUS_LOCAL_FILE" 2>/dev/null || true

get_build_status() {
  local build_name="$1"

  if [ ! -f "$BUILD_STATUS_LOCAL_FILE" ]; then
    echo "unknown"
    return 0
  fi

  local status
  status="$(grep "^BUILD_${build_name}=" "$BUILD_STATUS_LOCAL_FILE" | tail -n 1 | cut -d= -f2)"
  echo "${status:-unknown}"
}

set_deploy_status() {
  local build_name="$1"
  local status="$2"
  eval "DEPLOY_STATUS_${build_name}='$status'"
}

get_deploy_status() {
  local build_name="$1"
  eval "echo \${DEPLOY_STATUS_${build_name}:-kept-existing-files}"
}

stage_remote_dir() {
  local remote_path="$1"
  local stage_path="$2"

  mkdir -p "$stage_path"
  find "$stage_path" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  scp -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no -r "ubuntu@$TEMP_DNS:$remote_path/." "$stage_path/"
}

activate_staged_dir() {
  local stage_path="$1"
  local live_path="$2"

  mkdir -p "$live_path"
  find "$live_path" -mindepth 1 -maxdepth 1 -exec sudo rm -rf {} +
  cp -a "$stage_path"/. "$live_path"/
}

deploy_component() {
  local build_name="$1"
  local label="$2"
  local destination="$3"
  shift 3

  local build_status
  build_status="$(get_build_status "$build_name")"

  if [ "$build_status" != "success" ]; then
    echo "$label build status: $build_status. Keeping existing files."
    return 1
  fi

  local remote_path
  if ! remote_path="$(resolve_remote_dir "$label" "$@")"; then
    echo "$label build succeeded but artifact directory was not found. Keeping existing files."
    return 1
  fi

  local stage_path="$STAGING_ROOT/$build_name"
  if ! stage_remote_dir "$remote_path" "$stage_path"; then
    echo "$label build succeeded but artifact copy failed. Keeping existing files."
    return 1
  fi

  activate_staged_dir "$stage_path" "$destination"
  echo "$label build succeeded and files were updated."
  return 0
}

# Resolve a list of candidate remote directories and return first match.
resolve_remote_dir() {
  local package_name="$1"
  shift
  for candidate in "$@"; do
    if ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no ubuntu@$TEMP_DNS "[ -d '$candidate' ]"; then
      echo "$candidate"
      return 0
    fi
  done
  echo "Unable to locate built $package_name on remote host $TEMP_DNS" >&2
  return 1
}

# 4. Transfer build files
DEPLOYMENTS_APPLIED=0
set_deploy_status TWENTY_SERVER kept-existing-files
set_deploy_status TWENTY_FRONT kept-existing-files
set_deploy_status TWENTY_SHARED kept-existing-files
set_deploy_status TWENTY_CLIENT_SDK kept-existing-files
set_deploy_status TWENTY_ORGCHART kept-existing-files
set_deploy_status TWENTY_UI kept-existing-files
set_deploy_status TWENTY_WEBSITE kept-existing-files
set_deploy_status TWENTY_MCP_SERVER kept-existing-files

if deploy_component TWENTY_SERVER "twenty-server dist" "$REPO_DIR/packages/twenty-server/dist" \
  /home/ubuntu/twenty/packages/twenty-server/dist \
  /home/ubuntu/dist/packages/twenty-server \
  /home/ubuntu/twenty/dist/packages/twenty-server; then
  DEPLOYMENTS_APPLIED=1
  set_deploy_status TWENTY_SERVER updated
fi

if deploy_component TWENTY_FRONT "twenty-front build" "$REPO_DIR/packages/twenty-front/build" \
  /home/ubuntu/twenty/packages/twenty-front/build \
  /home/ubuntu/twenty/dist/packages/twenty-front \
  /home/ubuntu/dist/packages/twenty-front; then
  DEPLOYMENTS_APPLIED=1
  set_deploy_status TWENTY_FRONT updated
fi

# App nginx serves twenty-front/build as the SPA root, so /img/* must exist there.
# Vite includes public/img when present; also copy from website public as a fallback.
ensure_front_orgchart_img_assets() {
  local dest="$REPO_DIR/packages/twenty-front/build/img"
  local src=""

  for candidate in \
    "$REPO_DIR/packages/twenty-front/public/img" \
    "$REPO_DIR/packages/twenty-website/public/img"
  do
    if [ -d "$candidate" ] && [ -f "$candidate/lock.png" ]; then
      src="$candidate"
      break
    fi
  done

  if [ -z "$src" ]; then
    echo "WARNING: org-chart /img assets not found; skipping copy into twenty-front/build/img"
    return 1
  fi

  mkdir -p "$dest"
  cp -a "$src"/. "$dest"/
  echo "Copied org-chart icons from $src into $dest"
}

if deploy_component TWENTY_SHARED "twenty-shared dist" "$REPO_DIR/packages/twenty-shared/dist" \
  /home/ubuntu/twenty/packages/twenty-shared/dist \
  /home/ubuntu/twenty/dist/packages/twenty-shared \
  /home/ubuntu/dist/packages/twenty-shared; then
  DEPLOYMENTS_APPLIED=1
  set_deploy_status TWENTY_SHARED updated
fi

# Server nest build copies client-sdk into dist/assets; keep package dist for local rebuilds too
if deploy_component TWENTY_CLIENT_SDK "twenty-client-sdk dist" "$REPO_DIR/packages/twenty-client-sdk/dist" \
  /home/ubuntu/twenty/packages/twenty-client-sdk/dist \
  /home/ubuntu/twenty/dist/packages/twenty-client-sdk \
  /home/ubuntu/dist/packages/twenty-client-sdk; then
  DEPLOYMENTS_APPLIED=1
  set_deploy_status TWENTY_CLIENT_SDK updated
fi

if deploy_component TWENTY_ORGCHART "twenty-orgchart dist" "$REPO_DIR/packages/twenty-orgchart/dist" \
  /home/ubuntu/twenty/packages/twenty-orgchart/dist \
  /home/ubuntu/twenty/dist/packages/twenty-orgchart \
  /home/ubuntu/dist/packages/twenty-orgchart; then
  DEPLOYMENTS_APPLIED=1
  set_deploy_status TWENTY_ORGCHART updated
fi

if deploy_component TWENTY_UI "twenty-ui dist" "$REPO_DIR/packages/twenty-ui/dist" \
  /home/ubuntu/twenty/packages/twenty-ui/dist \
  /home/ubuntu/twenty/dist/packages/twenty-ui \
  /home/ubuntu/dist/packages/twenty-ui; then
  DEPLOYMENTS_APPLIED=1
  set_deploy_status TWENTY_UI updated
fi

deploy_component TWENTY_FRONT "twenty-front generated locales" "$REPO_DIR/packages/twenty-front/src/locales/generated" \
  /home/ubuntu/twenty/packages/twenty-front/src/locales/generated \
  /home/ubuntu/dist/packages/twenty-front/src/locales/generated || true

deploy_component TWENTY_SERVER "twenty-server generated locales" "$REPO_DIR/packages/twenty-server/src/engine/core-modules/i18n/locales/generated" \
  /home/ubuntu/twenty/packages/twenty-server/src/engine/core-modules/i18n/locales/generated \
  /home/ubuntu/dist/packages/twenty-server/src/engine/core-modules/i18n/locales/generated || true

deploy_component TWENTY_EMAILS "twenty-emails dist" "$REPO_DIR/packages/twenty-emails/dist" \
  /home/ubuntu/twenty/packages/twenty-emails/dist \
  /home/ubuntu/twenty/dist/packages/twenty-emails \
  /home/ubuntu/dist/packages/twenty-emails || true

if deploy_component TWENTY_MCP_SERVER "twenty-mcp-server dist" "$REPO_DIR/packages/twenty-mcp-server/dist" \
  /home/ubuntu/twenty/packages/twenty-mcp-server/dist \
  /home/ubuntu/twenty/dist/packages/twenty-mcp-server \
  /home/ubuntu/dist/packages/twenty-mcp-server; then
  DEPLOYMENTS_APPLIED=1
  set_deploy_status TWENTY_MCP_SERVER updated
fi

if deploy_component TWENTY_WEBSITE "twenty-website .next" "$REPO_DIR/packages/twenty-website/.next" \
  /home/ubuntu/twenty/packages/twenty-website/.next \
  /home/ubuntu/twenty/dist/packages/twenty-website/.next \
  /home/ubuntu/dist/packages/twenty-website/.next; then
  DEPLOYMENTS_APPLIED=1
  set_deploy_status TWENTY_WEBSITE updated
fi

if [ "$DEPLOYMENTS_APPLIED" -eq 1 ]; then
  # Ensure /img/* icons exist under the SPA root even when an older front
  # build artifact omitted public/img (nginx falls back to index.html otherwise).
  ensure_front_orgchart_img_assets || true

  # Copy package.json and yarn.lock so production has same deps as build (avoids missing new packages like apify-client)
  scp -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no ubuntu@$TEMP_DNS:/home/ubuntu/twenty/package.json "$REPO_DIR/package.json"
  scp -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no ubuntu@$TEMP_DNS:/home/ubuntu/twenty/yarn.lock "$REPO_DIR/yarn.lock"
  # Copy workspace package.json files (twenty-server, etc.) so deps match exactly
  for pkg in twenty-server twenty-front twenty-website twenty-shared twenty-client-sdk twenty-orgchart twenty-ui twenty-emails twenty-mcp-server; do
    if [ -d "$REPO_DIR/packages/$pkg" ]; then
      scp -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "ubuntu@$TEMP_DNS:/home/ubuntu/twenty/packages/$pkg/package.json" "$REPO_DIR/packages/$pkg/package.json" 2>/dev/null || true
    fi
  done

  echo "Installing dependencies (ensures new packages like apify-client are available)"
  cd "$REPO_DIR"
  yarn install --frozen-lockfile || yarn install

  # Compile lingui catalogs for server (requires locales/*.po from extract; production deploy copies
  # generated TS from the EC2 build when TWENTY_SERVER succeeds—re-compile here refreshes *.ts from .po)
  cd "$REPO_DIR/packages/twenty-server"
  npx lingui compile --verbose || npx nx run twenty-server:lingui:compile

  # Compile lingui catalogs for frontend
  cd "$REPO_DIR/packages/twenty-front"
  npx lingui compile --verbose || npx nx run twenty-front:lingui:compile

  # Compile lingui catalogs for transactional emails (twenty-emails)
  cd "$REPO_DIR/packages/twenty-emails"
  mkdir -p src/locales/generated
  npx lingui compile --verbose || npx nx run twenty-emails:lingui:compile

  # Static sitemaps need a live twenty-server (SERVER_BASE_URL, typically :3000 on this host).
  # CI build uses build:ci without sitemaps; generate them here before restarting services.
  if [ "$(get_deploy_status TWENTY_WEBSITE)" = "updated" ]; then
    echo "Generating twenty-website static sitemaps on production"
    cd "$REPO_DIR/packages/twenty-website"
    if yarn generate-sitemaps; then
      echo "Static sitemaps generated successfully."
    else
      echo "WARNING: Static sitemap generation failed. Existing sitemap files may be stale."
    fi
  fi

  echo "Restarting NGINX and PM2"
  # 6. Restart services
  sudo systemctl restart nginx
  chmod +x "$REPO_DIR/pm2_start_website.sh" 2>/dev/null || true
  cd "$REPO_DIR"
  pm2 startOrRestart ecosystem.config.js --only arxena-mcp-http || pm2 restart arxena-mcp-http || true
  pm2 restart all
else
  echo "No required application build was deployed. Skipping dependency install and service restart."
fi

echo "Final required build summary before shutdown:"
for build_name in TWENTY_SERVER TWENTY_FRONT TWENTY_ORGCHART TWENTY_SHARED TWENTY_CLIENT_SDK TWENTY_WEBSITE TWENTY_MCP_SERVER; do
  echo " - ${build_name}: build=$(get_build_status "$build_name"), files=$(get_deploy_status "$build_name")"
done

if [ "$REMOTE_BUILD_EXIT_CODE" -ne 0 ]; then
  echo "Remote build script exited with code $REMOTE_BUILD_EXIT_CODE."
fi

TZ=Asia/Kolkata date "+%Y-%m-%d %H:%M:%S %Z"

echo "Operations Complete, Will Power Off"
