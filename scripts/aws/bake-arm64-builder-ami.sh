#!/usr/bin/env bash
# Bake an arm64 "base-instance-twenty-building-image" equivalent for arxmukti.
# Replays the install history from ami-09e12010e9d1fb5a3 (legacy x86 builder AMI),
# updated for Node 22 + Docker (Chatwoot builds).
#
# Usage:
#   AWS_PROFILE=arxmukti ./scripts/aws/bake-arm64-builder-ami.sh
#
# Outputs AMI id to stdout and writes scripts/aws/.arm64-builder-ami-id

set -euo pipefail

export AWS_PROFILE="${AWS_PROFILE:-arxmukti}"
AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="$AWS_REGION"

BASE_AMI="${BASE_AMI:-ami-02c4144237becae44}" # Ubuntu 24.04 arm64
INSTANCE_TYPE="${INSTANCE_TYPE:-t4g.large}"
KEY_NAME="${KEY_NAME:-arxmukti-key}"
SG_ID="${SG_ID:-sg-0da9fdd5e7f6c4f1e}"
SUBNET_ID="${SUBNET_ID:-subnet-026eb73699b4efba7}"
SSH_KEY_PATH="${SSH_KEY_PATH:-$HOME/.ssh/arxmukti-key.pem}"
VOLUME_SIZE="${VOLUME_SIZE:-30}"
AMI_NAME="${AMI_NAME:-base-instance-twenty-building-image-arm64-$(date +%Y%m%d%H%M)}"
NVM_VERSION="${NVM_VERSION:-v0.40.1}"
NODE_VERSION="${NODE_VERSION:-22}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_FILE="${SCRIPT_DIR}/.arm64-builder-ami-id"

TEMP_INSTANCE_ID=""

cleanup() {
  local code=$?
  if [ -n "${TEMP_INSTANCE_ID:-}" ]; then
    echo "Terminating bake instance ${TEMP_INSTANCE_ID}..." >&2
    aws ec2 terminate-instances --instance-ids "$TEMP_INSTANCE_ID" >/dev/null || true
  fi
  exit "$code"
}
trap cleanup EXIT INT

echo "Launching bake instance from ${BASE_AMI} (${INSTANCE_TYPE})..."
TEMP_INSTANCE_ID="$(
  aws ec2 run-instances \
    --image-id "$BASE_AMI" \
    --instance-type "$INSTANCE_TYPE" \
    --key-name "$KEY_NAME" \
    --security-group-ids "$SG_ID" \
    --subnet-id "$SUBNET_ID" \
    --block-device-mappings "[{\"DeviceName\":\"/dev/sda1\",\"Ebs\":{\"VolumeSize\":${VOLUME_SIZE},\"VolumeType\":\"gp3\",\"DeleteOnTermination\":true}}]" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=bake-arm64-builder},{Key=Purpose,Value=ami-bake}]" \
    --query 'Instances[0].InstanceId' \
    --output text
)"
echo "Instance: ${TEMP_INSTANCE_ID}"
aws ec2 wait instance-status-ok --instance-ids "$TEMP_INSTANCE_ID"

TEMP_DNS="$(
  aws ec2 describe-instances \
    --instance-ids "$TEMP_INSTANCE_ID" \
    --query 'Reservations[0].Instances[0].PublicDnsName' \
    --output text
)"
echo "DNS: ${TEMP_DNS}"

# Wait for sshd
for _ in $(seq 1 30); do
  if ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no -o ConnectTimeout=5 \
    "ubuntu@${TEMP_DNS}" 'echo ok' >/dev/null 2>&1; then
    break
  fi
  sleep 5
done

ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "ubuntu@${TEMP_DNS}" bash -s <<EOF
set -euo pipefail

# From old builder AMI bash_history + globals (nest/yarn under /usr/lib/node_modules),
# plus packages the build scripts install every run.
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \\
  build-essential \\
  ca-certificates \\
  curl \\
  git \\
  gnupg \\
  gzip \\
  libsqlite3-dev \\
  libcairo2-dev \\
  libpango1.0-dev \\
  libjpeg-dev \\
  libgif-dev \\
  librsvg2-dev \\
  libpixman-1-dev \\
  pkg-config \\
  python3 \\
  lsb-release \\
  docker.io \\
  unzip \\
  zip

sudo systemctl enable --now docker
sudo usermod -aG docker ubuntu

# System Node 22 (fallback) + global yarn/nest like the x86 AMI (/usr/bin/{yarn,nest})
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
sudo npm install -g yarn@1.22.22 @nestjs/cli@10

# nvm (exact flow from ami-09e12010e9d1fb5a3 history; build script sources ~/.nvm/nvm.sh)
curl -o- "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" | bash
export NVM_DIR="\$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "\$NVM_DIR/nvm.sh" ] && . "\$NVM_DIR/nvm.sh"
nvm install ${NODE_VERSION}
nvm alias default ${NODE_VERSION}
echo "${NODE_VERSION}" > "\$HOME/.nvmrc"
nvm use ${NODE_VERSION}

# Match old AMI vite local package (optional; build uses npx vite)
cat > "\$HOME/package.json" <<'PKG'
{
  "devDependencies": {
    "vite": "^5.4.9"
  }
}
PKG
npm install --prefix "\$HOME" || true

echo "=== bake verification ==="
uname -m
node -v
npm -v
yarn -v
nest --version
docker --version
command -v nest yarn node docker
ls -la "\$HOME/.nvm" | head
EOF

echo "Stopping instance before create-image..."
aws ec2 stop-instances --instance-ids "$TEMP_INSTANCE_ID" >/dev/null
aws ec2 wait instance-stopped --instance-ids "$TEMP_INSTANCE_ID"

echo "Creating AMI ${AMI_NAME}..."
AMI_ID="$(
  aws ec2 create-image \
    --instance-id "$TEMP_INSTANCE_ID" \
    --name "$AMI_NAME" \
    --description "arm64 builder: nvm+node${NODE_VERSION}, yarn, nest CLI, docker, build-essential, libsqlite3-dev (port of ami-09e12010e9d1fb5a3)" \
    --no-reboot \
    --query 'ImageId' \
    --output text
)"
echo "AMI: ${AMI_ID}"
echo "$AMI_ID" > "$OUT_FILE"

aws ec2 create-tags --resources "$AMI_ID" --tags \
  "Key=Name,Value=base-instance-twenty-building-image-arm64" \
  "Key=Source,Value=ami-09e12010e9d1fb5a3-history" \
  "Key=Architecture,Value=arm64"

echo "Waiting for AMI available..."
aws ec2 wait image-available --image-ids "$AMI_ID"

echo "AMI ready: ${AMI_ID}"
echo "Wrote ${OUT_FILE}"
