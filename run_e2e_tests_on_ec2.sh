#!/bin/bash
# ============================================================
# run_e2e_tests_on_ec2.sh
#
# Spins up a fresh EC2 instance, clones the arxena/twenty repo,
# installs packages, runs Playwright e2e tests against the
# production server, streams results live to this terminal,
# then terminates the instance.
#
# Usage:
#   ./run_e2e_tests_on_ec2.sh [TEST_SPEC]
#
# Examples:
#   ./run_e2e_tests_on_ec2.sh
#   ./run_e2e_tests_on_ec2.sh signup.delete-account.pipeline.spec.ts
#   ./run_e2e_tests_on_ec2.sh "authentication/signup_invite_email.spec.ts"
#
# Environment overrides (optional):
#   TEST_BRANCH        git branch to test          (default: port/arxena-modules)
#   FRONTEND_BASE_URL  production frontend URL      (default: https://app.arxena.com)
#   BACKEND_BASE_URL   production backend URL       (default: https://api.arxena.com)
#   EC2_INSTANCE_TYPE  EC2 type                    (default: t4g.large)
#   KEEP_INSTANCE      set to 1 to skip termination (default: 0)
# ============================================================

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
AWS_PROFILE="${AWS_PROFILE:-arxmukti}"
AWS_CMD="aws --profile $AWS_PROFILE"

# Same baked arm64 builder AMI as app/chatwoot builds (not stock Ubuntu)
AMI_ID="${EC2_IMAGE_ID:-ami-0cb194b5ec6f48d24}"
INSTANCE_TYPE="${EC2_INSTANCE_TYPE:-t4g.large}"
KEY_NAME="${EC2_KEY_NAME:-arxmukti-key}"
KEY_PATH="${SSH_KEY_PATH:-$HOME/.ssh/arxmukti-key.pem}"
SECURITY_GROUP="${EC2_SECURITY_GROUP_ID:-sg-0da9fdd5e7f6c4f1e}"
SUBNET_ID="${EC2_SUBNET_ID:-subnet-026eb73699b4efba7}"

TEST_BRANCH="${TEST_BRANCH:-port/arxena-modules}"
FRONTEND_BASE_URL="${FRONTEND_BASE_URL:-https://app.arxena.com}"
BACKEND_BASE_URL="${BACKEND_BASE_URL:-https://api.arxena.com}"

# Test spec: first argument, or default
TEST_SPEC="${1:-signup.delete-account.pipeline.spec.ts}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REMOTE_SCRIPT="$SCRIPT_DIR/script_to_run_e2e_on_instance.sh"
E2E_ENV="$SCRIPT_DIR/packages/twenty-e2e-testing/.env"

INSTANCE_ID=""

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${CYAN}${BOLD}[INFO]${RESET} $*"; }
success() { echo -e "${GREEN}${BOLD}[PASS]${RESET} $*"; }
warn()    { echo -e "${YELLOW}${BOLD}[WARN]${RESET} $*"; }
error()   { echo -e "${RED}${BOLD}[FAIL]${RESET} $*"; }

# ── Cleanup / Terminate ───────────────────────────────────────────────────────
cleanup() {
  local exit_code=$?
  echo ""
  if [ -n "$INSTANCE_ID" ]; then
    if [ "${KEEP_INSTANCE:-0}" = "1" ]; then
      warn "KEEP_INSTANCE=1 — instance $INSTANCE_ID left running."
    else
      info "Terminating EC2 instance $INSTANCE_ID ..."
      $AWS_CMD ec2 terminate-instances --instance-ids "$INSTANCE_ID" \
        --query 'TerminatingInstances[0].CurrentState.Name' --output text || true
      info "Instance terminated."
    fi
  fi
  exit $exit_code
}
trap cleanup EXIT
trap cleanup INT TERM

# ── Pre-flight checks ─────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}=====================================================${RESET}"
echo -e "${BOLD} Arxena E2E Test Suite — EC2 Runner${RESET}"
echo -e "${BOLD}=====================================================${RESET}"
echo -e " Profile     : ${CYAN}$AWS_PROFILE${RESET}"
echo -e " Branch      : ${CYAN}$TEST_BRANCH${RESET}"
echo -e " Frontend    : ${CYAN}$FRONTEND_BASE_URL${RESET}"
echo -e " Backend     : ${CYAN}$BACKEND_BASE_URL${RESET}"
echo -e " Test spec   : ${CYAN}$TEST_SPEC${RESET}"
echo -e " Instance    : ${CYAN}$INSTANCE_TYPE${RESET}"
echo ""

if [ ! -f "$KEY_PATH" ]; then
  error "SSH key not found: $KEY_PATH"
  exit 1
fi
if [ ! -f "$REMOTE_SCRIPT" ]; then
  error "Remote test script not found: $REMOTE_SCRIPT"
  exit 1
fi
if [ ! -f "$E2E_ENV" ]; then
  warn ".env not found at $E2E_ENV — tests will use defaults only."
fi

# ── 1. Launch EC2 instance ────────────────────────────────────────────────────
info "Launching EC2 instance ($INSTANCE_TYPE, AMI: $AMI_ID)..."
START_TIME=$(date +%s)

INSTANCE_ID=$(
  $AWS_CMD ec2 run-instances \
    --image-id "$AMI_ID" \
    --instance-type "$INSTANCE_TYPE" \
    --key-name "$KEY_NAME" \
    --security-group-ids "$SECURITY_GROUP" \
    --subnet-id "$SUBNET_ID" \
    --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":20,"VolumeType":"gp2"}}]' \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=arxena-e2e-test},{Key=Purpose,Value=e2e-testing}]" \
    --query 'Instances[0].InstanceId' \
    --output text
)

info "Instance ID: $INSTANCE_ID"
info "Waiting for instance to pass status checks (this takes ~2 min)..."
$AWS_CMD ec2 wait instance-status-ok --instance-ids "$INSTANCE_ID"

END_TIME=$(date +%s)
info "Instance ready in $((END_TIME - START_TIME))s."

# ── 2. Get public DNS ─────────────────────────────────────────────────────────
INSTANCE_DNS=$(
  $AWS_CMD ec2 describe-instances \
    --instance-ids "$INSTANCE_ID" \
    --query 'Reservations[0].Instances[0].PublicDnsName' \
    --output text
)
info "Public DNS: $INSTANCE_DNS"

SSH="ssh -i $KEY_PATH -o StrictHostKeyChecking=no -o ConnectTimeout=30"
SCP="scp -i $KEY_PATH -o StrictHostKeyChecking=no"

# ── 3. Wait for SSH to be ready ───────────────────────────────────────────────
info "Waiting for SSH to become available..."
for i in $(seq 1 20); do
  if $SSH ubuntu@"$INSTANCE_DNS" "echo ok" &>/dev/null; then
    break
  fi
  sleep 6
done
info "SSH ready."

# ── 4. Upload scripts and env files ──────────────────────────────────────────
info "Uploading scripts and env files..."

$SCP "$REMOTE_SCRIPT" ubuntu@"$INSTANCE_DNS":/home/ubuntu/script_to_run_e2e_on_instance.sh

if [ -f "$E2E_ENV" ]; then
  $SCP "$E2E_ENV" ubuntu@"$INSTANCE_DNS":/home/ubuntu/.env_e2e
  info "Uploaded .env_e2e"
fi

# ── 5. Run tests — stream output live ────────────────────────────────────────
echo ""
echo -e "${BOLD}-----------------------------------------------------${RESET}"
echo -e "${BOLD} Running tests on remote instance...${RESET}"
echo -e "${BOLD}-----------------------------------------------------${RESET}"
echo ""

TEST_EXIT_CODE=0

$SSH -t ubuntu@"$INSTANCE_DNS" \
  "chmod +x /home/ubuntu/script_to_run_e2e_on_instance.sh && \
   TEST_BRANCH='$TEST_BRANCH' \
   FRONTEND_BASE_URL='$FRONTEND_BASE_URL' \
   BACKEND_BASE_URL='$BACKEND_BASE_URL' \
   TEST_SPEC='$TEST_SPEC' \
   /home/ubuntu/script_to_run_e2e_on_instance.sh" \
  || TEST_EXIT_CODE=$?

# ── 6. Pull artifacts ─────────────────────────────────────────────────────────
RESULTS_DIR="$SCRIPT_DIR/e2e-results/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$RESULTS_DIR"

info "Pulling test artifacts to $RESULTS_DIR ..."
$SCP -r ubuntu@"$INSTANCE_DNS":/home/ubuntu/twenty/packages/twenty-e2e-testing/run_results/. \
  "$RESULTS_DIR/" 2>/dev/null \
  && info "Artifacts saved to $RESULTS_DIR/" \
  || warn "No run_results directory found (no test artifacts to download)."

# ── 7. Final summary ──────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}=====================================================${RESET}"
if [ "$TEST_EXIT_CODE" -eq 0 ]; then
  success "All tests PASSED"
else
  error "Tests FAILED (exit code: $TEST_EXIT_CODE)"
  if ls "$RESULTS_DIR"/*.png &>/dev/null 2>&1; then
    echo ""
    echo "  Screenshots saved:"
    ls "$RESULTS_DIR"/*.png 2>/dev/null | while read f; do
      echo "    $f"
    done
  fi
fi
echo -e "${BOLD}=====================================================${RESET}"
echo ""

exit "$TEST_EXIT_CODE"
