# Chatwoot Production Deploy

This project keeps Arxena's main app in the monorepo and Chatwoot as a
separate checkout at `tools/chatwoot-source`.

`support.arxena.com` should deploy from the same Chatwoot fork and branch that
we use locally, so local testing and production stay aligned.

Current production host, verified on March 24, 2026:

- host: `app.arxena.com`
- source checkout: `/home/ubuntu/twenty/tools/chatwoot-source`
- compose project: `/home/ubuntu/twenty/tools/chatwoot-local/docker-compose.yml`
- public entrypoint: nginx proxies `support.arxena.com` to `127.0.0.1:3003`
- runtime: Docker Compose, not `systemd` Chatwoot units

## Recommended setup

Use this branch in the main repo:

- `onboarding-workspace`

Use a dedicated Chatwoot fork and branch for Chatwoot itself:

- fork: `github.com/arnavsaxena17/chatwoot`
- branch: `arxena/onboarding-workspace`

## Local Chatwoot repo

The local Chatwoot checkout at `tools/chatwoot-source` is its own git repo.
Pushing the main `arxena` repo does not push Chatwoot changes.

Point the local Chatwoot checkout to your fork:

```bash
cd /Users/arnavsaxena/MEGA/arx/arxena/tools/chatwoot-source
git remote rename origin upstream
git remote add origin https://github.com/arnavsaxena17/chatwoot.git
git fetch origin
git checkout -b arxena/onboarding-workspace --track origin/arxena/onboarding-workspace
```

If the branch does not exist yet:

```bash
cd /Users/arnavsaxena/MEGA/arx/arxena/tools/chatwoot-source
git remote rename origin upstream
git remote add origin https://github.com/arnavsaxena17/chatwoot.git
git checkout -b arxena/onboarding-workspace
git push -u origin arxena/onboarding-workspace
```

Keep upstream configured so Chatwoot updates are still available:

```bash
git fetch upstream
```

## Production server setup

On the production server, make `/home/ubuntu/twenty/tools/chatwoot-source`
track the same fork and branch:

```bash
cd /home/ubuntu/twenty/tools/chatwoot-source
git remote rename origin upstream
git remote add origin https://github.com/arnavsaxena17/chatwoot.git
git fetch origin
git checkout arxena/onboarding-workspace
git branch --set-upstream-to=origin/arxena/onboarding-workspace
```

If the server already has local changes, stop and review them before switching
remotes or branches.

## Authentication note

If `git push` fails over HTTPS with a 403, your machine is probably using saved
credentials for a different GitHub account. Fix that by either:

```bash
printf "protocol=https\nhost=github.com\n" | git credential-osxkeychain erase
```

Then push again and sign in as `arnavsaxena17`, or switch the remote to SSH
after adding your GitHub SSH key:

```bash
cd /Users/arnavsaxena/MEGA/arx/arxena/tools/chatwoot-source
git remote set-url origin git@github.com:arnavsaxena17/chatwoot.git
```

## Deploy command

This repo includes a production deploy helper for the live Docker setup:

- `scripts/deploy-chatwoot-compose-production.sh`

Run it on the production server:

```bash
CHATWOOT_BRANCH=arxena/onboarding-workspace \
bash /path/to/arxena/scripts/deploy-chatwoot-compose-production.sh
```

Supported environment variables:

- `CHATWOOT_SOURCE_DIR`: defaults to `/home/ubuntu/twenty/tools/chatwoot-source`
- `CHATWOOT_COMPOSE_DIR`: defaults to `/home/ubuntu/twenty/tools/chatwoot-local`
- `CHATWOOT_REMOTE_NAME`: defaults to `origin`
- `CHATWOOT_BRANCH`: defaults to `arxena/onboarding-workspace`
- `CHATWOOT_REBUILD_IMAGES`: `true` or `false`, defaults to `true`
- `CHATWOOT_RUN_MIGRATIONS`: `true` or `false`, defaults to `true`

The older `scripts/deploy-chatwoot-production.sh` script is for a native
systemd Chatwoot VM install. That is not the current production setup on
`app.arxena.com`.

## Typical workflow

1. Make Chatwoot changes locally in `tools/chatwoot-source`.
2. Commit and push from `tools/chatwoot-source`.
3. SSH to the production server.
4. Run `scripts/deploy-chatwoot-compose-production.sh`.
5. Verify `support.arxena.com` in the browser and check logs if needed.

## Restart commands

For the live production host:

```bash
cd /home/ubuntu/twenty/tools/chatwoot-local
docker compose up -d rails sidekiq
```

Rebuild and restart after code changes:

```bash
cd /home/ubuntu/twenty/tools/chatwoot-local
docker compose build rails sidekiq
docker compose up -d rails sidekiq
```

Check logs:

```bash
cd /home/ubuntu/twenty/tools/chatwoot-local
docker compose logs --tail=200 rails sidekiq
```

## Widget CORS troubleshooting

If the website widget or app widget fails with a browser error like:

```text
Access to script at 'https://support.arxena.com/packs/js/sdk.js' has been blocked by CORS policy:
The 'Access-Control-Allow-Origin' header contains multiple values '*, *', but only one is allowed.
```

the problem is not the frontend embed code. It means both layers are adding
the same CORS headers:

- Chatwoot already sends `Access-Control-Allow-Origin` for `/packs/js/sdk.js`
- nginx on `support.arxena.com` must not add duplicate `Access-Control-Allow-*`

Sanity check the upstream Chatwoot app directly on the host:

```bash
curl -sD - -o /dev/null 'http://127.0.0.1:3003/packs/js/sdk.js' \
  -H 'Host: support.arxena.com' \
  -H 'Origin: https://arxena.com'
```

That upstream response should contain only one `access-control-allow-origin`
header. If the public `https://support.arxena.com/packs/js/sdk.js` response
shows two copies, remove the nginx `add_header Access-Control-Allow-*` lines
from `/etc/nginx/sites-enabled/support-arxena.conf`, then reload nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

If the widget works on `arxena.com` but the iframe is still blocked on
`app.arxena.com`, check the main app shell headers too:

```bash
curl -sD - -o /dev/null 'https://app.arxena.com/welcome'
```

If that response includes:

- `Cross-Origin-Embedder-Policy: require-corp`
- `Cross-Origin-Opener-Policy: same-origin`

then Chromium can block the cross-origin Chatwoot iframe even when the Chatwoot
headers are correct. Remove those two headers from the `location /` block in
`/etc/nginx/sites-enabled/twenty.conf`, reload nginx, and retest the widget.

## Important note

`git push` from the main repo at `/Users/arnavsaxena/MEGA/arx/arxena` will not
deploy Chatwoot changes by itself. Chatwoot must be committed and pushed from
its own repo at `tools/chatwoot-source`.
