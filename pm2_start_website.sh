#!/bin/bash
ulimit -c 0
WEBSITE_DIR="$(cd "$(dirname "$0")/packages/twenty-website" && pwd)"
cd "$WEBSITE_DIR"
yarn start -p 3001
