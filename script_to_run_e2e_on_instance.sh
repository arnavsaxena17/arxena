#!/bin/bash
# Remote script: runs on EC2 instance to execute e2e tests
# Streamed back to local terminal via SSH

set -euo pipefail

BRANCH="${TEST_BRANCH:-port/arxena-modules}"
FRONTEND_URL="${FRONTEND_BASE_URL:-https://app.arxena.com}"
BACKEND_URL="${BACKEND_BASE_URL:-https://api.arxena.com}"
TEST_SPEC="${TEST_SPEC:-signup.delete-account.pipeline.spec.ts}"

export NODE_OPTIONS="--max-old-space-size=4096"

echo "======================================"
echo " Arxena E2E Test Runner (EC2)"
echo " Branch   : $BRANCH"
echo " Frontend : $FRONTEND_URL"
echo " Test     : $TEST_SPEC"
echo " Date     : $(date)"
echo "======================================"

# ── 1. System deps ────────────────────────────────────────────────────────────
echo ""
echo "[1/6] Installing system dependencies..."
sudo apt-get update -qq
sudo apt-get install -y -qq build-essential libsqlite3-dev curl git

# ── 2. Node via nvm ───────────────────────────────────────────────────────────
echo ""
echo "[2/6] Setting up Node.js..."
source ~/.nvm/nvm.sh 2>/dev/null || true
nvm install 24.5.0 --silent
nvm use 24.5.0
echo "  Node $(node -v) / npm $(npm -v)"

# ── 3. Clone repo ─────────────────────────────────────────────────────────────
echo ""
echo "[3/6] Cloning repository (branch: $BRANCH)..."
if [ ! -d ~/twenty ]; then
  git clone --depth 1 --branch "$BRANCH" https://github.com/arnavsaxena17/twenty.git ~/twenty
else
  echo "  Repo already present, pulling..."
  cd ~/twenty
  git fetch origin
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
fi

cd ~/twenty

# ── 4. Place .env files ───────────────────────────────────────────────────────
echo ""
echo "[4/6] Configuring environment..."

# Place e2e .env (uploaded by orchestrator)
if [ -f ~/.env_e2e ]; then
  cp ~/.env_e2e ~/twenty/packages/twenty-e2e-testing/.env
  echo "  Copied .env_e2e → packages/twenty-e2e-testing/.env"
fi

# Override URLs if passed explicitly via env
if [ -n "$FRONTEND_BASE_URL" ] || [ -n "$BACKEND_BASE_URL" ]; then
  ENV_FILE=~/twenty/packages/twenty-e2e-testing/.env
  touch "$ENV_FILE"
  # Update or append each key
  for KEY_VAL in \
    "FRONTEND_BASE_URL=$FRONTEND_URL" \
    "BACKEND_BASE_URL=$BACKEND_URL"; do
    KEY="${KEY_VAL%%=*}"
    VAL="${KEY_VAL#*=}"
    if grep -q "^${KEY}=" "$ENV_FILE"; then
      sed -i "s|^${KEY}=.*|${KEY}=${VAL}|" "$ENV_FILE"
    else
      echo "${KEY}=${VAL}" >> "$ENV_FILE"
    fi
  done
  echo "  URLs set: FRONTEND_BASE_URL=$FRONTEND_URL, BACKEND_BASE_URL=$BACKEND_URL"
fi

# ── 5. Install packages + Playwright ─────────────────────────────────────────
echo ""
echo "[5/6] Installing dependencies..."
cd ~/twenty
yarn install --frozen-lockfile 2>&1 | tail -5 || yarn install 2>&1 | tail -5

echo "  Installing Playwright browsers..."
cd ~/twenty/packages/twenty-e2e-testing
npx playwright install chromium --with-deps 2>&1 | tail -10

# ── 6. Run tests ──────────────────────────────────────────────────────────────
echo ""
echo "[6/6] Running e2e tests: $TEST_SPEC"
echo "--------------------------------------"

mkdir -p run_results

# Run Playwright, pipe output live, capture exit code
set +e
npx playwright test "$TEST_SPEC" \
  --reporter=line \
  --project=chrome \
  2>&1
TEST_EXIT_CODE=$?
set -e

echo "--------------------------------------"

# ── Summary ───────────────────────────────────────────────────────────────────
if [ "$TEST_EXIT_CODE" -eq 0 ]; then
  echo ""
  echo "✓ All tests PASSED"
else
  echo ""
  echo "✗ Tests FAILED (exit code $TEST_EXIT_CODE)"

  # Print any failure artifacts
  if [ -d run_results ]; then
    echo ""
    echo "--- Failure artifacts in run_results/ ---"
    find run_results -type f | sort | head -40
  fi
fi

echo ""
echo "TEST_EXIT_CODE=$TEST_EXIT_CODE" > ~/test_result.env
echo "Test run complete: $(date)"

exit $TEST_EXIT_CODE
