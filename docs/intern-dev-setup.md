# Local dev setup for 8GB MacBook Air

Target: run server + worker + front and use Cursor on an 8GB Air without swapping to death.

## 1. Services: native, not Docker

```bash
brew install postgresql@16 redis
brew services start postgresql@16
brew services start redis
bash packages/twenty-utils/setup-dev-env.sh   # auto-detects local services
```

- Do not install/run Docker Desktop (reserves 2-4GB).
- Keep `ANALYTICS_ENABLED=false` and leave `CLICKHOUSE_URL` unset (no ClickHouse).

## 2. Running the stack (three separate terminals)

```bash
export NODE_OPTIONS="--max-old-space-size=1536"   # use 2048 for the front
npx nx build twenty-shared                         # once
npx nx start twenty-server
npx nx run twenty-server:worker                    # only when testing outreach/queues
npx nx start twenty-front
```

Do not use `yarn start` (starts everything at once, hard to stop pieces).
Do not run `lint`, `typecheck` or full test suites while the servers are up.
Use `npx nx lint:diff-with-main <project>` and single-file jest runs.

## 3. Cursor setup

One Cursor window only. Close other editors (VS Code), and keep one Chrome tab for the app.

### Do NOT use these repo helpers

- **`.cursor/worktrees.json`** runs a full `yarn` install per worktree (about 4.5GB each). Do not use
  Cursor parallel agents / worktrees on this machine.
- **`.cursor/environment.json`** (background/cloud agents) runs `database:reset`, which wipes the DB.
  Do not use it locally.

### User settings (Cursor > Settings > Open User Settings JSON)

```json
{
  "typescript.tsserver.maxTsServerMemory": 2048,
  "typescript.disableAutomaticTypeAcquisition": true,
  "typescript.tsserver.experimental.enableProjectDiagnostics": false,
  "files.watcherExclude": {
    "**/node_modules/**": true,
    "**/.nx/**": true,
    "**/.yarn/**": true,
    "**/dist/**": true,
    "**/.cache/**": true,
    "**/storybook-static/**": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/.nx": true,
    "**/.yarn": true,
    "**/dist": true
  },
  "extensions.autoUpdate": false,
  "git.autorefresh": false,
  "telemetry.telemetryLevel": "off"
}
```

### Extensions

Install only: Oxc (`oxc.oxc-vscode`), Prettier, GraphQL syntax, Jest Runner.
Skip the rest of `.vscode/extensions.json` on 8GB (Figma, Nx Console, Remote Containers,
MDX preview, Playwright).

### Indexing

- `.cursorignore` at the repo root keeps heavy and generated folders out of the codebase index.
- If Cursor still feels slow: Settings > Indexing & Docs > pause indexing while running builds.
- Open the repo root folder, not `.vscode/twenty.code-workspace` (multi-root loads more).

## 4. When it gets slow

1. Activity Monitor > Memory: quit the biggest non-essential app.
2. Stop the worker first, then the front.
3. In Cursor: Cmd+Shift+P > "TypeScript: Restart TS Server".
4. Keep at least 15-20GB of disk free.
