# Consolidated credits and billing plan

Status: in progress. Phases 0, 1, 2 and 3 done (reservations deferred). Phase 4 started: email and Bright Data are on `CreditsService`; four candidate-sourcing LLM call sites are on the gateway (JD parser, resume parser, filter description, AI filtering). 22 raw call sites remain.

Phase 0 progress:
- Done: startup config check (`UsageLedgerHealthService`), retry queue for failed usage writes (`UsageEventRetryJob`, exponential backoff, 5 attempts, payload logged on give-up).
- Done (analysis): Razorpay workspaces do get `billingSubscription` rows and a synthetic `RESOURCE_CREDIT` item (`razorpay-webhook.service.ts`, `ensureResourceCreditCap`). Workspaces with no Razorpay subscription (`NO_BILLING_SUBSCRIPTION`) are blocked by `hasAvailableCredits` but not tracked by `decrementAvailableCreditsInCache`; needs checking against real data.
- Decided: fail open. `ClickHouseService.select` swallows errors and returns `[]`, so `getCurrentPeriodCreditsUsed` reads 0 usage during a ClickHouse outage and billable actions keep working. Usage written during the outage is recovered by `UsageEventRetryJob`. Do not change this without revisiting the decision.
- Open: confirm prod values of `BILLING_USAGE_CAP_CLICKHOUSE_ENABLED`, `CLICKHOUSE_URL`, `EVENT_SINKS`.
- Done: characterisation tests for dollar-to-credit conversion, email (1,000 emails = 300,000 micro-credits) and Bright Data (500 records = 1,000,000 micro-credits). AI token cost was already covered by `ai-billing.service.spec.ts`.

Phase 4 progress (LLM call sites):
- Migrated: `jd-parser.service.ts` (feature `JD_PARSE`), `resume-read-parse-upload.service.ts` (`RESUME_PARSE`), `filter-description-processor.service.ts` (`FILTER_DESCRIPTION`), `ai-filtering-processor.service.ts` (`AI_FILTERING`). Each now takes a workspace: from the bearer token via `WorkspaceQueryService.getWorkspaceIdFromToken` where the caller only has a token (JD parser, resume upload job), or passed down by the caller (`workspaceId` on `designColumn`, `designTableView`, `generateSingleFilter`, `parseResumeText`, `readAndParseResumeFile`, `processAiFilters`). Modules that provide these classes import `MeteredLlmModule`; a scan confirmed all four (`candidate-sourcing`, `linkedin-search`, `arx-chat-agent`, `google-sheets`).
- Key source matters. Calls on the platform key are charged. Calls on a workspace's own key (`workspace.openaikey`, required by `ai-filtering.service.ts`) cost the platform nothing, so `MeteringContext.keySource: 'workspace'` records them at zero credits (SYSTEM) and does not refuse models that have no price. This mirrors the existing AI billing, which skips charging when the workspace has its own provider key. Expect many of the remaining `arx-chat` and assistant sites to be workspace-key too; classify each before migrating.
- Not migrated yet, on purpose: `ai-filter-engine.service.ts` has uncommitted work in progress and its own cost estimator (`estimateCostUsd`, web search at $0.025 per call against the gateway's $0.01 constant: pick one). Callers: `workflow-ai-filtering.service.ts`, `bright-data-ludicrous-relevance-judge.service.ts`.
- Unbilled and outside the guard: the Jev judge is customer-selectable as an AI filter model (`isJevModelId` in `ai-filtering-processor.service.ts`) and runs on the platform OpenRouter key through `JevEvaluationService`.
- Applying the instance command is required before the next rebuild: the workspace entity now maps `billing_treatment_overrides`, so workspace queries fail until `core.workspace` has the column.

Phase 3 progress:
- `MeteredLlmService` (`core-modules/metered-llm`): `openAiChatCompletion`, `openAiChatCompletionStream`, `openAiResponse`, `openAiTranscription`, `anthropicMessage`, `anthropicMessageStream`. Each one refuses an unpriced model before calling the provider, checks credits, makes the call, and records usage through `CreditsService`. A failure to record is logged with a replayable payload, never thrown. Pricing comes from `ai-providers.json` via the model registry; a model registered with zero prices counts as unpriced (the registry would otherwise bill it at $0). Whisper-style per-minute prices live in `transcription-cost-per-minute.const.ts` and should be checked against OpenAI's current pricing.
- New operation types `AI_BACKGROUND_TOKEN` and `AI_TRANSCRIPTION`, with generic features `AI_BACKGROUND` and `AI_TRANSCRIPTION`. Split `AI_BACKGROUND` into per-feature entries (resume parse, JD parse, and so on) as call sites migrate, so each can have its own treatment. `twenty-front` usage views (`AiOperationTypes.ts`, `getOperationTypeLabel.ts`) do not list the new types yet.
- Guard test `metered-llm-call-site-guard.spec.ts` fails if a file outside `UNMETERED_LLM_CALL_SITES` calls a provider directly, or if a listed file no longer does. 26 files are on the list; migrating a file means deleting its line. The scanner covers OpenAI chat/responses/transcription and Anthropic message calls. It does not see the `llm-chat-model` OpenAI driver, the OpenRouter Jev judge, or the ChatKit session call in `candidate-sourcing.controller.ts`.
- Known unpriced model to fix when migrating: `CLAUDE_MODEL = 'claude-sonnet-4-20250514'` in the MCP assistant is not in `ai-providers.json`. `'gpt4omini'` (3 sites) is not a valid model name.
- Streaming: `openAiChatCompletionStream` returns an async generator, not the SDK `Stream`, so call sites that use `.controller` or `.toReadableStream()` need adjusting.

Phase 2 progress:
- Feature policy registry: `billing/constants/billing-feature-policy.constant.ts` (`BILLING_FEATURE_POLICIES`, `BillingFeature`). `CreditsService.record` now takes a `feature` and resolves resource type, operation type, unit, margin and treatment from it.
- Margins kept as they were: email 3x, everything else 1.0. Workflow steps are already charged a flat 100 micro-credits per executed step.
- No ClickHouse schema change: `feature`, `billingTreatment` and `providerCostMicro` are written into the existing `metadata` JSON column, and `operationType` identifies the feature (one operation type per feature). Add real columns later only if a usage query needs to filter on them.
- Coverage test fails if any `UsageOperationType` has no policy.
- Per-workspace treatment overrides: JSONB column `core.workspace.billing_treatment_overrides` (instance command 1785600000180), e.g. `{ "AI_CHAT": "SYSTEM" }`. Read by `BillingTreatmentOverrideService` (60s in-process cache, falls back to the feature default if the lookup fails), set through the admin mutation `adminSetBillingTreatmentOverride` (logs the acting admin). Precedence: explicit `treatment` argument, then workspace override, then feature default. Feature flags could not carry this (booleans only, keys validated against a fixed enum). The admin UI for it is not built, and `twenty-front/src/generated-admin` needs regenerating for the new mutation.
- Instance command id 1785600000180 was chosen to leave room above the uncommitted workspace commands 165-171; renumber if it collides.

Phase 1 progress:
- `CreditsService` (`billing/services/credits.service.ts`) with `record` and `assertCanSpend`, and the `BillingTreatment` type. Non-customer treatments record at zero credits so they never count against the balance; real cost goes in event metadata (`providerCostUsd`, `billingTreatment`).
- Deferred: the atomic Redis reserve. It is only needed for open-ended jobs and will be added with the first one.
- Email keeps its existing 3x margin (`EMAIL_MARGIN_MULTIPLIER`) so prices do not silently change. Bright Data stays at 1.0.
- Still on the old path: AI billing (`ai-billing.service.ts`, entangled with provider bypass), workflow runs.
- Known pre-existing noise: repo-wide `tsc` reports about 1,000 errors and `oxlint` reports errors in `billing.resolver.ts` and `razorpay-webhook.service.ts`; none are in files changed here. `tsc` needs `NODE_OPTIONS=--max-old-space-size=12288`.

## Decisions

- ClickHouse outage: fail open (billable actions keep working; no blocking on an unreadable balance).
- One universal credit: dollars x 1,000,000 = micro-credits (`DOLLAR_TO_CREDIT_MULTIPLIER`).
- ClickHouse `usageEvent` stays the usage ledger. `billingCustomer.creditBalanceMicro` stays the grant balance. No new tables.
- Every LLM call goes through one metered gateway.
- All categories are billable (AI, transcription, reveals, phone/WhatsApp connections, workflow runs, third-party data).
- Each feature has a billing treatment: `CUSTOMER | SYSTEM | INTERNAL | OFF`, overridable per workspace through the feature-flag system.
- All margins are 1.0. Per-feature margin stays supported in the registry.
- Hard stop when credits run out. No overage.
- Razorpay is the only payment provider.
- No admin cost view. The existing admin credits panel is the manual tool.
- Admin adjustments: dollars by default, required reason, permanent grants, no second-admin approval.
- LinkedIn and WhatsApp: $5 per connected account per month, charged for the full month on connect, no proration, no refund. Renewal on each account's own 30-day anniversary. Account suspended when a renewal cannot be paid. No per-action charge (actions are `SYSTEM`).
- Reveal, org-chart and API-search credits merge into the universal credit.

## Phases

### Phase 0: verify and harden what exists
1. Confirm prod config: `BILLING_USAGE_CAP_CLICKHOUSE_ENABLED=true`, `CLICKHOUSE_URL` set, event logging on. Startup check that fails loudly if billing is on and the event sink is off.
2. Trace how Razorpay-only workspaces are handled. `decrementAvailableCreditsInCache` returns 0 with no Stripe subscription and `getAvailableCreditsFromClickHouse` throws without one.
3. Retry queue (BullMQ) around `UsageEventListener` dispatch for billable events. A failed ClickHouse write is currently logged and lost.
4. Characterisation tests for current cost-to-credit numbers.

### Phase 1: `CreditsService`
`assertCanSpend` (atomic Redis reserve, hard stop) and `record` (convert, decrement, emit `USAGE_RECORDED`). Replaces the repeated sequence in email, Bright Data and AI billing. Only `CUSTOMER` treatment decrements the balance; every treatment emits an event with the real provider cost.

### Phase 2: feature policy registry
`FEATURE_BILLING_POLICY[feature]` = treatment, resourceType, unit, marginMultiplier (1.0), estimator. Extend `UsageEvent` and the ClickHouse table with `feature`, `billingTreatment`, `providerCostMicro`. Test fails if any `UsageOperationType` has no policy.

### Phase 3: metered LLM gateway
`MeteredLlmService` (generateText, generateObject, streamText, embed, transcribe) with adapters for raw `openai` and `@anthropic-ai/sdk`. Unknown model price throws. Lint rule bans `new OpenAI(` / `new Anthropic(` outside the gateway.

### Phase 4: migrate call sites
1. Already-billed features onto `CreditsService`, shadow mode first.
2. Unbilled LLM calls: candidate-sourcing (JD parser, filter processor, AI filter engine, resume parse), org-chart (news, ICP), LinkedIn (query generation, xray), search-models, arx-chat, MCP assistant, candidate-search token tracking. Jev judge is `INTERNAL`.
3. Video-interview transcription.
4. Workflow runs (check what `WORKFLOW_EXECUTION` charges today first).
5. LinkedIn/WhatsApp connection fees and suspension (`metadata.unipile_accounts`).
6. Pool merge (Phase 4b).

### Phase 4b: merge reveal, org-chart and API credits
- Reveal (email 1, phone 5), org chart (1 per chart) and API search (1 per search) become registry features priced in dollars.
- One-time migration of `workspaceCredits` balances into `creditBalanceMicro` with a dry-run report first. Conversion rates live in one config file.
- `workspaceCredits` stays read-only for one release, then is dropped.
- Razorpay fulfilment writes only micro-credits.
- Free signup grants collapse into one grant of universal credits.

### Phase 5: Razorpay
Fulfilment grants to `creditBalanceMicro` with existing idempotency keys, then triggers connection reactivation. Low-balance and zero-balance notifications. INR/USD display via `pricing-currency.service.ts`.

### Phase 5b: admin credit adjustment
Extend `adminAdjustWorkspaceCredits` and `SettingsAdminWorkspaceCredits.tsx`: dollars, grant or deduct, required reason, audit row with actor and before/after balance, `ADMIN_ADJUSTMENT` usage event, fail loudly when nothing changed, fix the negative-`ai` no-op and the AI ledger unit mismatch, reactivate overdue connections.

### Phase 6: usage UI
Rebuild `SettingsUsage.tsx`: balance, burn rate, stacked chart by category (AI, Email, Reveals, Data, Workflows, Voice, Connections), Connections section, per-user drilldown, zero-balance banner with "Buy credits".

### Phase 7: rollout
Shadow mode, then enforcement per workspace behind a flag. Review the pool-merge dry run before migrating. Nightly reconciliation against provider usage exports.

## Open items

1. Dollar value per credit for reveal and API search (for balance conversion and pricing).
2. Whether org-chart creation costs anything in universal credits.
3. Free signup grant amount in universal credits.
4. What `WORKFLOW_EXECUTION` charges today.

## Risks

1. Razorpay-only workspaces may have no enforced cap today.
2. Pool conversion changes customer balances.
3. Open-ended jobs (agent loops, batch sourcing) need an estimator or per-step reservation.
4. Redis reserve limits overshoot but does not eliminate it.
5. Missing model prices must fail loudly before enforcement.
6. Unipile per-call costs are not captured (assumes the $5 is the whole cost).
