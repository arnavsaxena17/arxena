#!/bin/bash
echo "NODE_ENV is: $NODE_ENV"

NODE_BIN=${NVM_NODE_22_BIN:-/home/ubuntu/.nvm/versions/node/v22.16.0/bin/node}
if [[ ! -x "$NODE_BIN" ]]; then
  NODE_BIN=$(command -v node || true)
fi

if [[ -z "$NODE_BIN" ]]; then
  echo "Node.js binary not found"
  exit 1
fi

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
export PATH="$(dirname "$NODE_BIN"):$PATH"

echo "Using Node: $NODE_BIN"
"$NODE_BIN" "$PROJECT_ROOT/node_modules/nx/bin/nx.js" start:prod twenty-server
