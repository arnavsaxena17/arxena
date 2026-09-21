#!/bin/bash
set -euo pipefail

git add .
git commit -m "new changes"
git push
# -t so we can attach into the createApp screen on prod
ssh -t app.arxena.com "./git_pull_force_full_build.sh"
