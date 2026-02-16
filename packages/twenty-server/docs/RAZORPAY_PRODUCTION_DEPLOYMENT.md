# Razorpay + Billing: Production Deployment & Migration

This guide covers deploying the Razorpay billing changes to production **without breaking existing users** (Stripe-only or no billing).

---

## 1. Why existing users don’t break

- **Database**
  - New table `core.workspaceCredits` is created with `CREATE TABLE IF NOT EXISTS`; no data is deleted.
  - New columns are **nullable** or have **defaults**: `paymentProvider` defaults to `'stripe'`, `razorpayCustomerId`, `razorpaySubscriptionId`, `razorpayPlanId` are nullable. Existing rows keep their current values.
  - `stripeCustomerId` / `stripeSubscriptionId` are relaxed to nullable so Razorpay-only workspaces can have NULL there; existing Stripe rows already have values.

- **Application**
  - **Credits:** `workspaceCredits` query returns `{ credits: row?.credits ?? 0 }`. If a workspace has no `workspaceCredits` row (e.g. existing users), it gets `0` and does not error.
  - **Plan name:** `planName` is resolved only for Razorpay subscriptions; for Stripe or no subscription it stays `null` and the UI already handles it.
  - **Razorpay:** All Razorpay code paths use env vars (`BILLING_RAZORPAY_KEY_ID`, etc.). If those are unset, Razorpay features are not used; Stripe and the rest of the app keep working.

So: **run the migration, then deploy. Existing users continue to work.** Turn on Razorpay when ready by setting the Razorpay env vars.

---

## 2. Migrate the database

Migrations must run **before** (or as part of) deploying the new app version. Billing migrations are loaded only when `IS_BILLING_ENABLED=true`.

### Option A: You already use billing in production (Stripe)

1. Ensure `IS_BILLING_ENABLED=true` in the environment used to run migrations (see below).
2. Build the server so migrations are in `dist` (from repo root):
   ```bash
   npx nx run twenty-server:build
   ```
3. Run migrations (metadata first, then core). Core will run pending billing migrations, including the Razorpay/workspaceCredits one:
   ```bash
   # From repo root, with production DB URL and IS_BILLING_ENABLED=true
   export PG_DATABASE_URL="postgresql://..."   # your production DB
   export IS_BILLING_ENABLED=true

   npx -y typeorm migration:run -d dist/src/database/typeorm/metadata/metadata.datasource.js
   npx -y typeorm migration:run -d dist/src/database/typeorm/core/core.datasource.js
   ```
   Or use the package script:
   ```bash
   cd packages/twenty-server
   IS_BILLING_ENABLED=true database:migrate:prod
   ```
   (Use whatever your project uses for production DB URL, e.g. `.env.production` or secrets.)

   **If you see "No migrations are pending"** without having run with `IS_BILLING_ENABLED=true` before: the core datasource only loads billing migrations when that env var is set. Run again with `IS_BILLING_ENABLED=true` so the Razorpay/workspaceCredits migration is loaded and applied. If you already ran with the flag and still see no pending, you're done.

4. Deploy the new app. No need to set Razorpay env vars yet; existing Stripe billing keeps working.

### Option B: Billing was disabled in production (`IS_BILLING_ENABLED=false`)

If billing was off, the **core** datasource normally does not load billing migrations, so the Razorpay migration would never run. To add Razorpay (and workspaceCredits) for a future billing rollout:

1. Set `IS_BILLING_ENABLED=true` for the **migration run** (and for app runtime once you enable billing).
2. Build, then run migrations as in Option A. That will create `workspaceCredits` and add Razorpay-related columns.
3. Deploy. Until you set Razorpay env vars and use Razorpay flows, behavior for existing users is unchanged (no billing UI/APIs or they keep returning empty/zeros).

### Checklist

- [ ] Backup production DB (or run migrations on a copy first).
- [ ] `IS_BILLING_ENABLED=true` when running migrations so core loads billing migrations.
- [ ] Run metadata migrations first, then core.
- [ ] Confirm no migration errors; then deploy the new server build.

### Troubleshooting: "No migrations are pending" but `workspaceCredits` is missing

If you see "No migrations are pending" with `IS_BILLING_ENABLED=true` but the table `core.workspaceCredits` does not exist (check with the SQL below), the **billing migration files are likely not in `dist`** on the server (e.g. build didn’t emit them or an old `dist` was deployed).

1. **On the server, check whether billing migrations are in `dist`:**
   ```bash
   ls dist/src/database/typeorm/core/migrations/billing/
   ```
   You should see at least `1739700000000-add-razorpay-and-workspace-credits.js` (or the compiled Razorpay migration). If the directory is missing or empty, the build did not include migrations.

2. **Fix: rebuild and redeploy**
   - From the **repo root** (`~/twenty`), run the server build so migrations are compiled into `dist`:
     ```bash
     npx nx run twenty-server:build
     ```
     (There is no top-level `yarn build`; use the `nx` command above.) The project build compiles migration files into `dist` explicitly.
   - Deploy the **new** `dist` to the server (replace the existing one).
   - On the server, run migrations again with the same DB URL and billing flag:
     ```bash
     cd packages/twenty-server
     set -a && source .env && set +a   # load PG_DATABASE_URL etc.
     IS_BILLING_ENABLED=true npx -y typeorm migration:run -d dist/src/database/typeorm/core/core.datasource
     ```

3. **Confirm the table exists:**
   ```bash
   psql "$PG_DATABASE_URL" -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'core' AND table_name = 'workspaceCredits');"
   ```
   Result should be `t`.

---

## 3. What the Razorpay migration does

- Creates `core.workspaceCredits` (id, createdAt, updatedAt, workspaceId, credits) with a unique constraint on `workspaceId`.
- On `core.billingCustomer`: adds `paymentProvider` (default `'stripe'`), `razorpayCustomerId` (nullable); makes `stripeCustomerId` nullable and re-creates the unique constraint (so Razorpay-only customers can have NULL `stripeCustomerId`).
- On `core.billingEntitlement`: drops and re-adds the FK to `billingCustomer(stripeCustomerId)` so it works with nullable `stripeCustomerId`.
- On `core.billingSubscription`: adds `razorpaySubscriptionId` (nullable), unique partial index where not null; makes `stripeCustomerId` and `stripeSubscriptionId` nullable.
- On `core.billingPrice`: adds `razorpayPlanId` (nullable).

Existing rows get defaults or NULL; no backfill is required for existing users.

---

## 4. Enabling Razorpay on production

When you are ready to use Razorpay:

1. **Razorpay dashboard**
   - Create a production Razorpay account/app, get API keys and configure webhooks (subscription + payment events) to your production URL.

2. **Environment variables** (example; names may match your codebase):
   - `BILLING_RAZORPAY_KEY_ID`
   - `BILLING_RAZORPAY_KEY_SECRET`
   - `BILLING_RAZORPAY_WEBHOOK_SECRET`
   - Optional: `BILLING_RAZORPAY_BASE_PLAN_ID`, plan IDs in DB for engagement/credit packs, etc.

3. **Sync plans (if you use DB-backed plans)**  
   Run your sync command so `billingPrice` rows have `razorpayPlanId` set (e.g. `BillingSyncPlansDataCommand` or equivalent), then use those plans for subscriptions/checkout.

4. **Existing users**
   - Stay on Stripe as-is (`paymentProvider='stripe'`, existing subscriptions unchanged).
   - New signups or migrations can use Razorpay; credits and plan name work as implemented (including `planName` for Razorpay subscriptions, 0 credits when no `workspaceCredits` row).

---

## 5. Rollback

If you need to roll back the app but already ran the migration:

- Reverting the **code** is safe: old code does not use `workspaceCredits` or Razorpay columns; Stripe paths are unchanged.
- **DB rollback:** The migration’s `down()` drops the new columns and table. Only run `migration:revert` if you understand the impact and have a backup; prefer fixing forward with a new migration if possible.

---

## 6. Summary

| Step | Action |
|------|--------|
| 1 | Backup DB (or test on a copy). |
| 2 | Set `IS_BILLING_ENABLED=true` and run core migrations so billing (and Razorpay) migrations run. |
| 3 | Deploy new server. Existing users: no change; credits = 0 when no row; planName = null for Stripe. |
| 4 | When ready: set Razorpay env vars and webhooks, sync plans, then use Razorpay for new flows. |

No separate “migrate existing users” step is required; the design keeps existing behavior and only adds optional Razorpay and credits on top.
