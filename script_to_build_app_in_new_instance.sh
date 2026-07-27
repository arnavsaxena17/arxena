#!/bin/bash

# Branch: from BUILD_BRANCH env (passed by build_app_in_new_instance.sh) or build.config or default
[ -f ~/build.config ] && source ~/build.config
BUILD_BRANCH="${BUILD_BRANCH:-port/arxena-modules}"

BUILD_STATUS_FILE="${HOME}/build_status.env"
rm -f "$BUILD_STATUS_FILE"

build_step() {
  local name="$1"
  shift

  echo "Starting build: $name"
  if "$@"; then
    echo "BUILD_${name}=success" >> "$BUILD_STATUS_FILE"
    echo "Build succeeded: $name"
    return 0
  else
    local exit_code=$?
    echo "BUILD_${name}=failed" >> "$BUILD_STATUS_FILE"
    echo "Build failed: $name (exit code $exit_code)"
    return "$exit_code"
  fi
}

# Print versions for verification
sudo apt update
sudo apt install -y build-essential
sudo apt install -y libsqlite3-dev
yarn cache clean
echo "Node version: $(node -v)"
echo "npm version: $(npm -v)"
echo "Nest CLI version: $(nest --version)"
echo "Vite version: $(npx vite --version 2>/dev/null || echo 'not yet installed')"
echo "Build environment setup complete!"
export NODE_OPTIONS="--max-old-space-size=4096"
source ~/.nvm/nvm.sh
nvm install 22
nvm use 22

echo "Node version: $(node -v)"
echo "npm version: $(npm -v)"
echo "Nest CLI version: $(nest --version)"
echo "Vite version: $(npx vite --version 2>/dev/null || echo 'not yet installed')"

git clone https://github.com/arnavsaxena17/twenty.git
cd twenty
mv ~/.env_server ~/twenty/packages/twenty-server/.env
mv ~/.env_front ~/twenty/packages/twenty-front/.env
if [ -f ~/.env_website ]; then
  mv ~/.env_website ~/twenty/packages/twenty-website/.env
else
  cp ~/twenty/packages/twenty-website/.env.example ~/twenty/packages/twenty-website/.env
fi

git checkout "${BUILD_BRANCH}"
# Branch set by build_app_in_new_instance.sh via BUILD_BRANCH env
yarn
# Nest SWC builder requires @swc/core's platform native binding. Repo yarnrc sets
# enableScripts:false, so @swc/core postinstall is skipped and nest build can fail on
# linux-arm64 builders with "Failed to load @swc/cli and/or @swc/core".
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
if ! ensure_swc_native_binding; then
  echo "BUILD_TWENTY_SERVER=failed" >> "$BUILD_STATUS_FILE"
  exit 1
fi
node scripts/patch-gojs.cjs
rm -rf node_modules/.vite/packages/twenty-front/deps

echo "Git pulled, SWC check done, going to package builds"
cd ~/twenty/
yarn cache clean
build_step TWENTY_SHARED npx nx build twenty-shared
build_step TWENTY_SHARED_WORKSPACE yarn workspace twenty-shared build
# Server nest build copies client-sdk into dist/assets; build it first
build_step TWENTY_CLIENT_SDK npx nx build twenty-client-sdk
build_step TWENTY_ORGCHART npx nx build twenty-orgchart
build_step TWENTY_ORGCHART_WORKSPACE yarn workspace twenty-orgchart build
build_step TWENTY_UI npx nx build twenty-ui
build_step TWENTY_UI_WORKSPACE yarn workspace twenty-ui build
cd ~/twenty/packages/twenty-server/
mkdir -p src/engine/core-modules/i18n/locales/generated
# Standard object/field labels are translated via generateMessageId(sourceEnglish) matching
# Lingui message ids from msg`...` in workspace entities. extract picks up those strings;
# compile writes locales/generated/*.ts. If extract/compile is skipped or DB labels drift from
# canonical English, the API falls back to the raw DB string (see resolveStandardMetadataTranslation).
npx lingui extract --clean --verbose
ls -la src/engine/core-modules/i18n/locales/
npx lingui compile --verbose
ls -la src/engine/core-modules/i18n/locales/generated/
# Prefer nx so dist/assets/twenty-client-sdk is copied (bare nest build skips that step)
cd ~/twenty/
if ! build_step TWENTY_SERVER npx nx build twenty-server; then
  cd ~/twenty/packages/twenty-server/
  build_step TWENTY_SERVER nest build -p tsconfig.build.json
  mkdir -p dist/assets/twenty-client-sdk
  cp ../twenty-client-sdk/package.json dist/assets/twenty-client-sdk/ 2>/dev/null || true
  cp -r ../twenty-client-sdk/dist dist/assets/twenty-client-sdk/dist 2>/dev/null || true
  cd ~/twenty/
fi
echo "Server built, going to front build"
cd ~/twenty/packages/twenty-front/
mkdir -p src/locales/generated
# Run extraction with verbose output
npx lingui extract --clean --verbose
echo "Lingui extraction completed"
# Check what was extracted
ls -la src/locales/
echo "Lingui extraction completed"
# Compile with verbose output
npx lingui compile --verbose
echo "Lingui compilation completed"
# Check the compiled output
ls -la src/locales/generated/
echo "Lingui compilation completed"
yarn cache clean
npx nx reset
build_step TWENTY_FRONT env VITE_BUILD_SOURCEMAP=false NODE_OPTIONS="--max-old-space-size=8192" yarn build

echo "Building twenty-website package"
cd ~/twenty/packages/twenty-website/
build_step TWENTY_WEBSITE yarn build:ci

echo "Building twenty-emails package"
cd ~/twenty/packages/twenty-emails/
mkdir -p src/locales/generated
npx lingui extract --clean --verbose
ls -la src/locales/
build_step TWENTY_EMAILS yarn build

echo "Building twenty-mcp-server package"
cd ~/twenty/packages/twenty-mcp-server/
if ! build_step TWENTY_MCP_SERVER npx nx run twenty-mcp-server:build; then
  build_step TWENTY_MCP_SERVER yarn build
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
)

echo "Build summary:"
all_required_success=true
for build_name in "${required_builds[@]}"; do
  status="$(grep "^BUILD_${build_name}=" "$BUILD_STATUS_FILE" 2>/dev/null | tail -n 1 | cut -d= -f2)"
  status="${status:-failed}"
  echo " - ${build_name}: ${status}"
  if [ "$status" != "success" ]; then
    all_required_success=false
  fi
done

if [ "$all_required_success" = true ]; then
  echo "Required build check passed: twenty-server, twenty-front, twenty-orgchart, twenty-shared, twenty-client-sdk, twenty-website, and twenty-mcp-server all built successfully."
  exit 0
fi

echo "Required build check failed: one or more of twenty-server, twenty-front, twenty-orgchart, twenty-shared, twenty-client-sdk, twenty-website, or twenty-mcp-server did not build successfully."
exit 1
