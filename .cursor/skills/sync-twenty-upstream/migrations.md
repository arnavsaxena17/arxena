# Schema and upgrade commands during an upstream sync

Twenty no longer adds TypeORM files. Schema and data changes ship as **instance commands** (core DB) and **workspace commands** (per-workspace CRM metadata). Full authoring guide: `packages/twenty-server/docs/UPGRADE_COMMANDS.md`. Frozen TypeORM dir: `packages/twenty-server/src/database/typeorm/core/legacy-typeorm-migrations-do-not-add/`.

## Two layers

| Layer | What it is | Where | How it runs |
| --- | --- | --- | --- |
| Core / instance | Tables/columns on `core` (workspace credits, Unipile, Razorpay, website tracking, …) | `upgrade-version-command/<ver>/…-instance-command-{fast,slow}-<ts>-*.ts` registered in `instance-commands.constant.ts` | `npx nx run twenty-server:database:migrate` (`--include-slow` when needed) |
| Workspace CRM | Standard objects/fields/skills/command-menu items | `…-workspace-command-<ts>-*.ts` + version `*UpgradeVersionCommandModule`; ARX objects also in `arxena-standard-metadata` | `npx nx run twenty-server:command -- upgrade` (and `workspace:sync-arxena-standard` when only ARX standard defs changed) |
| ClickHouse | Analytics (pageviews) | `src/database/clickHouse/migrations/` | Separate from Postgres upgrade; do not fold into instance commands |

Do **not** add files under the legacy TypeORM migrations folder.

## ARX namespace

ARX instance + workspace timestamps use **`1785600000xxx`** (credits `0001` … website tracker `0020`/`0021`, HITL skill `0022`, …). Twenty uses other timestamps in the same version folder.

On merge:

- Keep **every** `1785600000*` file and its import/registration.
- Keep **every** new Twenty command file and its import/registration.
- Never reuse or rewrite a timestamp that already ran in prod. The upgrade runner keys off version + timestamp.

## Conflict playbook for upgrade trees

### `instance-commands.constant.ts`

Union both sides: all Twenty imports/array entries **and** all ARX `1785600000*` imports/array entries. Do not take one side of the file. Twenty’s generator says “do not edit manually”; ARX already appends here — after sync, re-append any ARX imports that the merge dropped.

### Version modules (`2-25-upgrade-version-command.module.ts`, later `2-26-…`)

Keep ARX providers (indexes, CMI backfills, GTM skill syncs, website-tracker standard objects, …) **and** new Twenty workspace command providers. If Twenty adds a new version folder, leave already-shipped ARX commands in the folder they were registered for (`2-25` today). New ARX schema after a Twenty version bump goes in the **current** Twenty version folder.

### Same command file edited on both sides

Rare. Combine: take Twenty’s new SQL/logic, then re-apply any ARX-only `ALTER` / backfill that still belongs. Prefer a **new** ARX timestamped command over editing a Twenty command that may already have run on other forks.

### Entity / metadata conflicts (`workspace.entity.ts`, billing entities, standard-object defs)

Start from **upstream** entity (new columns, decorators, upgrade hooks), then re-add ARX columns/relations. Pair every new ARX column with an instance command that `ADD COLUMN IF NOT EXISTS` (or equivalent) so existing DBs catch up. CRM object/field changes belong in `arxena-standard-metadata` plus a workspace command that runs `workspace:sync-arxena-standard` (or the validate-build-run matrix) for existing workspaces.

## After the git merge (local / staging first)

Never run prod migrate until the merge is committed, pushed, and the user asked to deploy.

1. List new commands vs pre-merge `origin/main`:

```bash
git diff origin/main...HEAD --name-only -- \
  packages/twenty-server/src/database/commands/upgrade-version-command/
```

2. Confirm ARX `1785600000*` files still exist and are still listed in `instance-commands.constant.ts` and the version Nest module.
3. On a **staging** DB that matches prod shape: `npx nx run twenty-server:database:migrate` then `npx nx run twenty-server:command -- upgrade` (add `--dry-run` first if unsure). Use `--include-slow` only when the release notes / new slow commands require it.
4. If only ARX standard object defs changed (no new command): `workspace:sync-arxena-standard` on affected workspaces.
5. If GraphQL/workspace metadata changed: regenerate front GraphQL after migrate/upgrade.

## Cadence for schema specifically

- Ship ARX schema as its own instance/workspace command **on the port branch** as you build features. Do not wait for an upstream sync.
- During sync, you are only **preserving** those commands and **adding** Twenty’s new ones, then running them once on each environment.
- If Twenty’s current version folder moves (e.g. `2-25` → `2-26`), do not relocate old ARX commands that already ran. Register new work against the new current version.

## Failure modes

| Symptom | Likely cause |
| --- | --- |
| Missing ARX column after sync | Took `--theirs` on `instance-commands.constant.ts` or dropped a `1785600000*` file |
| Duplicate column / “already exists” | Command not idempotent; add `IF NOT EXISTS` / guard, do not change timestamp |
| CRM object missing field in old workspaces | Standard def updated but no workspace command / sync ran |
| Boot error `unknown-step-name` | Upgrade decorator points at a command not in the active version sequence — see UPGRADE_COMMANDS.md deferred-version caveat |
