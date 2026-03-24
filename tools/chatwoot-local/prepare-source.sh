#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CHATWOOT_DIR="${ROOT_DIR}/tools/chatwoot-source"
BRANDING_DIR="${ROOT_DIR}/tools/chatwoot-local/branding"
CHATWOOT_REF="${CHATWOOT_REF:-develop}"

if [ ! -d "${CHATWOOT_DIR}/.git" ]; then
  git clone --depth 1 --branch "${CHATWOOT_REF}" https://github.com/chatwoot/chatwoot.git "${CHATWOOT_DIR}"
else
  git -C "${CHATWOOT_DIR}" fetch origin "${CHATWOOT_REF}" --depth 1
  git -C "${CHATWOOT_DIR}" checkout "${CHATWOOT_REF}"
  git -C "${CHATWOOT_DIR}" reset --hard "origin/${CHATWOOT_REF}"
fi

mkdir -p "${CHATWOOT_DIR}/public/brand-assets/generated"

cp "${BRANDING_DIR}/brand-assets/logo.svg" "${CHATWOOT_DIR}/public/brand-assets/logo.svg"
cp "${BRANDING_DIR}/brand-assets/logo_dark.svg" "${CHATWOOT_DIR}/public/brand-assets/logo_dark.svg"
cp "${BRANDING_DIR}/brand-assets/logo_thumbnail.svg" "${CHATWOOT_DIR}/public/brand-assets/logo_thumbnail.svg"
cp "${BRANDING_DIR}/brand-assets/generated/arxena-logo-wordmark.png" "${CHATWOOT_DIR}/public/brand-assets/generated/arxena-logo-wordmark.png"
cp "${BRANDING_DIR}/brand-assets/generated/arxena-logo-mark.png" "${CHATWOOT_DIR}/public/brand-assets/generated/arxena-logo-mark.png"

for asset in \
  apple-touch-icon.png \
  favicon-16x16.png \
  favicon-32x32.png \
  favicon-96x96.png \
  favicon-512x512.png \
  ms-icon-70x70.png \
  ms-icon-144x144.png \
  ms-icon-150x150.png \
  ms-icon-310x310.png
do
  cp "${BRANDING_DIR}/public/${asset}" "${CHATWOOT_DIR}/public/${asset}"
done

perl -0pi -e 's/"POWERED_BY": "Powered by Chatwoot"/"POWERED_BY": "Powered by Arxena"/g' \
  "${CHATWOOT_DIR}/app/javascript/widget/i18n/locale/en.json" \
  "${CHATWOOT_DIR}/app/javascript/survey/i18n/locale/en.json"

perl -0pi -e 's/"BRANDING_TEXT": "Powered by Chatwoot"/"BRANDING_TEXT": "Powered by Arxena"/g' \
  "${CHATWOOT_DIR}/app/javascript/dashboard/i18n/locale/en/inboxMgmt.json"

perl -0pi -e 's/alt="Chatwoot"/alt="Arxena"/g' \
  "${CHATWOOT_DIR}/app/views/super_admin/devise/sessions/new.html.erb" \
  "${CHATWOOT_DIR}/app/views/installation/onboarding/index.html.erb"

echo "Prepared branded Chatwoot source at ${CHATWOOT_DIR}"
