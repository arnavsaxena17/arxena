---
name: deploy-twenty-production
description: >-
  Deploy Arxena Twenty to production (app.arxena.com). Commit locally on the
  current branch, push, then git pull on the same branch on the server. Never
  write files directly to the server. Use when the user asks to deploy,
  ship to production, pull on prod, restart pm2, build twenty-server,
  twenty-website, twenty-front, twenty-orgchart, twenty-mcp-server,
  twenty-shared, twenty-docs (Mintlify), or run build_app_in_new_instance.sh.
---

# Deploy Twenty to production

## Critical safety

- **Never write or copy files directly to the production server.** All changes go through git: local commit → push → production `git pull`.
- Do not `scp`/`rsync` app source onto production as a substitute for this flow.
- Do not run a production pull/build/restart unless the user asked to deploy.

## Hosts and paths

| Item | Value |
| --- | --- |
| SSH | `ssh app.arxena.com` (ubuntu, `~/arxmukti-key.pem`) |
| Production repo | `/home/ubuntu/twenty` |
| Usual deploy branch | current local branch; default `port/arxena-modules` (`build.config` `BUILD_BRANCH`) |
| Front build script | `/home/ubuntu/twenty/build_app_in_new_instance.sh` (also in repo root locally) |

## Workflow

Copy this checklist and track it:

```
Deploy:
- [ ] 1. Commit on current local branch (never skip commit)
- [ ] 2. Push commits to the remote
- [ ] 3. SSH production, same directory, same branch, git pull
- [ ] 4. Choose build path from changed packages
- [ ] 5. Confirm processes came back
```

### 1. Commit locally first

Work from the Twenty repo (`arxena/`). Stay on the **current branch**. Commit the deployable changes there before anything touches production.

If there is nothing to commit, stop and tell the user — do not deploy stale or uncommitted work.

### 2. Push

Push the commits on that branch to the remote (`git push`). Production must be able to `git pull` the same commits.

### 3. Production pull

SSH to production. In `/home/ubuntu/twenty` on the **same branch** (usually the current local branch):

```bash
ssh app.arxena.com
cd /home/ubuntu/twenty
git status
git branch --show-current
git pull
```

If production is on a different branch than local, check out the same branch first, then pull. Do not mix branches.

### 4. Build and restart (depends on what changed)

Inspect the commits / diff vs production HEAD before the pull.

**In-place nx is allowed only when every changed package is `twenty-server` and/or `twenty-website`.** If anything in the new-instance list below changed, skip nx on the live box.

**twenty-server only:**

```bash
cd /home/ubuntu/twenty
npx nx run twenty-server:build
pm2 restart all
```

**twenty-website only** (or website + server, still nothing from the new-instance list):

```bash
cd /home/ubuntu/twenty
npx nx run twenty-website:build
pm2 restart all
```

If both server and website changed, run both nx builds, then `pm2 restart all`.

**New-instance build** — do **not** build these in place on production. Use `build_app_in_new_instance.sh` if any of these changed:

- `packages/twenty-front/**`
- `packages/twenty-orgchart/**`
- `packages/twenty-orgchart-embed/**`
- `packages/twenty-mcp-server/**`
- `packages/twenty-shared/**`
- `packages/twenty-docs/**` (Mintlify)

```bash
cd /home/ubuntu/twenty
./build_app_in_new_instance.sh
```

That script syncs the build branch, spins a builder instance, deploys the built app, then runs production `yarn command:prod upgrade` (cache flush → upgrade all workspaces → cache flush) **before** `pm2 restart`. Do not substitute `npx nx run twenty-front:build`, orgchart/mcp/shared/docs (Mintlify) builds, or `yarn build` on the live box.

Skip the upgrade step only with `SKIP_PROD_UPGRADE=1`. Do not use `npx nx run twenty-server:command` on production for this — Nx can hang after "Command completed!". Use `yarn command:prod …` from `packages/twenty-server`.

The orchestrator kills a remote builder SSH session that is still open ~90s after the log shows `Required build check passed` / `failed`, so a completed build cannot leave the pipeline stuck. CLI commands force-exit after Nest `app.close()` for the same reason.

If the change set mixes server/website **and** any new-instance package, use `build_app_in_new_instance.sh` only.

### 5. Verify

After restart or the new-instance script:

```bash
pm2 status
```

Confirm expected processes are online. Report commit SHA pulled, which build path ran, and pm2 status.

## Do not

- Write files onto the server with editor, scp of source, or patch-in-place.
- Force-push or rewrite history as part of deploy.
- Run `git_pull_all.sh` for a server-only or website-only change (it also builds front on the box).
- Build twenty-front, org chart, MCP, twenty-shared, or Mintlify (`twenty-docs`) on the production instance.
