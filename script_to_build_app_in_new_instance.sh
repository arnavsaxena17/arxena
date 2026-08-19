#!/bin/bash

# Keep a full builder transcript so the orchestrator can scp it before
# this temporary instance is terminated.
# Do not exec into the tee pipe: Nx daemon inherits that pipe and SSH never
# returns, so the orchestrator never deploys or terminates the builder.
REMOTE_BUILD_LOG="${HOME}/remote-build.log"
if [ "${_REMOTE_BUILD_LOGGING:-0}" != "1" ]; then
  export _REMOTE_BUILD_LOGGING=1
  rm -f "$REMOTE_BUILD_LOG"
  set +e
  "$0" "$@" > >(tee "$REMOTE_BUILD_LOG") 2>&1
  status=$?
  WORKSPACE="${BUILD_WORKSPACE:-$HOME/twenty}"
  if [ -x "$WORKSPACE/node_modules/.bin/nx" ]; then
    (cd "$WORKSPACE" && ./node_modules/.bin/nx daemon --stop) >/dev/null 2>&1 || true
  elif [ -x "$HOME/twenty/node_modules/.bin/nx" ]; then
    (cd "$HOME/twenty" && ./node_modules/.bin/nx daemon --stop) >/dev/null 2>&1 || true
  fi
  pkill -f "tee ${REMOTE_BUILD_LOG}" >/dev/null 2>&1 || true
  pkill -P $$ >/dev/null 2>&1 || true
  exit "$status"
fi
export NX_DAEMON=false

WORKSPACE="${BUILD_WORKSPACE:-$HOME/twenty}"
trap 'if [ -x "'"$WORKSPACE"'/node_modules/.bin/nx" ]; then (cd "'"$WORKSPACE"'" && ./node_modules/.bin/nx daemon --stop) >/dev/null 2>&1 || true; fi; sync >/dev/null 2>&1 || true' EXIT

[ -f ~/build.config ] && source ~/build.config
BUILD_BRANCH="${BUILD_BRANCH:-port/arxena-modules}"
SELECTED_BUILDS="${SELECTED_BUILDS:-ALL}"
LAST_DEPLOY_SHA="${LAST_DEPLOY_SHA:-}"
GIT_REPO_URL="${GIT_REPO_URL:-https://github.com/arnavsaxena17/twenty.git}"
YARN_CACHE_FOLDER="${YARN_CACHE_FOLDER:-$(dirname "$WORKSPACE")/yarn-cache}"
export YARN_CACHE_FOLDER

BUILD_STATUS_FILE="${HOME}/build_status.env"
rm -f "$BUILD_STATUS_FILE"
touch "$BUILD_STATUS_FILE"

record_status() {
  local name="$1"
  local status="$2"
  local ready_path="${3:-}"
  echo "BUILD_${name}=${status}" >> "$BUILD_STATUS_FILE"
  if [ -n "$ready_path" ]; then
    echo "BUILD_READY_${name}=${ready_path}" >> "$BUILD_STATUS_FILE"
  fi
  sync >/dev/null 2>&1 || true
}

should_build() {
  local name="$1"
  if [ "$SELECTED_BUILDS" = "ALL" ] || [ -z "$SELECTED_BUILDS" ]; then
    return 0
  fi
  case " $SELECTED_BUILDS " in
    *" $name "*) return 0 ;;
    *) return 1 ;;
  esac
}

skip_step() {
  local name="$1"
  echo "Skipping build: $name (no source changes)"
  record_status "$name" skipped
}

build_step() {
  local name="$1"
  shift

  echo "Starting build: $name"
  if "$@"; then
    record_status "$name" success
    echo "Build succeeded: $name"
    return 0
  else
    local exit_code=$?
    record_status "$name" failed
    echo "Build failed: $name (exit code $exit_code)"
    return "$exit_code"
  fi
}

echo "Workspace: $WORKSPACE"
echo "Selected builds: $SELECTED_BUILDS"

if ! command -v unzip >/dev/null 2>&1 || ! dpkg -s build-essential >/dev/null 2>&1 || ! dpkg -s libsqlite3-dev >/dev/null 2>&1; then
  echo "Installing missing apt build packages..."
  sudo apt-get update -y
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y build-essential libsqlite3-dev unzip
else
  echo "apt build packages already present (AMI); skipping apt install"
fi

echo "Node version: $(node -v 2>/dev/null || echo missing)"
echo "npm version: $(npm -v 2>/dev/null || echo missing)"
echo "Nest CLI version: $(nest --version 2>/dev/null || echo missing)"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"
# shellcheck disable=SC1090
source ~/.nvm/nvm.sh
NODE_VERSION="${NODE_VERSION:-24.5.0}"
CURRENT_NODE="$(node -v 2>/dev/null | sed 's/^v//')"
if [ "$CURRENT_NODE" != "$NODE_VERSION" ]; then
  echo "Installing Node $NODE_VERSION (found ${CURRENT_NODE:-none})"
  nvm install "$NODE_VERSION"
fi
nvm use "$NODE_VERSION"

echo "Node version: $(node -v)"
echo "npm version: $(npm -v)"
echo "Nest CLI version: $(nest --version 2>/dev/null || echo missing)"

mkdir -p "$(dirname "$WORKSPACE")" "$YARN_CACHE_FOLDER"
if [ -d "$WORKSPACE/.git" ]; then
  echo "Reusing existing git checkout at $WORKSPACE"
  cd "$WORKSPACE"
  git remote set-url origin "$GIT_REPO_URL" 2>/dev/null || true
  git fetch --prune origin "$BUILD_BRANCH"
  git checkout "$BUILD_BRANCH" 2>/dev/null || git checkout -B "$BUILD_BRANCH" "origin/$BUILD_BRANCH"
  git reset --hard "origin/$BUILD_BRANCH"
else
  echo "Cloning $GIT_REPO_URL ($BUILD_BRANCH) into $WORKSPACE"
  rm -rf "$WORKSPACE"
  git clone --depth 50 --branch "$BUILD_BRANCH" "$GIT_REPO_URL" "$WORKSPACE"
  cd "$WORKSPACE"
fi

if [ -n "$LAST_DEPLOY_SHA" ]; then
  git fetch --depth 1 origin "$LAST_DEPLOY_SHA" 2>/dev/null || \
    git fetch origin "$LAST_DEPLOY_SHA" 2>/dev/null || \
    echo "WARNING: could not fetch LAST_DEPLOY_SHA=$LAST_DEPLOY_SHA"
fi

if [ -f ~/.env_server ]; then
  mv -f ~/.env_server "$WORKSPACE/packages/twenty-server/.env"
fi
if [ -f ~/.env_front ]; then
  mv -f ~/.env_front "$WORKSPACE/packages/twenty-front/.env"
fi
if [ -f ~/.env_website ]; then
  mv -f ~/.env_website "$WORKSPACE/packages/twenty-website/.env"
elif [ ! -f "$WORKSPACE/packages/twenty-website/.env" ]; then
  cp "$WORKSPACE/packages/twenty-website/.env.example" "$WORKSPACE/packages/twenty-website/.env"
fi

if [ -f .nvmrc ]; then
  nvm use || nvm install
fi

HEAD_SHA="$(git rev-parse HEAD)"
echo "BUILD_HEAD_SHA=$HEAD_SHA" >> "$BUILD_STATUS_FILE"

if ! yarn; then
  echo "yarn install failed (check Node version / peer constraints)" >&2
  exit 1
fi

ensure_swc_native_binding() {
  local swc_check_cmd="require('@swc/core'); require('@swc/cli'); require('@swc/cli/lib/swc/dir')"

  if node -e "$swc_check_cmd" >/dev/null 2>&1; then
    echo "SWC native binding OK"
    return 0
  fi

  echo "Repairing @swc/core native binding for nest build..."
  YARN_ENABLE_SCRIPTS=true yarn rebuild @swc/core || true

  if ! node -e "$swc_check_cmd" >/dev/null 2>&1; then
    echo "yarn rebuild insufficient; installing explicit linux-arm64 @swc/core binary"
    local swc_core_version
    swc_core_version="$(node -p "require('@swc/core/package.json').version")"
    yarn add -D -W "@swc/core-linux-arm64-gnu@npm:${swc_core_version}" || true
    YARN_ENABLE_SCRIPTS=true yarn rebuild @swc/core || true
  fi

  if ! node -e "$swc_check_cmd; console.log('SWC native binding repaired')"; then
    echo "SWC native binding still broken after repair; nest build will fail" >&2
    node -e "$swc_check_cmd" 2>&1 || true
    return 1
  fi
}

if should_build TWENTY_SERVER; then
  if ! ensure_swc_native_binding; then
    record_status TWENTY_SERVER failed
    exit 1
  fi
fi

if [ -f scripts/patch-gojs.cjs ]; then
  node scripts/patch-gojs.cjs
fi
rm -rf node_modules/.vite/packages/twenty-front/deps

echo "Git ready, going to package builds"
cd "$WORKSPACE"

if should_build TWENTY_SHARED; then
  if build_step TWENTY_SHARED npx nx build twenty-shared; then
    record_status TWENTY_SHARED success "$WORKSPACE/packages/twenty-shared/dist"
  fi
else
  skip_step TWENTY_SHARED
fi

if should_build TWENTY_CLIENT_SDK; then
  if build_step TWENTY_CLIENT_SDK npx nx build twenty-client-sdk; then
    record_status TWENTY_CLIENT_SDK success "$WORKSPACE/packages/twenty-client-sdk/dist"
  fi
else
  skip_step TWENTY_CLIENT_SDK
fi

if should_build TWENTY_ORGCHART; then
  if build_step TWENTY_ORGCHART npx nx build twenty-orgchart; then
    record_status TWENTY_ORGCHART success "$WORKSPACE/packages/twenty-orgchart/dist"
  fi
else
  skip_step TWENTY_ORGCHART
fi

if should_build TWENTY_UI; then
  if build_step TWENTY_UI npx nx build twenty-ui; then
    record_status TWENTY_UI success "$WORKSPACE/packages/twenty-ui/dist"
  fi
else
  skip_step TWENTY_UI
fi

if should_build TWENTY_SERVER; then
  cd "$WORKSPACE/packages/twenty-server"
  mkdir -p src/engine/core-modules/i18n/locales/generated
  npx lingui extract --clean --verbose
  npx lingui compile --verbose
  cd "$WORKSPACE"
  if ! build_step TWENTY_SERVER npx nx build twenty-server; then
    cd "$WORKSPACE/packages/twenty-server"
    build_step TWENTY_SERVER nest build -p tsconfig.build.json
    mkdir -p dist/assets/twenty-client-sdk
    cp ../twenty-client-sdk/package.json dist/assets/twenty-client-sdk/ 2>/dev/null || true
    cp -r ../twenty-client-sdk/dist dist/assets/twenty-client-sdk/dist 2>/dev/null || true
    cd "$WORKSPACE"
  fi
  if grep -q '^BUILD_TWENTY_SERVER=success' "$BUILD_STATUS_FILE"; then
    record_status TWENTY_SERVER success "$WORKSPACE/packages/twenty-server/dist"
  fi
else
  skip_step TWENTY_SERVER
fi

if should_build TWENTY_FRONT || should_build TWENTY_FRONT_COMPONENT_RENDERER; then
  cd "$WORKSPACE"
  build_step TWENTY_FRONT_COMPONENT_RENDERER npx nx build twenty-front-component-renderer || true
fi

if should_build TWENTY_FRONT; then
  cd "$WORKSPACE/packages/twenty-front"
  mkdir -p src/locales/generated
  npx lingui extract --clean --verbose
  npx lingui compile --verbose
  cd "$WORKSPACE"
  if build_step TWENTY_FRONT env VITE_BUILD_SOURCEMAP=false NODE_OPTIONS="--max-old-space-size=8192" yarn workspace twenty-front build; then
    FRONT_IMG_DEST="$WORKSPACE/packages/twenty-front/build/img"
    FRONT_IMG_SRC=""
    for candidate in \
      "$WORKSPACE/packages/twenty-front/public/img" \
      "$WORKSPACE/packages/twenty-website/public/img"
    do
      if [ -d "$candidate" ] && [ -f "$candidate/lock.png" ]; then
        FRONT_IMG_SRC="$candidate"
        break
      fi
    done
    if [ -n "$FRONT_IMG_SRC" ]; then
      mkdir -p "$FRONT_IMG_DEST"
      cp -a "$FRONT_IMG_SRC"/. "$FRONT_IMG_DEST"/
      [ -f "$FRONT_IMG_DEST/linkedin.svg" ] || cp -f "$FRONT_IMG_DEST/linkedin-icon.svg" "$FRONT_IMG_DEST/linkedin.svg" 2>/dev/null || true
      [ -f "$FRONT_IMG_DEST/download.svg" ] || cp -f "$FRONT_IMG_DEST/download-icon.svg" "$FRONT_IMG_DEST/download.svg" 2>/dev/null || true
      echo "Copied org-chart icons from $FRONT_IMG_SRC into $FRONT_IMG_DEST"
    else
      echo "WARNING: org-chart /img assets not found after twenty-front build"
    fi
    record_status TWENTY_FRONT success "$WORKSPACE/packages/twenty-front/build"
  fi
else
  skip_step TWENTY_FRONT
fi

if should_build TWENTY_WEBSITE; then
  cd "$WORKSPACE/packages/twenty-website"
  if build_step TWENTY_WEBSITE yarn build:ci; then
    record_status TWENTY_WEBSITE success "$WORKSPACE/packages/twenty-website/.next"
  fi
else
  skip_step TWENTY_WEBSITE
fi

if should_build TWENTY_EMAILS; then
  cd "$WORKSPACE/packages/twenty-emails"
  mkdir -p src/locales/generated
  npx lingui extract --clean --verbose
  if build_step TWENTY_EMAILS yarn build; then
    record_status TWENTY_EMAILS success "$WORKSPACE/packages/twenty-emails/dist"
  fi
else
  skip_step TWENTY_EMAILS
fi

if should_build TWENTY_MCP_SERVER; then
  cd "$WORKSPACE/packages/twenty-mcp-server"
  if ! build_step TWENTY_MCP_SERVER npx nx run twenty-mcp-server:build; then
    build_step TWENTY_MCP_SERVER yarn build
  fi
  if grep -q '^BUILD_TWENTY_MCP_SERVER=success' "$BUILD_STATUS_FILE"; then
    record_status TWENTY_MCP_SERVER success "$WORKSPACE/packages/twenty-mcp-server/dist"
  fi
else
  skip_step TWENTY_MCP_SERVER
fi

if should_build TWENTY_DOCS; then
  cd "$WORKSPACE/packages/twenty-docs"
  if build_step TWENTY_DOCS env NODE_OPTIONS="--max-old-space-size=8192" yarn export:brands; then
    record_status TWENTY_DOCS success "$WORKSPACE/packages/twenty-docs/.mintlify/exports/arxena"
  fi
else
  skip_step TWENTY_DOCS
fi

required_builds=(
  TWENTY_SERVER
  TWENTY_FRONT
  TWENTY_ORGCHART
  TWENTY_UI
  TWENTY_SHARED
  TWENTY_CLIENT_SDK
  TWENTY_WEBSITE
  TWENTY_MCP_SERVER
  TWENTY_DOCS
)

to_check=()
if [ "$SELECTED_BUILDS" = "ALL" ] || [ -z "$SELECTED_BUILDS" ]; then
  to_check=("${required_builds[@]}")
else
  for build_name in $SELECTED_BUILDS; do
    case "$build_name" in
      TWENTY_FRONT_COMPONENT_RENDERER) continue ;;
      *) to_check+=("$build_name") ;;
    esac
  done
fi

echo "Build summary:"
all_required_success=true
checked_any=false
for build_name in "${to_check[@]}"; do
  checked_any=true
  status="$(grep "^BUILD_${build_name}=" "$BUILD_STATUS_FILE" 2>/dev/null | tail -n 1 | cut -d= -f2)"
  status="${status:-failed}"
  echo " - ${build_name}: ${status}"
  if [ "$status" != "success" ] && [ "$status" != "skipped" ]; then
    all_required_success=false
  fi
done

if [ "$checked_any" = false ]; then
  echo "Required build check passed: no packages selected (nothing changed)."
  exit 0
fi

if [ "$all_required_success" = true ]; then
  echo "Required build check passed: selected packages built successfully."
  exit 0
fi

echo "Required build check failed: one or more selected packages did not build successfully."
exit 1
