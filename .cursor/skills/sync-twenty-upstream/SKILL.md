---
name: sync-twenty-upstream
description: >-
  Sync TwentyHQ upstream into the Arxena fork mirror and merge it into the
  working port branch, then resolve conflicts. Use when the user asks to sync
  upstream, update from twentyhq/twenty, refresh upstream/core, merge
  origin/main into port/arxena-modules, or incorporate Twenty changes into the
  port branch.
---

# Sync Twenty upstream → port branch

## Branch topology

| Ref | Role |
| --- | --- |
| `twentyhq/twenty` `main` | True upstream (GitHub parent of the fork) |
| `origin/main` (`arnavsaxena17/arxena`) | Fork of Twenty; sync this from parent first |
| `upstream/core` | Local **mirror bookmark** of last-synced Twenty tip (= `origin/main` after sync). Do not commit ARX work here |
| `port/arxena-modules` | Working ARX port branch (current default). Merges in `origin/main` |

```
twentyhq/twenty main  ──sync fork──►  origin/main
                                         │
                                         ├─ reset --hard ──► upstream/core (bookmark)
                                         │
                                         └─ merge ──► port/arxena-modules (+ ARX commits)
```

Do **not** merge `workflows` into `main`/`port` as a history sync. `workflows` is a feature source only.

## When to run

- After Sync fork on GitHub (or when fork is behind `twentyhq/twenty`)
- User says: sync upstream, pull Twenty into port, refresh `upstream/core`

## Preconditions

1. Working tree clean on `port/arxena-modules` (stash or commit first).
2. Confirm lag before changing anything:

```bash
git fetch origin
gh api repos/arnavsaxena17/arxena/compare/twentyhq:main...main \
  --jq '{status, ahead_by, behind_by}'
git rev-list --left-right --count port/arxena-modules...origin/main
```

If `behind_by > 0` on the fork compare, sync the fork **before** merging into port.

## Procedure (merge, not rebase)

Prefer **merge**. Port history is messy and overlaps hundreds of files; rebase replays the same conflicts.

### 1. Sync the GitHub fork to Twenty

```bash
# Prefer GitHub "Sync fork" UI, or:
gh api -X POST repos/arnavsaxena17/arxena/merge-upstream \
  -f branch=main
git fetch origin
```

Verify `origin/main` moved (or already matches twentyhq tip).

### 2. Refresh the mirror bookmark

```bash
git checkout upstream/core
git reset --hard origin/main
```

Only push `upstream/core` if it is tracked remotely and the user asks.

### 3. Merge Twenty into the port branch

```bash
git checkout port/arxena-modules
git merge origin/main
```

If the user named a different working branch, use that instead of `port/arxena-modules`.

### 4. Resolve conflicts (order matters)

List conflicts, then split generated vs real source:

```bash
git diff --name-only --diff-filter=U
git diff --name-only --diff-filter=U \
  | rg -v 'locales/|generated/|yarn\.lock|\.po$|\.lock$'
```

| Conflict class | Resolution |
| --- | --- |
| Generated GraphQL, locales, `.po`, most lockfiles | Take **upstream** (`-X theirs` / checkout `--theirs`), then regenerate |
| `package.json` (front/server/root) | Keep **ARX deps** (e.g. handsontable, `@hello-pangea/dnd`, ARX workspace pkgs) + accept new upstream deps/scripts |
| Upgrade / workspace commands (`upgrade-version-command/`) | Keep **both**: ARX commands + new upstream version modules; register both in constants/modules |
| §9 upstream core wires (see migration track) | Keep **ARX wiring** re-applied on Twenty’s new code (`AppPath`, providers, Nest `core-engine`, settings nav, routes, billing hooks) |
| Pure ARX modules under `core-modules/`, `twenty-orgchart*`, etc. | Keep **ours** |
| Website / companion deleted on port | Prefer upstream restore unless intentional ARX deletion |

§9 checklist: [`docs/port-front-migration-track.md`](../../../docs/port-front-migration-track.md)
Sibling patterns: [`.cursor/rules/port-workflows-catalog.mdc`](../../rules/port-workflows-catalog.mdc)

After package.json resolution:

```bash
yarn install   # Node ^24.5.0
```

### 5. Finish merge + verify bookmark

```bash
git add -A
git commit   # only if merge did not auto-commit; message like prior:
# Merge origin/main into port/arxena-modules
# Bring in Twenty upstream after fork sync; keep ARX deps, upgrade commands, and wiring.

git checkout upstream/core && git reset --hard origin/main
git checkout port/arxena-modules
```

Confirm:

```bash
git merge-base --is-ancestor origin/main port/arxena-modules && echo 'origin/main ⊆ port'
git rev-parse upstream/core origin/main   # must match
```

### 6. Post-merge gates (do not skip silently)

- `npx nx build twenty-shared` then typecheck/lint diff for front + server
- Regenerate GraphQL if schema changed: `npx nx run twenty-front:graphql:generate` (+ metadata config if needed)
- Note new upgrade commands; plan `database:migrate` / workspace upgrades when deploying
- Update migration track §0 work log + refresh §9 if core files shifted
- Push only when user asks: `git push origin port/arxena-modules` (and `upstream/core` if tracked)

## Anti-patterns

- Do **not** rebase `port/arxena-modules` onto `origin/main` for routine sync
- Do **not** commit ARX features onto `upstream/core` or `origin/main`
- Do **not** merge `workflows` history into port to “catch up”
- Do **not** reset `port/arxena-modules` hard to `origin/main` (drops ARX commits)
- Do **not** leave `upstream/core` stale after a successful merge (always reset to `origin/main`)

## Quick status snippet

```bash
echo "fork vs twentyhq:"; gh api repos/arnavsaxena17/arxena/compare/twentyhq:main...main --jq '{status, behind_by, ahead_by}'
echo "port vs origin/main:"; git fetch origin >/dev/null; git rev-list --left-right --count port/arxena-modules...origin/main
echo "upstream/core == origin/main?"; test "$(git rev-parse upstream/core)" = "$(git rev-parse origin/main)" && echo yes || echo NO
```
