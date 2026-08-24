# Shortlist Presentation

Optional Arxena Twenty app for candidate shortlist presentation: shortlist rows, CV Sent batches, screening, AI filters, phone calls, recruiting host-extension fields, and command-menu shortlist actions.

**Not pre-installed.** New and GTM workspaces do not get these objects on workspace creation — the app stays uninstalled until you install it later via the apps marketplace / `yarn twenty apply`.

Object, field, view, nav, and default record-page **universal identifiers** are frozen to the values previously hashed under Arxena Standard (`a8e8a8e8-64aa-4b6f-b003-9c74b97cee21`) so install recreates the same GraphQL names (`shortlists`, `cvSents`, etc.).

App UID: `b7d82c3e-8e4a-4f19-a6c7-0d1e2f3a4b58`

## Ownership transfer (existing workspaces)

On workspaces that already have legacy shortlist / CV Sent / screening / AI filter / phone-call objects under Arxena Standard, run:

`upgrade:2-25:transfer-shortlist-presentation-application`

That command uses `installIfAlreadyPresent` — it **only transfers** when those legacy objects already exist. It:

1. Creates the Shortlist Presentation application (if needed)
2. Reassigns `applicationId` on existing metadata **without changing** `universalIdentifier`
3. Syncs Shortlist Presentation + Arxena Standard manifests

New workspaces without those objects are left alone (app remains uninstalled).

## Host leftovers (this phase)

- Nest `arx-delivery` shortlist endpoints (`create-shortlist`, `chat-based-shortlist-delivery`, `create-shortlist-document`, `download-shortlist-document`)
- Client-side CV zip download (attachments) still lives in `twenty-front`; the app route `download-candidate-cvs` currently proxies to `/arx-delivery/download-shortlist-document` until a dedicated CV zip Nest endpoint exists

```bash
# From this package after installing deps standalone:
yarn twenty remote:add --api-url http://localhost:3000 --as local
yarn twenty apply
```
