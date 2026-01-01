#!/bin/bash

# Quick Load Test Script
# Usage: ./quick-test.sh [tool] [concurrent] [duration]
# Example: ./quick-test.sh node 10 60

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for required environment variables
if [ -z "$TOKEN" ]; then
    echo -e "${RED}Error: TOKEN environment variable is not set${NC}"
    echo "Please set it with: export TOKEN='your-token-here'"
    exit 1
fi

if [ -z "$JOB_ID" ] && [ -z "$SEARCH_FILTER_ID" ]; then
    echo -e "${RED}Error: Either JOB_ID or SEARCH_FILTER_ID environment variable must be set${NC}"
    echo "  JOB_ID: Will automatically create a searchFilter for this job"
    echo "  SEARCH_FILTER_ID: Use an existing searchFilter"
    echo ""
    echo "Set one of:"
    echo "  export JOB_ID='your-job-id'"
    echo "  export SEARCH_FILTER_ID='your-search-filter-id'"
    exit 1
fi

# Default values
TOOL=${1:-node}
CONCURRENT=${2:-5}
DURATION=${3:-30}
BASE_URL=${BASE_URL:-http://localhost:3000}

echo -e "${GREEN}Starting load test with:${NC}"
echo "  Tool: $TOOL"
echo "  Concurrent: $CONCURRENT"
echo "  Duration: ${DURATION}s"
echo "  Base URL: $BASE_URL"
if [ -n "$JOB_ID" ]; then
    echo "  Job ID: $JOB_ID (will auto-create SearchFilter)"
else
    echo "  Search Filter ID: $SEARCH_FILTER_ID"
fi
echo ""

case $TOOL in
    node)
        if ! command -v node &> /dev/null; then
            echo -e "${RED}Error: Node.js is not installed${NC}"
            exit 1
        fi
        CMD="node load-test-sse-endpoint.js --url \"$BASE_URL\" --token \"$TOKEN\" --concurrent \"$CONCURRENT\" --duration \"$DURATION\""
        if [ -n "$JOB_ID" ]; then
            CMD="$CMD --jobId \"$JOB_ID\""
        else
            CMD="$CMD --searchFilterId \"$SEARCH_FILTER_ID\""
        fi
        eval $CMD
        ;;
    
    k6)
        if ! command -v k6 &> /dev/null; then
            echo -e "${RED}Error: k6 is not installed${NC}"
            echo "Install with: brew install k6 (macOS) or see https://k6.io/docs/getting-started/installation/"
            exit 1
        fi
        ENV_VARS="--env TOKEN=\"$TOKEN\" --env BASE_URL=\"$BASE_URL\""
        if [ -n "$JOB_ID" ]; then
            ENV_VARS="$ENV_VARS --env JOB_ID=\"$JOB_ID\""
        else
            ENV_VARS="$ENV_VARS --env SEARCH_FILTER_ID=\"$SEARCH_FILTER_ID\""
        fi
        k6 run --vus "$CONCURRENT" --duration "${DURATION}s" $ENV_VARS k6-load-test.js
        ;;
    
    python)
        if ! command -v python3 &> /dev/null; then
            echo -e "${RED}Error: Python 3 is not installed${NC}"
            exit 1
        fi
        CMD="python3 load-test-python.py --url \"$BASE_URL\" --token \"$TOKEN\" --concurrent \"$CONCURRENT\" --duration \"$DURATION\""
        if [ -n "$JOB_ID" ]; then
            CMD="$CMD --job-id \"$JOB_ID\""
        else
            CMD="$CMD --search-filter-id \"$SEARCH_FILTER_ID\""
        fi
        eval $CMD
        ;;
    
    artillery)
        if ! command -v artillery &> /dev/null; then
            echo -e "${RED}Error: Artillery is not installed${NC}"
            echo "Install with: npm install -g artillery"
            exit 1
        fi
        BASE_URL="$BASE_URL" TOKEN="$TOKEN" SEARCH_FILTER_ID="$SEARCH_FILTER_ID" \
            artillery run artillery-config.yml
        ;;
    
    *)
        echo -e "${RED}Error: Unknown tool '$TOOL'${NC}"
        echo "Available tools: node, k6, python, artillery"
        exit 1
        ;;
esac

echo -e "\n${GREEN}Load test completed!${NC}"

