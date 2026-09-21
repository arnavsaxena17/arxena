#!/bin/bash
set -euo pipefail

echo "=== Force full build at $(date) ==="
cd ~/twenty
git pull

# Ensure createApp screen exists (detached)
if ! screen -list | grep -q '[.]createApp[[:space:]]'; then
  echo ">>> Creating screen session createApp"
  screen -dmS createApp
fi

# Detach any other attachment, inject the build, then enter the screen
screen -d createApp 2>/dev/null || true
screen -S createApp -X stuff $'cd ~/twenty\nFORCE_FULL_BUILD=1 ./build_app_in_new_instance.sh\n'
exec screen -r -d createApp
