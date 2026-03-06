# AGENTS.md

## Cursor Cloud specific instructions

### Architecture
This is Arxena, a recruitment/talent sourcing CRM built on top of Twenty (open-source CRM). It is a **Yarn 4 + Nx 18 monorepo** with three primary packages in scope:
- **twenty-server** (NestJS backend, port 3000)
- **twenty-front** (React/Vite frontend, port 3001)
- **twenty-website** (Next.js marketing site, port 3002)

### Infrastructure dependencies
- **PostgreSQL**: Docker container `twenty_pg` using `twentycrm/twenty-postgres-spilo:latest` on port 5432 (user: `postgres`, pass: `postgres`, db: `default`).
- **Redis**: Docker container `twenty_redis` using `redis/redis-stack-server:latest` on port 6379.
- Both must be running before starting the server. Check with `docker ps`.

### Starting services
1. Ensure Docker is running (`sudo dockerd &>/tmp/dockerd.log &` if needed, then `sudo chmod 666 /var/run/docker.sock`).
2. Start PG & Redis if not running: see `Makefile` targets `postgres-on-docker` / `redis-on-docker`.
3. **twenty-server**: `cd packages/twenty-server && NODE_OPTIONS="--max-old-space-size=8192" NODE_ENV=development npx nest start --watch`. Note: `npx nx run twenty-server:start` depends on a `typecheck` target that has pre-existing TS errors; bypass by running nest directly.
4. **twenty-front**: `npx nx run twenty-front:start` (Vite dev server on port 3001).
5. **twenty-website**: `cd packages/twenty-website && PORT=3002 npx next dev -p 3002`. Note: `npx nx run twenty-website:start` uses `next start` which requires a prior build; use `next dev` for development. Port 3002 avoids conflict with twenty-server on 3000.

### Database setup
Run `npx nx database:reset twenty-server` to truncate, set up schemas, migrate, and seed dev data. This requires `twenty-shared` and `twenty-emails` to be built first (Nx handles this via `dependsOn`). The `canvas` native module needs system libs (`libcairo2-dev libjpeg-dev libpango1.0-dev libgif-dev librsvg2-dev`).

### Known issues (pre-existing)
- **Lint**: All three packages have pre-existing prettier formatting errors. ESLint runs but exits non-zero.
- **twenty-front tests**: Jest fails due to linaria `styled` tag not being supported at runtime (missing Babel plugin config for tests).
- **twenty-server typecheck**: Pre-existing TS error in `candidate-sourcing.controller.ts` referencing `graphqlToFindManyJobs` instead of `getGraphqlToFindManyJobs`.
- **twenty-website build**: Fails due to lint errors in Next.js build step. Use `next dev` for development instead.

### Env files
- `packages/twenty-server/.env` — full config with API keys, billing, integrations.
- `packages/twenty-front/.env` — Vite config pointing to localhost:3000 backend.
- `packages/twenty-website/.env` — Next.js config with mixpanel, URLs.
- `packages/twenty-e2e-testing/.env` — Playwright test credentials.
- These are `.gitignore`d and must be recreated from `.env.example` files or provided values.

### Test credentials
- See `packages/twenty-e2e-testing/.env` for login credentials (DEFAULT_LOGIN / DEFAULT_PASSWORD).
