# Assistant

Optional Arxena Twenty app for assistant thread CRM objects used by Ask AI / candidate search sessions and autonomous recruiter heartbeats.

**Not pre-installed.** New and GTM workspaces do not get `assistantThread` on workspace creation — the app stays uninstalled until you install it later via the apps marketplace / `yarn twenty apply`.

Object and field **universal identifiers** are frozen to the values previously hashed under Arxena Standard (`a8e8a8e8-64aa-4b6f-b003-9c74b97cee21`) so install recreates the same GraphQL names (`assistantThreads`, `createAssistantThread`, etc.).

App UID: `d5f94a1b-8c6e-4b29-a7d8-2e3f4a5b6c70`

## Ownership transfer (existing workspaces)

On workspaces that already have legacy `assistantThread` objects under Arxena Standard, run:

`upgrade:2-25:transfer-assistant-application`

That command uses `installIfAlreadyPresent` — it **only transfers** when those legacy objects already exist. It:

1. Creates the Assistant application (if needed)
2. Reassigns `applicationId` on existing metadata **without changing** `universalIdentifier`
3. Syncs Assistant + Arxena Standard manifests

New workspaces without those objects are left alone (app remains uninstalled).

## Host leftovers (this phase)

- Nest `core-modules/assistant/` (REST `/assistant`, MCP, chat stream, iterative query, recruitment agent rules)
- Nest `core-modules/autonomous-recruiter/` (heartbeat queue, demo SSE stream)
- Nest `candidate-search` thin thread adapter + APIs keyed by `assistantThreadId`
- Front JD upload / candidate-search thread state that creates or updates `assistantThread` via workspace GraphQL

```bash
# From this package after installing deps standalone:
yarn twenty remote:add --api-url http://localhost:3000 --as local
yarn twenty apply
```
