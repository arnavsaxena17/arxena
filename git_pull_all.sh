#!/bin/bash

# Record start time
START_TIME=$(date +%s)

echo "=== Starting deployment at $(date) ==="
echo ""

# Git pull
echo ">>> Pulling latest changes..."
STEP_START=$(date +%s)
cd twenty
git pull
STEP_END=$(date +%s)
echo "Git pull completed in $((STEP_END - STEP_START)) seconds"
echo ""

# Build server
echo ">>> Building server..."
STEP_START=$(date +%s)
cd ~/twenty/packages/twenty-server
# Extract and compile lingui catalogs
mkdir -p src/engine/core-modules/i18n/locales/generated
npx lingui extract --clean --verbose
npx lingui compile --verbose || npx nx run twenty-server:lingui:compile
nest build -p tsconfig.build.json
STEP_END=$(date +%s)
echo "Server build completed in $((STEP_END - STEP_START)) seconds"
echo ""

# Build frontend
echo ">>> Building frontend..."
STEP_START=$(date +%s)
cd ~/twenty/packages/twenty-front
# Extract and compile lingui catalogs
mkdir -p src/locales/generated
npx lingui extract --clean --verbose
npx lingui compile --verbose || npx nx run twenty-front:lingui:compile
sudo VITE_BUILD_SOURCEMAP=false NODE_OPTIONS="--max-old-space-size=4096" yarn build
STEP_END=$(date +%s)
echo "Frontend build completed in $((STEP_END - STEP_START)) seconds"
echo ""

# Restart PM2
echo ">>> Restarting PM2 processes..."
STEP_START=$(date +%s)
pm2 restart all
STEP_END=$(date +%s)
echo "PM2 restart completed in $((STEP_END - STEP_START)) seconds"
echo ""

# Calculate total time
END_TIME=$(date +%s)
TOTAL_TIME=$((END_TIME - START_TIME))
MINUTES=$((TOTAL_TIME / 60))
SECONDS=$((TOTAL_TIME % 60))

echo "=== Deployment completed at $(date) ==="
echo "Total time: ${MINUTES}m ${SECONDS}s (${TOTAL_TIME} seconds)"
