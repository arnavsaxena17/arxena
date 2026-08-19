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

# Latest builder transcript only (overwritten each run; older logs are discarded).
BUILD_LOG_DIR="${BUILD_LOG_DIR:-$HOME/logs}"
BUILD_LOG_LATEST="${BUILD_LOG_DIR}/build_app.latest.log"
BUILD_TIMING_LOG="${BUILD_TIMING_LOG:-$BUILD_LOG_DIR/build_app.timing.log}"
BUILD_PROCESS_START="${BUILD_PROCESS_START:-$(date +%s)}"
BUILD_TIMING_LOGGED=0
REMOTE_BUILD_LOG_PATH="/home/ubuntu/remote-build.log"

format_duration() {
  local s="${1:-0}"
  local h=$((s / 3600))
  local m=$(((s % 3600) / 60))
  local sec=$((s % 60))
  if [ "$h" -gt 0 ]; then
    printf '%dh %dm %ds (%ss)' "$h" "$m" "$sec" "$s"
  elif [ "$m" -gt 0 ]; then
    printf '%dm %ds (%ss)' "$m" "$sec" "$s"
  else
    printf '%ds' "$s"
  fi
}

log_timing() {
  local label="$1"
  local since="${2:-$BUILD_PROCESS_START}"
  local now elapsed line
  now="$(date +%s)"
  elapsed=$((now - since))
  line="[timing] ${label}: $(format_duration "$elapsed")  ($(TZ=Asia/Kolkata date '+%Y-%m-%d %H:%M:%S %Z'))"
  echo "$line"
  mkdir -p "$BUILD_LOG_DIR"
  echo "$line" >> "$BUILD_TIMING_LOG"
}
TEMP_INSTANCE_ID=""
TEMP_DNS=""
BUILDER_VOLUME_ID=""
REMOTE_BUILD_LOG_SAVED=0
BUILD_LOG_SSH_FALLBACK=""
STAGING_ROOT=""
BUILD_STATUS_LOCAL_FILE=""
CLEANUP_DONE=0
NX_CACHE_PUSHED=0

# AWS CLI profile for launch / EBS / S3. EC2 key pair / PEM is arxmukti-key, not this profile.
AWS_PROFILE="${AWS_PROFILE:-arxmukti}"
AWS_CLI_PROFILE_ARGS=()
if [ -n "${AWS_PROFILE:-}" ]; then
  AWS_CLI_PROFILE_ARGS=(--profile "$AWS_PROFILE")
fi
AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="$AWS_REGION"
SSH_KEY_PATH="${SSH_KEY_PATH:-$HOME/.ssh/arxmukti-key.pem}"
SSH_OPTS=(-o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=15 -o ServerAliveInterval=30 -o ServerAliveCountMax=6)
REMOTE_BUILD_EXIT_GRACE_SECONDS="${REMOTE_BUILD_EXIT_GRACE_SECONDS:-90}"
COMMAND_PROD_TIMEOUT_SECONDS="${COMMAND_PROD_TIMEOUT_SECONDS:-2700}"
EC2_IMAGE_ID="${EC2_IMAGE_ID:-ami-0cb194b5ec6f48d24}" # arm64 builder w/ canvas deps
EC2_INSTANCE_TYPE="${EC2_INSTANCE_TYPE:-t4g.xlarge}"
EC2_KEY_NAME="${EC2_KEY_NAME:-arxmukti-key}"
EC2_SECURITY_GROUP_ID="${EC2_SECURITY_GROUP_ID:-sg-0da9fdd5e7f6c4f1e}"
EC2_SUBNET_ID="${EC2_SUBNET_ID:-subnet-026eb73699b4efba7}"
EC2_VOLUME_SIZE="${EC2_VOLUME_SIZE:-40}"
SKIP_EBS="${SKIP_EBS:-0}"
SKIP_WARM_BUILDER="${SKIP_WARM_BUILDER:-0}"
WARM_BUILDER_TAG_NAME="${WARM_BUILDER_TAG_NAME:-arxena-warm-builder}"
WARM_BUILDER_USED=0
BUILDER_VOLUME_TAG_NAME="${BUILDER_VOLUME_TAG_NAME:-arxena-builder-workspace}"
BUILDER_DATA_VOLUME_SIZE="${BUILDER_DATA_VOLUME_SIZE:-100}"
BUILDER_NX_CACHE_S3="${BUILDER_NX_CACHE_S3:-s3://arxmukti-builder-nx-cache/linux-arm64}"
BUILD_META_FILE="${BUILD_META_FILE:-$REPO_DIR/build-meta.json}"
REMOTE_WORKSPACE="/home/ubuntu/twenty"
PROD_YARN_DONE=0
LOCKFILE_CHANGED=0
LINGUI_SERVER=1
LINGUI_FRONT=1
LINGUI_EMAILS=1
DEPLOYMENTS_APPLIED=0
NGINX_RELOADED=0

# 0. Sync production server repo with build branch (ensures package.json has new deps before yarn install).
# Must finish (and re-exec) before bash reads further lines: a mid-run git pull that rewrites
# this file causes "syntax error near unexpected token '('" when the line offsets shift.
if [ "${SKIP_REPO_SYNC:-0}" != "1" ] && [ -d "$REPO_DIR/.git" ]; then
  mkdir -p "$BUILD_LOG_DIR"
  : > "$BUILD_TIMING_LOG"
  echo "[timing] Build process started  ($(TZ=Asia/Kolkata date '+%Y-%m-%d %H:%M:%S %Z'))"
  echo "[timing] Build process started  ($(TZ=Asia/Kolkata date '+%Y-%m-%d %H:%M:%S %Z'))" >> "$BUILD_TIMING_LOG"
  echo "Syncing repo with build branch ($BUILD_BRANCH)..."
  cd "$REPO_DIR"
  git fetch origin
  git checkout "$BUILD_BRANCH"
  git pull origin "$BUILD_BRANCH" || true
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
  log_timing "Repo sync"
  echo "Re-executing build script after repo sync..."
  exec env SKIP_REPO_SYNC=1 BUILD_PROCESS_START="$BUILD_PROCESS_START" \
    BUILD_TIMING_LOG="$BUILD_TIMING_LOG" \
    "$REPO_DIR/build_app_in_new_instance.sh" "$@"
fi

mkdir -p "$BUILD_LOG_DIR"
if [ ! -f "$BUILD_TIMING_LOG" ]; then
  : > "$BUILD_TIMING_LOG"
  echo "[timing] Build process started  ($(TZ=Asia/Kolkata date '+%Y-%m-%d %H:%M:%S %Z'))"
  echo "[timing] Build process started  ($(TZ=Asia/Kolkata date '+%Y-%m-%d %H:%M:%S %Z'))" >> "$BUILD_TIMING_LOG"
fi

ssh_builder() {
  ssh -i "$SSH_KEY_PATH" "${SSH_OPTS[@]}" "ubuntu@$TEMP_DNS" "$@"
}

rsync_ssh() {
  rsync -az --delete -e "ssh -i ${SSH_KEY_PATH} -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=15" "$@"
}

fetch_remote_build_log() {
  local allow_ssh_fallback="${1:-0}"

  if [ "${REMOTE_BUILD_LOG_SAVED:-0}" = "1" ]; then
    return 0
  fi
  if [ -z "${TEMP_DNS:-}" ] || [ -z "${SSH_KEY_PATH:-}" ]; then
    return 0
  fi

  mkdir -p "$BUILD_LOG_DIR"
  timeout 30 ssh -i "$SSH_KEY_PATH" "${SSH_OPTS[@]}" \
    "ubuntu@$TEMP_DNS" 'sync' >/dev/null 2>&1 || true

  local tmp_log
  tmp_log="$(mktemp "$BUILD_LOG_DIR/build_app.latest.log.XXXXXX")" || return 0
  local attempt
  for attempt in 1 2 3; do
    if timeout 30 scp -i "$SSH_KEY_PATH" "${SSH_OPTS[@]}" \
      "ubuntu@$TEMP_DNS:$REMOTE_BUILD_LOG_PATH" "$tmp_log" 2>/dev/null; then
      mv -f "$tmp_log" "$BUILD_LOG_LATEST" || {
        rm -f "$tmp_log"
        return 0
      }
      echo "$BUILD_LOG_LATEST" > "$BUILD_LOG_DIR/latest_build_app.logpath"
      echo "Saved remote build log to $BUILD_LOG_LATEST"
      REMOTE_BUILD_LOG_SAVED=1
      rm -f "${BUILD_LOG_SSH_FALLBACK:-}"
      return 0
    fi
    sleep 2
  done
  rm -f "$tmp_log"

  if [ "$allow_ssh_fallback" = "1" ] && [ -f "${BUILD_LOG_SSH_FALLBACK:-}" ]; then
    cp -f "$BUILD_LOG_SSH_FALLBACK" "$BUILD_LOG_LATEST"
    echo "$BUILD_LOG_LATEST" > "$BUILD_LOG_DIR/latest_build_app.logpath"
    echo "Remote build log missing; saved SSH transcript to $BUILD_LOG_LATEST"
    REMOTE_BUILD_LOG_SAVED=1
    rm -f "$BUILD_LOG_SSH_FALLBACK"
    return 0
  fi

  echo "WARNING: Could not copy remote build log from $TEMP_DNS:$REMOTE_BUILD_LOG_PATH"
  return 0
}

push_nx_cache_to_s3() {
  if [ "${NX_CACHE_PUSHED:-0}" = "1" ]; then
    return 0
  fi
  if [ -z "${TEMP_DNS:-}" ]; then
        return 0
      fi
  local remote_cache="${REMOTE_WORKSPACE}/.nx/cache"
  if ! ssh_builder "test -d '$remote_cache'" 2>/dev/null; then
    return 0
  fi
  echo "Mirroring Nx task cache to $BUILDER_NX_CACHE_S3"
  local tmp
  tmp="$(mktemp -d /tmp/nx-cache-push.XXXXXX)"
  rsync_ssh "ubuntu@${TEMP_DNS}:${remote_cache}/" "$tmp/" || true
  aws "${AWS_CLI_PROFILE_ARGS[@]}" s3 sync "$tmp" "$BUILDER_NX_CACHE_S3" --only-show-errors || \
    echo "WARNING: Nx cache S3 push failed"
  rm -rf "$tmp"
  NX_CACHE_PUSHED=1
}

detach_builder_volume() {
  if [ -z "${BUILDER_VOLUME_ID:-}" ]; then
    return 0
  fi
  if [ -n "${TEMP_DNS:-}" ]; then
    ssh_builder 'sudo umount /mnt/builder 2>/dev/null || true' || true
  fi
  echo "Detaching data volume $BUILDER_VOLUME_ID..."
  aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 detach-volume \
    --volume-id "$BUILDER_VOLUME_ID" \
    ${TEMP_INSTANCE_ID:+--instance-id "$TEMP_INSTANCE_ID"} >/dev/null 2>&1 || \
    aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 detach-volume \
      --volume-id "$BUILDER_VOLUME_ID" --force >/dev/null 2>&1 || true
  aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 wait volume-available --volume-ids "$BUILDER_VOLUME_ID" 2>/dev/null || true
  aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 delete-tags --resources "$BUILDER_VOLUME_ID" \
    --tags Key=AttachedTo >/dev/null 2>&1 || true
}

run_prod_server_command() {
  local label="$1"
  shift

  echo "Running production command: $label ($*)"
  cd "$REPO_DIR/packages/twenty-server"
  if command -v timeout >/dev/null 2>&1; then
    timeout --kill-after=60s "${COMMAND_PROD_TIMEOUT_SECONDS}" \
      yarn command:prod "$@"
  else
    yarn command:prod "$@"
  fi
}

run_production_upgrade() {
  if [ "${SKIP_PROD_UPGRADE:-0}" = "1" ]; then
    echo "SKIP_PROD_UPGRADE=1 — skipping yarn command:prod upgrade"
    return 0
  fi

  echo "Running production workspace upgrade (cache flush → upgrade → cache flush)"
  if ! run_prod_server_command cache:flush cache:flush; then
    echo "WARNING: cache:flush before upgrade failed; continuing"
  fi
  if run_prod_server_command upgrade upgrade; then
    echo "Production upgrade completed."
  else
    echo "WARNING: yarn command:prod upgrade exited non-zero. Some workspaces may not be fully migrated. Check logs."
  fi
  if ! run_prod_server_command cache:flush cache:flush; then
    echo "WARNING: cache:flush after upgrade failed; continuing"
  fi
}

cleanup() {
    local exit_code=$?
    if [ "${CLEANUP_DONE:-0}" = "1" ]; then
      exit "$exit_code"
    fi
    CLEANUP_DONE=1
    fetch_remote_build_log 1
    push_nx_cache_to_s3 || true
    rm -f "${BUILD_LOG_SSH_FALLBACK:-}"
    if [ -n "${STAGING_ROOT:-}" ] && [ -d "$STAGING_ROOT" ]; then
        rm -rf "$STAGING_ROOT"
    fi
    if [ -n "${BUILD_STATUS_LOCAL_FILE:-}" ] && [ -f "$BUILD_STATUS_LOCAL_FILE" ]; then
        rm -f "$BUILD_STATUS_LOCAL_FILE"
    fi
    if [ -n "$TEMP_INSTANCE_ID" ]; then
      aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 delete-tags --resources "$TEMP_INSTANCE_ID" \
        --tags Key=BuildLock >/dev/null 2>&1 || true
    fi
    if [ "$SKIP_WARM_BUILDER" != "1" ] && [ "${WARM_BUILDER_USED:-0}" = "1" ] && [ -n "$TEMP_INSTANCE_ID" ]; then
        echo "Stopping warm builder $TEMP_INSTANCE_ID (data volume stays attached)..."
        timeout 60 aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 stop-instances --instance-ids "$TEMP_INSTANCE_ID" || \
          aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 stop-instances --instance-ids "$TEMP_INSTANCE_ID"
        aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 wait instance-stopped --instance-ids "$TEMP_INSTANCE_ID" || true
    else
        detach_builder_volume
        if [ -n "$TEMP_INSTANCE_ID" ]; then
            echo "Cleaning up and terminating instance..."
            timeout 60 aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 terminate-instances --instance-ids $TEMP_INSTANCE_ID || \
              aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 terminate-instances --instance-ids $TEMP_INSTANCE_ID
        fi
    fi
    if [ "${BUILD_TIMING_LOGGED:-0}" != "1" ]; then
      log_timing "Build process finished (total, including cleanup)"
      echo "[timing] Timing log: $BUILD_TIMING_LOG"
      BUILD_TIMING_LOGGED=1
    fi
    exit "$exit_code"
}

trap cleanup EXIT
trap cleanup EXIT INT

set -e
export NX_DAEMON=false

HEAD_SHA="$(cd "$REPO_DIR" && git rev-parse HEAD 2>/dev/null || echo "")"

read_meta_value() {
  python3 - "$BUILD_META_FILE" "$1" <<'PY'
import json, os, sys
path, key = sys.argv[1], sys.argv[2]
if not os.path.exists(path):
    print("")
    raise SystemExit
try:
    data = json.load(open(path))
except Exception:
    print("")
    raise SystemExit
if key == "commit":
    print(data.get("commit") or "")
else:
    print((data.get("packages") or {}).get(key) or "")
PY
}

write_meta_value() {
  python3 - "$BUILD_META_FILE" "$1" "$2" <<'PY'
import json, os, sys
path, key, sha = sys.argv[1], sys.argv[2], sys.argv[3]
data = {"commit": "", "packages": {}}
if os.path.exists(path):
    try:
        loaded = json.load(open(path))
        if isinstance(loaded, dict):
            data.update(loaded)
    except Exception:
        pass
if not isinstance(data.get("packages"), dict):
    data["packages"] = {}
if key == "commit":
    data["commit"] = sha
else:
    data["packages"][key] = sha
os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
with open(path, "w") as handle:
    json.dump(data, handle, indent=2)
    handle.write("\n")
PY
}

expand_dependents() {
  case "$1" in
    TWENTY_SHARED)
      echo "TWENTY_SHARED TWENTY_SERVER TWENTY_FRONT TWENTY_UI TWENTY_ORGCHART TWENTY_WEBSITE TWENTY_EMAILS TWENTY_MCP_SERVER"
      ;;
    TWENTY_CLIENT_SDK) echo "TWENTY_CLIENT_SDK TWENTY_SERVER" ;;
    TWENTY_UI) echo "TWENTY_UI TWENTY_FRONT TWENTY_ORGCHART" ;;
    TWENTY_ORGCHART) echo "TWENTY_ORGCHART TWENTY_FRONT" ;;
    TWENTY_FRONT_COMPONENT_RENDERER) echo "TWENTY_FRONT_COMPONENT_RENDERER TWENTY_FRONT" ;;
    *) echo "$1" ;;
  esac
}

map_path_to_builds() {
  local file="$1"
  case "$file" in
    yarn.lock|package.json|.yarnrc.yml|yarn.config.cjs)
      echo ALL
      ;;
    packages/twenty-shared/*|packages/twenty-shared)
      expand_dependents TWENTY_SHARED
      ;;
    packages/twenty-client-sdk/*)
      expand_dependents TWENTY_CLIENT_SDK
      ;;
    packages/twenty-ui/*)
      expand_dependents TWENTY_UI
      ;;
    packages/twenty-orgchart/*)
      expand_dependents TWENTY_ORGCHART
      ;;
    packages/twenty-front-component-renderer/*)
      expand_dependents TWENTY_FRONT_COMPONENT_RENDERER
      ;;
    packages/twenty-server/*)
      echo TWENTY_SERVER
      ;;
    packages/twenty-front/*)
      echo TWENTY_FRONT
      ;;
    packages/twenty-website/*)
      echo TWENTY_WEBSITE
      ;;
    packages/twenty-emails/*)
      echo TWENTY_EMAILS
      ;;
    packages/twenty-mcp-server/*)
      echo TWENTY_MCP_SERVER
      ;;
    packages/twenty-docs/*)
      echo TWENTY_DOCS
      ;;
  esac
}

map_nx_project() {
  case "$1" in
    twenty-shared) echo TWENTY_SHARED ;;
    twenty-client-sdk) echo TWENTY_CLIENT_SDK ;;
    twenty-ui) echo TWENTY_UI ;;
    twenty-orgchart) echo TWENTY_ORGCHART ;;
    twenty-front-component-renderer) echo TWENTY_FRONT_COMPONENT_RENDERER ;;
    twenty-server) echo TWENTY_SERVER ;;
    twenty-front) echo TWENTY_FRONT ;;
    twenty-website) echo TWENTY_WEBSITE ;;
    twenty-emails) echo TWENTY_EMAILS ;;
    twenty-mcp-server) echo TWENTY_MCP_SERVER ;;
    twenty-docs) echo TWENTY_DOCS ;;
  esac
}

compute_lingui_flags() {
  LINGUI_SERVER=1
  LINGUI_FRONT=1
  LINGUI_EMAILS=1
  if [ -z "${LAST_DEPLOY_SHA:-}" ]; then
    echo "Lingui extract: all packages (no last deploy SHA)"
    return 0
  fi
  local files
  files="$(git -C "$REPO_DIR" diff --name-only "$LAST_DEPLOY_SHA" HEAD || true)"
  LINGUI_SERVER=0
  LINGUI_FRONT=0
  LINGUI_EMAILS=0
  if echo "$files" | grep -Eq '^packages/twenty-server/(src/|locales/)|packages/twenty-server/.*/locales/|packages/twenty-server/.*\.(po|pot)$'; then
    LINGUI_SERVER=1
  fi
  if echo "$files" | grep -Eq '^packages/twenty-front/(src/|locales/)|packages/twenty-front/.*/locales/|packages/twenty-front/.*\.(po|pot)$'; then
    LINGUI_FRONT=1
  fi
  if echo "$files" | grep -Eq '^packages/twenty-emails/(src/|locales/)|packages/twenty-emails/.*/locales/|packages/twenty-emails/.*\.(po|pot)$'; then
    LINGUI_EMAILS=1
  fi
  echo "Lingui extract flags: server=$LINGUI_SERVER front=$LINGUI_FRONT emails=$LINGUI_EMAILS"
}

compute_selected_builds() {
  SELECTED_BUILDS=""
  LAST_DEPLOY_SHA="$(read_meta_value commit 2>/dev/null || true)"
  if ! command -v python3 >/dev/null 2>&1; then
    SELECTED_BUILDS="ALL"
    echo "python3 not found — building all packages"
    return 0
  fi
  if [ "${FORCE_FULL_BUILD:-0}" = "1" ]; then
    SELECTED_BUILDS="ALL"
    echo "FORCE_FULL_BUILD=1 — building all packages"
    return 0
  fi

  local base_sha
  base_sha="$LAST_DEPLOY_SHA"
  if [ -z "$base_sha" ]; then
    SELECTED_BUILDS="ALL"
    echo "No build-meta.json commit — building all packages"
    return 0
  fi

  if ! git -C "$REPO_DIR" cat-file -e "${base_sha}^{commit}" 2>/dev/null; then
    git -C "$REPO_DIR" fetch --depth 1 origin "$base_sha" 2>/dev/null || true
  fi
  if ! git -C "$REPO_DIR" cat-file -e "${base_sha}^{commit}" 2>/dev/null; then
    SELECTED_BUILDS="ALL"
    LAST_DEPLOY_SHA=""
    echo "Last deploy SHA $base_sha not in git — building all packages"
    return 0
  fi

  local files selected=""
  files="$(git -C "$REPO_DIR" diff --name-only "$base_sha" HEAD || true)"
  if echo "$files" | grep -Eq '^(yarn\.lock|package\.json|\.yarnrc\.yml|yarn\.config\.cjs)$'; then
    LOCKFILE_CHANGED=1
  fi

  local file mapped name
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    mapped="$(map_path_to_builds "$file")"
    if [ "$mapped" = "ALL" ]; then
      SELECTED_BUILDS="ALL"
      LOCKFILE_CHANGED=1
      LAST_DEPLOY_SHA="$base_sha"
      echo "Root lockfile/manifest changed — building all packages"
      return 0
    fi
    for name in $mapped; do
      case " $selected " in
        *" $name "*) ;;
        *) selected="${selected:+$selected }$name" ;;
      esac
    done
  done <<< "$files"

  if [ -x "$REPO_DIR/node_modules/.bin/nx" ]; then
    local nx_projects proj mapped_proj
    nx_projects="$(
      cd "$REPO_DIR" && ./node_modules/.bin/nx show projects --affected \
        --base="$base_sha" --head=HEAD 2>/dev/null || true
    )"
    for proj in $nx_projects; do
      mapped_proj="$(map_nx_project "$proj")"
      [ -z "$mapped_proj" ] && continue
      for name in $(expand_dependents "$mapped_proj"); do
        case " $selected " in
          *" $name "*) ;;
          *) selected="${selected:+$selected }$name" ;;
        esac
      done
    done
  fi

  SELECTED_BUILDS="$selected"
  LAST_DEPLOY_SHA="$base_sha"
  if [ -z "$SELECTED_BUILDS" ]; then
    echo "No affected packages since $base_sha"
  else
    echo "Affected packages since $base_sha: $SELECTED_BUILDS"
  fi
}

is_selected() {
  local name="$1"
  if [ "$SELECTED_BUILDS" = "ALL" ] || [ -z "${SELECTED_BUILDS:-}" ]; then
    return 0
  fi
  case " $SELECTED_BUILDS " in
    *" $name "*) return 0 ;;
    *) return 1 ;;
  esac
}

ensure_s3_bucket() {
  local bucket prefix
  bucket="$(echo "$BUILDER_NX_CACHE_S3" | sed -E 's#^s3://([^/]+).*#\1#')"
  prefix="$(echo "$BUILDER_NX_CACHE_S3" | sed -E 's#^s3://[^/]+/?##')"
  if [ -z "$bucket" ]; then
    return 0
  fi
  if ! aws "${AWS_CLI_PROFILE_ARGS[@]}" s3api head-bucket --bucket "$bucket" 2>/dev/null; then
    echo "Creating S3 bucket $bucket in $AWS_REGION..."
    local create_out
    if [ "$AWS_REGION" = "us-east-1" ]; then
      create_out="$(aws "${AWS_CLI_PROFILE_ARGS[@]}" s3api create-bucket --bucket "$bucket" 2>&1)" || true
    else
      create_out="$(aws "${AWS_CLI_PROFILE_ARGS[@]}" s3api create-bucket --bucket "$bucket" \
        --create-bucket-configuration LocationConstraint="$AWS_REGION" 2>&1)" || true
    fi
    if ! aws "${AWS_CLI_PROFILE_ARGS[@]}" s3api head-bucket --bucket "$bucket" 2>/dev/null; then
      echo "WARNING: Could not create or access s3://$bucket"
      echo "$create_out"
      echo "Nx cache sync will be skipped until the instance role can s3:CreateBucket/s3:PutObject on this bucket."
      return 0
    fi
    echo "Created s3://$bucket"
  fi
  echo "Nx cache URI s3://${bucket}/${prefix}"
}

pull_nx_cache_from_s3() {
  local remote_cache="${REMOTE_WORKSPACE}/.nx/cache"
  if ssh_builder "test -d '$remote_cache' && find '$remote_cache' -mindepth 1 -print -quit | grep -q ."; then
    echo "Nx cache already present on data volume; skipping S3 pull"
    return 0
  fi
  echo "Seeding Nx task cache from $BUILDER_NX_CACHE_S3"
  local tmp
  tmp="$(mktemp -d /tmp/nx-cache-pull.XXXXXX)"
  aws "${AWS_CLI_PROFILE_ARGS[@]}" s3 sync "$BUILDER_NX_CACHE_S3" "$tmp" --only-show-errors || true
  if [ -n "$(ls -A "$tmp" 2>/dev/null)" ]; then
    ssh_builder "mkdir -p '$remote_cache'"
    rsync_ssh "$tmp/" "ubuntu@${TEMP_DNS}:${remote_cache}/" || true
  fi
  rm -rf "$tmp"
}

mount_builder_volume() {
  ssh_builder 'bash -s' <<'EOF'
set -euo pipefail
LABEL=arxena-builder
sudo mkdir -p /mnt/builder
if findmnt /mnt/builder >/dev/null 2>&1; then
  sudo chown ubuntu:ubuntu /mnt/builder
  mkdir -p /mnt/builder/twenty /mnt/builder/yarn-cache
  ln -sfn /mnt/builder/twenty "$HOME/twenty"
  echo "Data volume already mounted"
  exit 0
fi
ROOT_PK="$(lsblk -ndo PKNAME "$(findmnt -n -o SOURCE /)" 2>/dev/null | head -1 || true)"
DEV=""
for _ in $(seq 1 30); do
  for cand in /dev/nvme1n1 /dev/nvme2n1 /dev/xvdf /dev/sdf; do
    [ -b "$cand" ] || continue
    base="$(basename "$cand")"
    [ -n "$ROOT_PK" ] && [ "$base" = "$ROOT_PK" ] && continue
    if findmnt "$cand" >/dev/null 2>&1; then
      continue
    fi
    DEV="$cand"
    break
  done
  [ -n "$DEV" ] && break
  sleep 2
done
if [ -z "$DEV" ]; then
  echo "WARNING: data volume device not found; using instance root disk"
  mkdir -p "$HOME/twenty"
  exit 0
fi
if ! sudo blkid "$DEV" >/dev/null 2>&1; then
  echo "Formatting $DEV as ext4 ($LABEL)"
  sudo mkfs.ext4 -F -L "$LABEL" "$DEV"
fi
sudo mount "$DEV" /mnt/builder
sudo chown ubuntu:ubuntu /mnt/builder
mkdir -p /mnt/builder/twenty /mnt/builder/yarn-cache
ln -sfn /mnt/builder/twenty "$HOME/twenty"
echo "Mounted $DEV on /mnt/builder"
EOF
}

attach_builder_volume() {
  if [ "$SKIP_EBS" = "1" ]; then
    echo "SKIP_EBS=1 — builder workspace on instance root disk"
    REMOTE_WORKSPACE="/home/ubuntu/twenty"
    return 0
  fi
  local helper="$SCRIPT_DIR/scripts/aws/ensure-builder-volume.sh"
  if [ ! -x "$helper" ]; then
    chmod +x "$helper" 2>/dev/null || true
  fi
  BUILDER_VOLUME_ID="$(
    AWS_PROFILE="$AWS_PROFILE" AWS_REGION="$AWS_REGION" \
      EC2_SUBNET_ID="$EC2_SUBNET_ID" \
      BUILDER_VOLUME_TAG_NAME="$BUILDER_VOLUME_TAG_NAME" \
      BUILDER_DATA_VOLUME_SIZE="$BUILDER_DATA_VOLUME_SIZE" \
      "$helper"
  )"
  echo "Data volume: $BUILDER_VOLUME_ID"
  local state attached_to
  state="$(
    aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 describe-volumes \
      --volume-ids "$BUILDER_VOLUME_ID" \
      --query 'Volumes[0].State' --output text
  )"
  attached_to="$(
    aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 describe-volumes \
      --volume-ids "$BUILDER_VOLUME_ID" \
      --query 'Volumes[0].Attachments[0].InstanceId' --output text
  )"
  if [ "$state" = "in-use" ] && [ "$attached_to" = "$TEMP_INSTANCE_ID" ]; then
    echo "Data volume already attached to $TEMP_INSTANCE_ID"
  else
    if [ "$state" = "in-use" ]; then
      echo "Volume in-use on ${attached_to}; attempting force detach from a previous builder..."
      aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 detach-volume --volume-id "$BUILDER_VOLUME_ID" --force >/dev/null || true
      aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 wait volume-available --volume-ids "$BUILDER_VOLUME_ID"
    fi
    aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 attach-volume \
      --volume-id "$BUILDER_VOLUME_ID" \
      --instance-id "$TEMP_INSTANCE_ID" \
      --device /dev/sdf >/dev/null
    aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 wait volume-in-use --volume-ids "$BUILDER_VOLUME_ID"
  fi
  aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 create-tags --resources "$BUILDER_VOLUME_ID" \
    --tags "Key=AttachedTo,Value=$TEMP_INSTANCE_ID" >/dev/null || true
  sleep 3
  mount_builder_volume
  if ssh_builder 'test -d /mnt/builder/twenty'; then
    REMOTE_WORKSPACE="/mnt/builder/twenty"
  else
    REMOTE_WORKSPACE="/home/ubuntu/twenty"
  fi
  echo "Remote workspace: $REMOTE_WORKSPACE"
}

tag_warm_builder() {
  local id="$1"
  [ -z "$id" ] && return 0
  aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 create-tags --resources "$id" \
    --tags "Key=Name,Value=$WARM_BUILDER_TAG_NAME" "Key=Purpose,Value=twenty-build" >/dev/null || true
}

set_builder_lock() {
  [ -z "$TEMP_INSTANCE_ID" ] && return 0
  aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 create-tags --resources "$TEMP_INSTANCE_ID" \
    --tags "Key=BuildLock,Value=${HOSTNAME:-prod}-$$" >/dev/null || true
}

refresh_builder_host() {
  TEMP_PRIVATE_IP=$(aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 describe-instances --instance-ids "$TEMP_INSTANCE_ID" --query 'Reservations[0].Instances[0].PrivateIpAddress' --output text)
  TEMP_PUBLIC_DNS=$(aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 describe-instances --instance-ids "$TEMP_INSTANCE_ID" --query 'Reservations[0].Instances[0].PublicDnsName' --output text)
  IMDS_TOKEN="$(curl -s --connect-timeout 1 -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' || true)"
  if [ -n "$IMDS_TOKEN" ] && curl -s --connect-timeout 1 -H "X-aws-ec2-metadata-token: $IMDS_TOKEN" http://169.254.169.254/latest/meta-data/instance-id >/dev/null 2>&1; then
    TEMP_HOST="$TEMP_PRIVATE_IP"
  elif [ "${EC2_BUILDER_USE_PRIVATE_IP:-0}" = "1" ]; then
    TEMP_HOST="$TEMP_PRIVATE_IP"
  else
    TEMP_HOST="$TEMP_PUBLIC_DNS"
  fi
  TEMP_DNS="$TEMP_HOST"
  echo "Builder host: $TEMP_DNS (private=$TEMP_PRIVATE_IP public=$TEMP_PUBLIC_DNS)"
}

wait_builder_ssh() {
  local i
  for i in $(seq 1 60); do
    if ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no -o ConnectTimeout=5 "ubuntu@$TEMP_DNS" 'echo ok' >/dev/null 2>&1; then
      return 0
    fi
    sleep 5
  done
  echo "WARNING: SSH to ubuntu@$TEMP_DNS did not succeed within 5 minutes"
}

launch_fresh_builder() {
  local tag_spec=()
  if [ "$SKIP_WARM_BUILDER" != "1" ]; then
    tag_spec=(--tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=${WARM_BUILDER_TAG_NAME}},{Key=Purpose,Value=twenty-build}]")
  fi
  TEMP_INSTANCE_ID=$(aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 run-instances \
    --image-id "$EC2_IMAGE_ID" --instance-type "$EC2_INSTANCE_TYPE" --key-name "$EC2_KEY_NAME" \
    --security-group-ids "$EC2_SECURITY_GROUP_ID" --subnet-id "$EC2_SUBNET_ID" \
    --block-device-mappings "[{\"DeviceName\":\"/dev/sda1\",\"Ebs\":{\"VolumeSize\":$EC2_VOLUME_SIZE,\"VolumeType\":\"gp3\"}}]" \
    "${tag_spec[@]}" \
    --query 'Instances[0].InstanceId' --output text)
  echo "$TEMP_INSTANCE_ID"
  echo "EC2 instance is starting, please wait....."
  aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 wait instance-status-ok --instance-ids "$TEMP_INSTANCE_ID"
  log_timing "EC2 instance launch and status-ok" "$INSTANCE_START"
  if [ "$SKIP_WARM_BUILDER" != "1" ]; then
    tag_warm_builder "$TEMP_INSTANCE_ID"
    WARM_BUILDER_USED=1
  fi
}

start_existing_builder() {
  local id="$1"
  echo "Starting warm builder $id..."
  if ! aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 start-instances --instance-ids "$id" >/dev/null; then
    echo "start-instances failed for $id; launching a replacement and terminating the broken instance"
    aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 terminate-instances --instance-ids "$id" >/dev/null || true
    launch_fresh_builder
    return 0
  fi
  TEMP_INSTANCE_ID="$id"
  if ! aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 wait instance-status-ok --instance-ids "$id"; then
    echo "Warm builder $id did not reach status-ok; launching a replacement"
    aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 terminate-instances --instance-ids "$id" >/dev/null || true
    launch_fresh_builder
    return 0
  fi
  log_timing "Warm builder start" "$INSTANCE_START"
  tag_warm_builder "$id"
  WARM_BUILDER_USED=1
}

acquire_builder_instance() {
  INSTANCE_START="$(date +%s)"
  if [ "$SKIP_WARM_BUILDER" = "1" ]; then
    WARM_BUILDER_USED=0
    launch_fresh_builder
    refresh_builder_host
    wait_builder_ssh
    return 0
  fi

  local id state lock pick_stopped="" pick_running="" pick_stopping=""
  while IFS=$'\t' read -r id state lock; do
    [ -z "$id" ] && continue
    case "$state" in
      stopped)
        pick_stopped="$id"
        ;;
      stopping)
        pick_stopping="$id"
        ;;
      running|pending)
        if [ -z "$lock" ] || [ "$lock" = "None" ] || [ "$lock" = "none" ]; then
          pick_running="$id"
        else
          echo "Warm builder $id is running with BuildLock=$lock"
          if [ -z "$pick_running" ]; then
            pick_running="BUSY:$id"
          fi
        fi
        ;;
    esac
  done < <(
    aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 describe-instances \
      --filters "Name=tag:Name,Values=$WARM_BUILDER_TAG_NAME" \
        "Name=instance-state-name,Values=pending,running,stopping,stopped" \
      --query 'Reservations[].Instances[].[InstanceId,State.Name,Tags[?Key==`BuildLock`].Value|[0]]' \
      --output text 2>/dev/null || true
  )

  if [ -n "$pick_running" ] && [[ "$pick_running" != BUSY:* ]]; then
    TEMP_INSTANCE_ID="$pick_running"
    WARM_BUILDER_USED=1
    echo "Reusing already-running warm builder $TEMP_INSTANCE_ID"
    aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 wait instance-status-ok --instance-ids "$TEMP_INSTANCE_ID" || true
    log_timing "Warm builder reuse (already running)" "$INSTANCE_START"
    tag_warm_builder "$TEMP_INSTANCE_ID"
  elif [ -n "$pick_stopped" ]; then
    start_existing_builder "$pick_stopped"
  elif [ -n "$pick_stopping" ]; then
    echo "Waiting for warm builder $pick_stopping to finish stopping..."
    aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 wait instance-stopped --instance-ids "$pick_stopping" || true
    start_existing_builder "$pick_stopping"
  elif [ -n "$pick_running" ]; then
    local busy_id="${pick_running#BUSY:}"
    echo "Waiting up to 20 minutes for BuildLock to clear on $busy_id..."
    local waited=0
    lock="busy"
    while [ "$waited" -lt 40 ]; do
      lock="$(
        aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 describe-instances --instance-ids "$busy_id" \
          --query 'Reservations[0].Instances[0].Tags[?Key==`BuildLock`].Value|[0]' --output text 2>/dev/null || echo None
      )"
      state="$(
        aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 describe-instances --instance-ids "$busy_id" \
          --query 'Reservations[0].Instances[0].State.Name' --output text 2>/dev/null || echo none
      )"
      if [ "$state" = "stopped" ]; then
        start_existing_builder "$busy_id"
        lock=""
        break
      fi
      if [ -z "$lock" ] || [ "$lock" = "None" ] || [ "$lock" = "none" ]; then
        TEMP_INSTANCE_ID="$busy_id"
        WARM_BUILDER_USED=1
        aws "${AWS_CLI_PROFILE_ARGS[@]}" ec2 wait instance-status-ok --instance-ids "$TEMP_INSTANCE_ID" || true
        log_timing "Warm builder reuse (lock cleared)" "$INSTANCE_START"
        break
      fi
      sleep 30
      waited=$((waited + 1))
    done
    if [ -z "$TEMP_INSTANCE_ID" ]; then
      echo "ERROR: Warm builder $busy_id is still locked after 20 minutes. Set SKIP_WARM_BUILDER=1 to launch a throwaway instance."
      exit 1
    fi
  else
    echo "No warm builder tagged $WARM_BUILDER_TAG_NAME; launching a new one"
    launch_fresh_builder
  fi

  tag_warm_builder "$TEMP_INSTANCE_ID"
  set_builder_lock
  refresh_builder_host
  wait_builder_ssh
}

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

get_build_ready_path() {
  local build_name="$1"
  if [ ! -f "$BUILD_STATUS_LOCAL_FILE" ]; then
    echo ""
    return 0
  fi
  grep "^BUILD_READY_${build_name}=" "$BUILD_STATUS_LOCAL_FILE" | tail -n 1 | cut -d= -f2-
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

refresh_build_status() {
  if [ -z "${TEMP_DNS:-}" ]; then
    return 1
  fi
  scp -i "$SSH_KEY_PATH" "${SSH_OPTS[@]}" \
    "ubuntu@$TEMP_DNS:/home/ubuntu/build_status.env" "$BUILD_STATUS_LOCAL_FILE" 2>/dev/null || return 1
  return 0
}

stage_remote_dir() {
  local remote_path="$1"
  local stage_path="$2"

  mkdir -p "$stage_path"
  find "$stage_path" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  rsync_ssh "ubuntu@${TEMP_DNS}:${remote_path}/" "$stage_path/"
}

activate_staged_dir() {
  local stage_path="$1"
  local live_path="$2"

  mkdir -p "$live_path"
  find "$live_path" -mindepth 1 -maxdepth 1 -exec sudo rm -rf {} +
  cp -a "$stage_path"/. "$live_path"/
}

resolve_remote_dir() {
  local package_name="$1"
  local ready="$2"
  shift 2
  if [ -n "$ready" ]; then
    if ssh_builder "[ -d '$ready' ]"; then
      echo "$ready"
      return 0
    fi
  fi
  for candidate in "$@"; do
    if ssh_builder "[ -d '$candidate' ]"; then
      echo "$candidate"
      return 0
    fi
  done
  echo "Unable to locate built $package_name on remote host $TEMP_DNS" >&2
  return 1
}

ensure_prod_yarn() {
  if [ "$PROD_YARN_DONE" = "1" ]; then
    return 0
  fi
  if [ "$LOCKFILE_CHANGED" != "1" ]; then
    echo "[timing] production yarn skipped (lockfile unchanged)"
    PROD_YARN_DONE=1
    return 0
  fi
  if [ -n "${TEMP_DNS:-}" ]; then
    scp -i "$SSH_KEY_PATH" "${SSH_OPTS[@]}" \
      "ubuntu@$TEMP_DNS:${REMOTE_WORKSPACE}/package.json" "$REPO_DIR/package.json" 2>/dev/null || true
    scp -i "$SSH_KEY_PATH" "${SSH_OPTS[@]}" \
      "ubuntu@$TEMP_DNS:${REMOTE_WORKSPACE}/yarn.lock" "$REPO_DIR/yarn.lock" 2>/dev/null || true
    local pkg
    for pkg in twenty-server twenty-front twenty-website twenty-shared twenty-client-sdk twenty-orgchart twenty-ui twenty-emails twenty-mcp-server twenty-docs; do
      if [ -d "$REPO_DIR/packages/$pkg" ]; then
        scp -i "$SSH_KEY_PATH" "${SSH_OPTS[@]}" \
          "ubuntu@$TEMP_DNS:${REMOTE_WORKSPACE}/packages/$pkg/package.json" \
          "$REPO_DIR/packages/$pkg/package.json" 2>/dev/null || true
      fi
    done
  fi
  echo "Installing production dependencies"
  cd "$REPO_DIR"
  yarn install --frozen-lockfile || yarn install
  PROD_YARN_DONE=1
}

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
  [ -f "$dest/linkedin.svg" ] || cp -f "$dest/linkedin-icon.svg" "$dest/linkedin.svg" 2>/dev/null || true
  [ -f "$dest/download.svg" ] || cp -f "$dest/download-icon.svg" "$dest/download.svg" 2>/dev/null || true
  echo "Copied org-chart icons from $src into $dest"
}

  ensure_docs_nginx_site() {
    local domain="$1"
    local export_dir="$2"
    local snippet_source="$3"
    local available_path="$4"
    local enabled_path="$5"
    local cert_email="${DOCS_CERTBOT_EMAIL:-support@arxena.com}"

    if [ ! -d "$export_dir" ]; then
      echo "Docs export directory missing for $domain: $export_dir"
      return 1
    fi

    sudo mkdir -p /var/www/certbot

    if [ ! -f "/etc/letsencrypt/live/${domain}/fullchain.pem" ]; then
      echo "Staging HTTP-only nginx for $domain certificate..."
      sudo tee "$available_path" >/dev/null <<NGINX_HTTP
server {
  listen 80;
  server_name ${domain};

  location /.well-known/acme-challenge/ {
    root /var/www/certbot;
  }

  location / {
    return 200 'docs pending cert\n';
    add_header Content-Type text/plain;
  }
}
NGINX_HTTP
      sudo ln -sf "$available_path" "$enabled_path"
      sudo nginx -t
      sudo systemctl reload nginx
      sleep 5
      sudo certbot certonly --webroot -w /var/www/certbot \
        -d "$domain" \
        --non-interactive --agree-tos -m "$cert_email"
    fi

    sudo cp "$snippet_source" "$available_path"
    sudo ln -sf "$available_path" "$enabled_path"
    sudo nginx -t
    sudo systemctl reload nginx
  }

reload_nginx_once() {
  sudo systemctl reload nginx || sudo systemctl restart nginx
  NGINX_RELOADED=1
}

mark_package_sha() {
  local build_name="$1"
  if [ -n "${HEAD_SHA:-}" ]; then
    write_meta_value "$build_name" "$HEAD_SHA"
  fi
}

maybe_stream_component() {
  local build_name="$1"
  local label="$2"
  local destination="$3"
  shift 3

  if [ "$(get_deploy_status "$build_name")" = "updated" ] || \
     [ "$(get_deploy_status "$build_name")" = "skipped" ]; then
    return 0
  fi

  local build_status
  build_status="$(get_build_status "$build_name")"

  if [ "$build_status" = "skipped" ]; then
    set_deploy_status "$build_name" skipped
    mark_package_sha "$build_name"
    echo "$label skipped (no source changes)."
    return 0
  fi

  if [ "$build_status" != "success" ]; then
    return 1
  fi

  if [ "$build_name" = "TWENTY_FRONT" ]; then
    local server_status
    server_status="$(get_build_status TWENTY_SERVER)"
    if is_selected TWENTY_SERVER && [ "$server_status" = "failed" ]; then
      echo "Holding twenty-front deploy because twenty-server failed."
      return 1
    fi
    if is_selected TWENTY_SERVER && \
       [ "$server_status" != "skipped" ] && \
       [ "$(get_deploy_status TWENTY_SERVER)" != "updated" ] && \
       [ "$(get_deploy_status TWENTY_SERVER)" != "skipped" ]; then
      return 1
    fi
  fi

  local ready remote_path
  ready="$(get_build_ready_path "$build_name")"
  if ! remote_path="$(resolve_remote_dir "$label" "$ready" "$@")"; then
    echo "$label build succeeded but artifact directory was not found. Keeping existing files."
    return 1
  fi

  local stage_path="$STAGING_ROOT/$build_name"
  if ! stage_remote_dir "$remote_path" "$stage_path"; then
    echo "$label build succeeded but artifact copy failed. Keeping existing files."
    return 1
  fi

  activate_staged_dir "$stage_path" "$destination"
  DEPLOYMENTS_APPLIED=1
  set_deploy_status "$build_name" updated
  mark_package_sha "$build_name"
  echo "$label streamed to $destination"

  case "$build_name" in
    TWENTY_SERVER)
      local locale_dest="$REPO_DIR/packages/twenty-server/src/engine/core-modules/i18n/locales/generated"
      if [ "$LINGUI_SERVER" = "1" ]; then
        ssh_builder "[ -d '${REMOTE_WORKSPACE}/packages/twenty-server/src/engine/core-modules/i18n/locales/generated' ]" && \
          stage_remote_dir "${REMOTE_WORKSPACE}/packages/twenty-server/src/engine/core-modules/i18n/locales/generated" \
            "$STAGING_ROOT/TWENTY_SERVER_LOCALES" && \
          activate_staged_dir "$STAGING_ROOT/TWENTY_SERVER_LOCALES" "$locale_dest" || true
        ensure_prod_yarn
        cd "$REPO_DIR/packages/twenty-server"
        npx lingui compile --verbose || npx nx run twenty-server:lingui:compile || true
      else
        echo "[timing] production lingui compile skipped for twenty-server (i18n inputs unchanged)"
        ensure_prod_yarn
      fi
      run_production_upgrade
      cd "$REPO_DIR"
      pm2 restart twenty-server twenty-worker || pm2 restart twenty-server || true
      ;;
    TWENTY_FRONT)
      local front_locales="$REPO_DIR/packages/twenty-front/src/locales/generated"
      if [ "$LINGUI_FRONT" = "1" ]; then
        ssh_builder "[ -d '${REMOTE_WORKSPACE}/packages/twenty-front/src/locales/generated' ]" && \
          stage_remote_dir "${REMOTE_WORKSPACE}/packages/twenty-front/src/locales/generated" \
            "$STAGING_ROOT/TWENTY_FRONT_LOCALES" && \
          activate_staged_dir "$STAGING_ROOT/TWENTY_FRONT_LOCALES" "$front_locales" || true
        ensure_front_orgchart_img_assets || true
        ensure_prod_yarn
        cd "$REPO_DIR/packages/twenty-front"
        npx lingui compile --verbose || npx nx run twenty-front:lingui:compile || true
      else
        echo "[timing] production lingui compile skipped for twenty-front (i18n inputs unchanged)"
        ensure_front_orgchart_img_assets || true
        ensure_prod_yarn
      fi
      reload_nginx_once
      ;;
    TWENTY_WEBSITE)
      ensure_prod_yarn
      echo "Generating twenty-website static sitemaps on production"
      cd "$REPO_DIR/packages/twenty-website"
      if yarn generate-sitemaps; then
        echo "Static sitemaps generated successfully."
      else
        echo "WARNING: Static sitemap generation failed. Existing sitemap files may be stale."
      fi
      chmod +x "$REPO_DIR/pm2_start_website.sh" 2>/dev/null || true
      cd "$REPO_DIR"
      pm2 restart twenty-website || true
      ;;
    TWENTY_MCP_SERVER)
      ensure_prod_yarn
      cd "$REPO_DIR"
      pm2 startOrRestart ecosystem.config.js --only arxena-mcp-http || pm2 restart arxena-mcp-http || true
      ;;
    TWENTY_EMAILS)
      if [ "$LINGUI_EMAILS" = "1" ]; then
        ssh_builder "[ -d '${REMOTE_WORKSPACE}/packages/twenty-emails/src/locales/generated' ]" && \
          stage_remote_dir "${REMOTE_WORKSPACE}/packages/twenty-emails/src/locales/generated" \
            "$STAGING_ROOT/TWENTY_EMAILS_LOCALES" && \
          mkdir -p "$REPO_DIR/packages/twenty-emails/src/locales/generated" && \
          activate_staged_dir "$STAGING_ROOT/TWENTY_EMAILS_LOCALES" \
            "$REPO_DIR/packages/twenty-emails/src/locales/generated" || true
        cd "$REPO_DIR/packages/twenty-emails"
        mkdir -p src/locales/generated
        npx lingui compile --verbose || npx nx run twenty-emails:lingui:compile || true
      else
        echo "[timing] production lingui compile skipped for twenty-emails (i18n inputs unchanged)"
      fi
      ;;
    TWENTY_DOCS)
      local docs_root="$REPO_DIR/packages/twenty-docs/.deploy"
      mkdir -p "$docs_root/arxena"
  DOCS_IMDS_TOKEN="$(curl -s --connect-timeout 1 -X PUT \
    http://169.254.169.254/latest/api/token \
    -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' || true)"
  CURRENT_INSTANCE_ID="$(curl -s --connect-timeout 1 \
    -H "X-aws-ec2-metadata-token: $DOCS_IMDS_TOKEN" \
    http://169.254.169.254/latest/meta-data/instance-id || true)"
    if [ "$CURRENT_INSTANCE_ID" = "i-01fa0853163833136" ]; then
      ensure_docs_nginx_site \
        docs.arxena.com \
          "$docs_root/arxena" \
        "$REPO_DIR/scripts/nginx/docs-arxena.conf.snippet" \
        /etc/nginx/sites-available/docs-arxena.conf \
        /etc/nginx/sites-enabled/docs-arxena.conf
      else
        reload_nginx_once
      fi
      ;;
  esac
  return 0
}

stream_ready_packages() {
  refresh_build_status || return 0

  maybe_stream_component TWENTY_SHARED "twenty-shared dist" "$REPO_DIR/packages/twenty-shared/dist" \
    "${REMOTE_WORKSPACE}/packages/twenty-shared/dist" \
    /home/ubuntu/twenty/packages/twenty-shared/dist || true

  maybe_stream_component TWENTY_CLIENT_SDK "twenty-client-sdk dist" "$REPO_DIR/packages/twenty-client-sdk/dist" \
    "${REMOTE_WORKSPACE}/packages/twenty-client-sdk/dist" \
    /home/ubuntu/twenty/packages/twenty-client-sdk/dist || true

  maybe_stream_component TWENTY_UI "twenty-ui dist" "$REPO_DIR/packages/twenty-ui/dist" \
    "${REMOTE_WORKSPACE}/packages/twenty-ui/dist" \
    /home/ubuntu/twenty/packages/twenty-ui/dist || true

  maybe_stream_component TWENTY_ORGCHART "twenty-orgchart dist" "$REPO_DIR/packages/twenty-orgchart/dist" \
    "${REMOTE_WORKSPACE}/packages/twenty-orgchart/dist" \
    /home/ubuntu/twenty/packages/twenty-orgchart/dist || true

  maybe_stream_component TWENTY_SERVER "twenty-server dist" "$REPO_DIR/packages/twenty-server/dist" \
    "${REMOTE_WORKSPACE}/packages/twenty-server/dist" \
    /home/ubuntu/twenty/packages/twenty-server/dist || true

  maybe_stream_component TWENTY_FRONT "twenty-front build" "$REPO_DIR/packages/twenty-front/build" \
    "${REMOTE_WORKSPACE}/packages/twenty-front/build" \
    /home/ubuntu/twenty/packages/twenty-front/build || true

  maybe_stream_component TWENTY_EMAILS "twenty-emails dist" "$REPO_DIR/packages/twenty-emails/dist" \
    "${REMOTE_WORKSPACE}/packages/twenty-emails/dist" \
    /home/ubuntu/twenty/packages/twenty-emails/dist || true

  maybe_stream_component TWENTY_MCP_SERVER "twenty-mcp-server dist" "$REPO_DIR/packages/twenty-mcp-server/dist" \
    "${REMOTE_WORKSPACE}/packages/twenty-mcp-server/dist" \
    /home/ubuntu/twenty/packages/twenty-mcp-server/dist || true

  maybe_stream_component TWENTY_WEBSITE "twenty-website .next" "$REPO_DIR/packages/twenty-website/.next" \
    "${REMOTE_WORKSPACE}/packages/twenty-website/.next" \
    /home/ubuntu/twenty/packages/twenty-website/.next || true

  maybe_stream_component TWENTY_DOCS "twenty-docs export" "$REPO_DIR/packages/twenty-docs/.deploy/arxena" \
    "${REMOTE_WORKSPACE}/packages/twenty-docs/.mintlify/exports/arxena" \
    /home/ubuntu/twenty/packages/twenty-docs/.mintlify/exports/arxena || true
}

poll_remote_build_and_stream() {
  local ssh_pid="$1"
  local log_file="$2"
  local grace_s="${REMOTE_BUILD_EXIT_GRACE_SECONDS:-90}"
  local seen_complete=0
  local complete_at=0

  while kill -0 "$ssh_pid" 2>/dev/null; do
    stream_ready_packages || true
    if [ "$seen_complete" = "0" ] && grep -E -q 'Required build check (passed|failed)' "$log_file" 2>/dev/null; then
      seen_complete=1
      complete_at="$(date +%s)"
      echo "Remote build reported completion; waiting up to ${grace_s}s for SSH to exit..."
    fi
    if [ "$seen_complete" = "1" ]; then
      local now
      now="$(date +%s)"
      if [ $((now - complete_at)) -ge "$grace_s" ]; then
        echo "WARNING: Remote build SSH still running after completion marker. Terminating SSH so deploy can continue."
        kill -TERM "$ssh_pid" 2>/dev/null || true
        sleep 10
        kill -KILL "$ssh_pid" 2>/dev/null || true
        return 0
      fi
    fi
    sleep 5
  done
}

LAST_DEPLOY_SHA=""
compute_selected_builds
compute_lingui_flags
echo "LOCKFILE_CHANGED=$LOCKFILE_CHANGED SELECTED_BUILDS=${SELECTED_BUILDS:-empty}"

for _name in TWENTY_SERVER TWENTY_FRONT TWENTY_SHARED TWENTY_CLIENT_SDK TWENTY_ORGCHART TWENTY_UI TWENTY_WEBSITE TWENTY_MCP_SERVER TWENTY_DOCS TWENTY_EMAILS; do
  set_deploy_status "$_name" kept-existing-files
done

if [ -z "${SELECTED_BUILDS:-}" ]; then
  echo "Nothing to build or deploy. Recording current HEAD in build-meta.json."
  if [ -n "$HEAD_SHA" ]; then
    write_meta_value commit "$HEAD_SHA"
    for _name in TWENTY_SERVER TWENTY_FRONT TWENTY_SHARED TWENTY_CLIENT_SDK TWENTY_ORGCHART TWENTY_UI TWENTY_WEBSITE TWENTY_MCP_SERVER TWENTY_DOCS TWENTY_EMAILS; do
      write_meta_value "$_name" "$HEAD_SHA"
    done
  fi
  log_timing "Build process finished (nothing to build)"
  echo "[timing] Timing log: $BUILD_TIMING_LOG"
  BUILD_TIMING_LOGGED=1
  TZ=Asia/Kolkata date "+%Y-%m-%d %H:%M:%S %Z"
  echo "Operations Complete, Will Power Off"
  exit 0
fi

echo "Using AWS profile $AWS_PROFILE (EC2 SSH key remains $EC2_KEY_NAME)"
if ! aws "${AWS_CLI_PROFILE_ARGS[@]}" sts get-caller-identity >/dev/null 2>&1; then
  echo "ERROR: AWS CLI profile '$AWS_PROFILE' is missing or has no credentials."
  echo "Configured profiles:"
  aws configure list-profiles 2>/dev/null || true
  echo "Override with AWS_PROFILE=<name> if needed. Do not use the SSH key name arxmukti-key as the CLI profile."
  exit 1
fi
ensure_s3_bucket || true

acquire_builder_instance

VOLUME_START="$(date +%s)"
attach_builder_volume
log_timing "EBS attach and mount" "$VOLUME_START"
NX_CACHE_START="$(date +%s)"
pull_nx_cache_from_s3 || true
log_timing "Nx cache S3 pull" "$NX_CACHE_START"

scp -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "$SCRIPT_DIR/script_to_build_app_in_new_instance.sh" ubuntu@$TEMP_DNS:/home/ubuntu/
for config in "$SCRIPT_DIR/build.config" "$REPO_DIR/build.config" "/home/ubuntu/twenty/build.config"; do
  if [ -f "$config" ]; then
    scp -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "$config" ubuntu@$TEMP_DNS:/home/ubuntu/
    break
  fi
done
scp -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "$REPO_DIR/packages/twenty-front/.env" ubuntu@$TEMP_DNS:/home/ubuntu/.env_front
scp -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "$REPO_DIR/packages/twenty-server/.env" ubuntu@$TEMP_DNS:/home/ubuntu/.env_server
scp -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "$REPO_DIR/packages/twenty-website/.env" ubuntu@$TEMP_DNS:/home/ubuntu/.env_website
echo "Copied build script and env files"

BUILD_STATUS_LOCAL_FILE="$(mktemp /tmp/twenty-build-status.XXXXXX)"
STAGING_ROOT="$(mktemp -d /tmp/twenty-build-stage.XXXXXX)"
REMOTE_BUILD_EXIT_CODE=0
mkdir -p "$BUILD_LOG_DIR"
BUILD_LOG_SSH_FALLBACK="$(mktemp "$BUILD_LOG_DIR/build_app.ssh.XXXXXX")"

YARN_CACHE_REMOTE="$(dirname "$REMOTE_WORKSPACE")/yarn-cache"
if [ "$REMOTE_WORKSPACE" = "/home/ubuntu/twenty" ]; then
  YARN_CACHE_REMOTE="/home/ubuntu/yarn-cache"
fi

REMOTE_BUILD_ENV="BUILD_BRANCH=$BUILD_BRANCH BUILD_WORKSPACE=$REMOTE_WORKSPACE SELECTED_BUILDS='$SELECTED_BUILDS' LAST_DEPLOY_SHA='$LAST_DEPLOY_SHA' LOCKFILE_CHANGED=$LOCKFILE_CHANGED LINGUI_SERVER=$LINGUI_SERVER LINGUI_FRONT=$LINGUI_FRONT LINGUI_EMAILS=$LINGUI_EMAILS YARN_CACHE_FOLDER=$YARN_CACHE_REMOTE"
set +e
ssh -i "$SSH_KEY_PATH" "${SSH_OPTS[@]}" ubuntu@$TEMP_DNS \
  "$REMOTE_BUILD_ENV chmod +x script_to_build_app_in_new_instance.sh && $REMOTE_BUILD_ENV ./script_to_build_app_in_new_instance.sh" \
  > >(tee "$BUILD_LOG_SSH_FALLBACK") 2>&1 &
REMOTE_BUILD_SSH_PID=$!
REMOTE_BUILD_START="$(date +%s)"
echo "[timing] Remote package build started  ($(TZ=Asia/Kolkata date '+%Y-%m-%d %H:%M:%S %Z'))"
poll_remote_build_and_stream "$REMOTE_BUILD_SSH_PID" "$BUILD_LOG_SSH_FALLBACK"
wait "$REMOTE_BUILD_SSH_PID"
REMOTE_BUILD_EXIT_CODE=$?
log_timing "Remote package build + streaming deploy" "$REMOTE_BUILD_START"
set -e
if [ "$REMOTE_BUILD_EXIT_CODE" -ne 0 ] && grep -E -q 'Required build check passed' "$BUILD_LOG_SSH_FALLBACK" 2>/dev/null; then
  echo "Remote SSH exited $REMOTE_BUILD_EXIT_CODE after a successful build log; continuing deploy."
  REMOTE_BUILD_EXIT_CODE=0
fi

stream_ready_packages || true
fetch_remote_build_log 0
push_nx_cache_to_s3 || true

if [ "$DEPLOYMENTS_APPLIED" -eq 0 ] && [ "$SELECTED_BUILDS" != "ALL" ]; then
  echo "No application artifacts were streamed (all skipped or failed)."
fi

if [ -n "$HEAD_SHA" ]; then
  local_fail=0
  for _name in TWENTY_SERVER TWENTY_FRONT TWENTY_ORGCHART TWENTY_UI TWENTY_SHARED TWENTY_CLIENT_SDK TWENTY_WEBSITE TWENTY_MCP_SERVER TWENTY_DOCS; do
    if is_selected "$_name" && [ "$(get_build_status "$_name")" = "failed" ]; then
      local_fail=1
    fi
  done
  if [ "$local_fail" = "0" ]; then
    write_meta_value commit "$HEAD_SHA"
  fi
fi

echo "Final required build summary before shutdown:"
for build_name in TWENTY_SERVER TWENTY_FRONT TWENTY_ORGCHART TWENTY_SHARED TWENTY_CLIENT_SDK TWENTY_WEBSITE TWENTY_MCP_SERVER TWENTY_DOCS; do
  echo " - ${build_name}: build=$(get_build_status "$build_name"), files=$(get_deploy_status "$build_name")"
done

if [ "$REMOTE_BUILD_EXIT_CODE" -ne 0 ]; then
  echo "Remote build script exited with code $REMOTE_BUILD_EXIT_CODE."
fi

if [ -f "$BUILD_LOG_LATEST" ]; then
  echo "Latest remote build log: $BUILD_LOG_LATEST"
fi

if [ -x "$REPO_DIR/node_modules/.bin/nx" ]; then
  (cd "$REPO_DIR" && ./node_modules/.bin/nx daemon --stop) >/dev/null 2>&1 || true
fi

if [ "$SKIP_WARM_BUILDER" != "1" ] && [ "${WARM_BUILDER_USED:-0}" = "1" ]; then
  log_timing "Build process finished (total, before warm builder stop)"
else
  log_timing "Build process finished (total, before instance terminate)"
fi
echo "[timing] Timing log: $BUILD_TIMING_LOG"
BUILD_TIMING_LOGGED=1
TZ=Asia/Kolkata date "+%Y-%m-%d %H:%M:%S %Z"

echo "Operations Complete, Will Power Off"
