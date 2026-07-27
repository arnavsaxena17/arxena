#!/usr/bin/env bash

set -euo pipefail

APP_DIR="${CHATWOOT_APP_DIR:-/home/chatwoot/chatwoot}"
REMOTE_NAME="${CHATWOOT_REMOTE_NAME:-origin}"
BRANCH_NAME="${CHATWOOT_BRANCH:-arxena/onboarding-workspace}"
DEPLOY_TARGET="${CHATWOOT_DEPLOY_TARGET:-chatwoot.target}"
RUN_DB_MIGRATIONS="${CHATWOOT_RUN_MIGRATIONS:-true}"
RAILS_ENVIRONMENT="${RAILS_ENV:-production}"
NODE_ENVIRONMENT="${NODE_ENV:-production}"
NODE_OPTIONS_VALUE="${CHATWOOT_NODE_OPTIONS:---max-old-space-size=4096 --openssl-legacy-provider}"

if [ ! -d "${APP_DIR}/.git" ]; then
  echo "Chatwoot app directory is not a git checkout: ${APP_DIR}" >&2
  exit 1
fi

echo "Deploying Chatwoot from ${REMOTE_NAME}/${BRANCH_NAME}"
echo "App dir: ${APP_DIR}"
echo "Systemd target: ${DEPLOY_TARGET}"

cd "${APP_DIR}"

git fetch "${REMOTE_NAME}"
git checkout "${BRANCH_NAME}"
git pull "${REMOTE_NAME}" "${BRANCH_NAME}"

bundle
pnpm i

RAILS_ENV="${RAILS_ENVIRONMENT}" \
NODE_ENV="${NODE_ENVIRONMENT}" \
NODE_OPTIONS="${NODE_OPTIONS_VALUE}" \
bundle exec rake assets:precompile

if [ "${RUN_DB_MIGRATIONS}" = "true" ]; then
  RAILS_ENV="${RAILS_ENVIRONMENT}" \
  POSTGRES_STATEMENT_TIMEOUT=600s \
  bundle exec rake db:migrate
fi

sudo systemctl daemon-reload
sudo systemctl restart "${DEPLOY_TARGET}"
sudo systemctl status "${DEPLOY_TARGET}" --no-pager
