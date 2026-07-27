#!/usr/bin/env bash

set -euo pipefail

COMPOSE_DIR="${CHATWOOT_COMPOSE_DIR:-/home/ubuntu/twenty/tools/chatwoot-local}"
SOURCE_DIR="${CHATWOOT_SOURCE_DIR:-/home/ubuntu/twenty/tools/chatwoot-source}"
REMOTE_NAME="${CHATWOOT_REMOTE_NAME:-origin}"
BRANCH_NAME="${CHATWOOT_BRANCH:-arxena/onboarding-workspace}"
REBUILD_IMAGES="${CHATWOOT_REBUILD_IMAGES:-true}"
RUN_MIGRATIONS="${CHATWOOT_RUN_MIGRATIONS:-true}"

if [ ! -d "${SOURCE_DIR}/.git" ]; then
  echo "Chatwoot source directory is not a git checkout: ${SOURCE_DIR}" >&2
  exit 1
fi

if [ ! -f "${COMPOSE_DIR}/docker-compose.yml" ]; then
  echo "Chatwoot compose file not found in: ${COMPOSE_DIR}" >&2
  exit 1
fi

echo "Deploying Chatwoot compose stack from ${REMOTE_NAME}/${BRANCH_NAME}"
echo "Source dir: ${SOURCE_DIR}"
echo "Compose dir: ${COMPOSE_DIR}"

cd "${SOURCE_DIR}"
git fetch "${REMOTE_NAME}"
git checkout "${BRANCH_NAME}"
git pull "${REMOTE_NAME}" "${BRANCH_NAME}"

cd "${COMPOSE_DIR}"

if [ "${REBUILD_IMAGES}" = "true" ]; then
  docker compose build rails sidekiq
fi

if [ "${RUN_MIGRATIONS}" = "true" ]; then
  docker compose run --rm rails bundle exec rails db:chatwoot_prepare
fi

docker compose up -d rails sidekiq
docker compose ps
