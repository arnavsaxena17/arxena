#!/bin/bash

set -euo pipefail

[ -f "$HOME/build.config" ] && source "$HOME/build.config"

CHATWOOT_BUILD_BRANCH="${CHATWOOT_BUILD_BRANCH:-arxena/onboarding-workspace}"
CHATWOOT_REPO_URL="${CHATWOOT_REPO_URL:-https://github.com/arnavsaxena17/chatwoot.git}"
CHATWOOT_IMAGE_NAME="${CHATWOOT_IMAGE_NAME:-arxena/chatwoot-local:latest}"

BUILD_STATUS_FILE="${HOME}/build_status.env"
IMAGE_TAR="${HOME}/chatwoot-image.tar"
IMAGE_TAR_GZ="${HOME}/chatwoot-image.tar.gz"
IMAGE_SHA="${HOME}/chatwoot-image.sha256"

rm -f "$BUILD_STATUS_FILE" "$IMAGE_TAR" "$IMAGE_TAR_GZ" "$IMAGE_SHA"

build_step() {
  local name="$1"
  shift

  echo "Starting build: $name"
  if "$@"; then
    echo "BUILD_${name}=success" >> "$BUILD_STATUS_FILE"
    echo "Build succeeded: $name"
    return 0
  fi

  local exit_code=$?
  echo "BUILD_${name}=failed" >> "$BUILD_STATUS_FILE"
  echo "Build failed: $name (exit code $exit_code)"
  return "$exit_code"
}

ensure_docker() {
  if command -v docker >/dev/null 2>&1; then
    return 0
  fi

  echo "Installing Docker..."
  sudo apt-get update
  sudo apt-get install -y ca-certificates curl gnupg lsb-release docker.io
  sudo systemctl enable --now docker
}

run_docker() {
  if docker ps >/dev/null 2>&1; then
    docker "$@"
  else
    sudo docker "$@"
  fi
}

echo "Chatwoot branch: $CHATWOOT_BUILD_BRANCH"
echo "Chatwoot repo: $CHATWOOT_REPO_URL"
echo "Chatwoot image: $CHATWOOT_IMAGE_NAME"

sudo apt-get update
sudo apt-get install -y git gzip
ensure_docker

run_docker version
run_docker system df || true

git clone "$CHATWOOT_REPO_URL" chatwoot
cd chatwoot
git checkout "$CHATWOOT_BUILD_BRANCH"
git rev-parse HEAD > "$HOME/chatwoot_git_sha"

build_chatwoot_image() {
  run_docker build \
    -t "$CHATWOOT_IMAGE_NAME" \
    -f docker/Dockerfile \
    --build-arg BUNDLE_WITHOUT='development:test' \
    --build-arg EXECJS_RUNTIME='Disabled' \
    --build-arg RAILS_ENV='production' \
    --build-arg RAILS_SERVE_STATIC_FILES='true' \
    --build-arg NODE_OPTIONS='--max-old-space-size=4096 --openssl-legacy-provider' \
    .
}

build_step CHATWOOT_IMAGE build_chatwoot_image

echo "Saving Chatwoot image artifact..."
run_docker save "$CHATWOOT_IMAGE_NAME" -o "$IMAGE_TAR"
gzip -1 "$IMAGE_TAR"
# Basename-only checksum so verification works after scp to another host
(
  cd "$HOME"
  sha256sum "$(basename "$IMAGE_TAR_GZ")" > "$IMAGE_SHA"
)
ls -lh "$IMAGE_TAR_GZ" "$IMAGE_SHA"

echo "Build summary:"
cat "$BUILD_STATUS_FILE"
echo "Git SHA: $(cat "$HOME/chatwoot_git_sha")"

run_docker builder prune -af || true
run_docker image prune -f || true

echo "Chatwoot build complete."
TZ=Asia/Kolkata date "+%Y-%m-%d %H:%M:%S %Z"
