# Port front migration track (`workflows` → current)

Living checklist of **import remaps**, **Apollo client rules**, **Job→Project renames**, **upstream core file touches**, and **runtime GraphQL bugs** found while adapting ARX front modules onto current Twenty (`port/arxena-modules` / `upstream/core`).

Companion docs:

- Module port inventory: [`docs/port-workflows-inventory.md`](./port-workflows-inventory.md)
- Mechanical Recoil→Jotai + UI remaps: [`.cursor/skills/recoil-to-jotai-migration/SKILL.md`](../.cursor/skills/recoil-to-jotai-migration/SKILL.md)
- Attachment FILES-field + `target*Id` remaps: [`.cursor/skills/attachment-files-field-migration/SKILL.md`](../.cursor/skills/attachment-files-field-migration/SKILL.md)
- CRM rename script: [`packages/twenty-utils/rename-crm-job-to-project.mjs`](../packages/twenty-utils/rename-crm-job-to-project.mjs)

Update this file whenever a new broken pattern is discovered or fixed.

**Base ref for “upstream core”:** `upstream/core` (merge-base with `port/arxena-modules`). Refresh the [§9 catalog](#9-upstream-core-files-altered) with:

```bash
git diff --diff-filter=M --name-only upstream/core...HEAD
git diff --name-only  # unstaged intentional wiring
```

---

## 0. Recent agent work log (from git diffs)

High-level waves already reflected in the working tree (unstaged + port commits). Use this as a changelog when grepping for leftovers.

| Wave | What landed | Where to look |
| --- | --- | --- |
| Recoil→Jotai setter call-site renames | Fixed ReferenceErrors where Jotai setters were declared with longer names but call sites/deps still used old Recoil-era names (`setJobs`→`setProjects`, `setTableState`→`setTableStateAtom`, `setMain*`→`setContextStore*`, etc.) | ARX modules under `candidate-table`, `arx-ai-filtering`, `arx-jd-upload`, `gtm-home`, `orgchart`, `unipile`; see §2 |
| Website visitor tracking | Apollo-like inbound: `websiteTrackingAppId` on `core.workspace`; CRM `websiteDomain` + `websiteVisitor`; ClickHouse `website_pageview`; public collect + Settings → Accounts → Website (snippet, domains, visitors feed); `website-tracker.js` on marketing site | `website-tracker/*`, `SettingsAccountsWebsite.tsx`, `SettingsPath.AccountsWebsite`, `2-25-*-1785600000020/0021-*`, `docs/website-visitor-tracking.md` |
| Org chart embed settings + Mintlify docs | Ported embed settings UI from `workflows` into MCP & APIs (**Org chart** tab); adapted Recoil→Jotai, Emotion→Linaria, snackbars, `SettingsPageLayout`. Added Mintlify page `/developers/extend/org-chart-embed`. | `SettingsApiWebhooks.tsx`, `SettingsOrgChartEmbed*`, `SettingsDevelopersOrgChartEmbed*`, `SettingsRoutes.tsx`, `twenty-docs/.../org-chart-embed.mdx` |
| Rename `gtmWorkspaceProfile` → `workspaceProfile` | CRM object renamed (labels + nameSingular/plural). Pinned Arxena object UID to pre-rename hash so sync updates in place + renames workspace table. Workspace cmd `1785600000018` runs Arxena sync + refreshes `gtm-icp-onboarding` tool names. | `objects-data.ts`, `workspace-profile-fields.data.ts`, `build-arxena-standard-manifest.util.ts`, `gtm-home/*`, `gtm-icp-onboarding.md`, `2-25-workspace-command-1785600000018-*` |
| GTM company enrich web_search | Company bootstrap enrichment now runs a native `web_search` model tool (OpenAI/Anthropic/xAI) to fetch website content, then feeds it into the multi-source profile summarizer. | `gtm-web-search-company-enrichment.source.ts`, `gtm-company-enrichment-collector.service.ts`, `gtm-company-profile-summarizer.*`, `gtm-command.module.ts` |
| GTM Setup scoped regenerate + icpBlurb | ICP / company blurb / people blurb are separate Ask AI SEND turns (ICP no longer refreshes search blurbs). New `icpBlurb` TEXT on `workspaceProfile` + Project; Setup shows Blurb + JSON. Skill sync cmd `1785600000017`. Run `workspace:sync-arxena-standard` for the field. | `gtm-icp-onboarding.md`, `gtm-home.types.ts`, `GtmSetupPanel.tsx`, `workspace-profile-fields.data.ts`, `2-25-workspace-command-1785600000017-*` |
| GTM outreach prompt + seed field fix | Agent hung editing Stage B because seed SEND steps read Candidate `linkedinLink` (field is `linkedinUrl`). Added clone/edit/enroll guidance to `workflow-building` + GTM browsing/system prompts; sync cmd `1785600000015`. Seed templates now use `linkedinUrl.primaryLinkUrl`. | `workflow-building.md`, `chat-system-prompts.const.ts`, `chat-execution.service.ts`, `setup-gtm-outreach-workflow.ts`, `2-25-workspace-command-1785600000015-*` |
| Harden `execute_tool` arg coerce | Zod `expected record, received undefined` when models flatten nested tool fields, alias `parameters`/`args`/`input`, or stringify the whole payload — caused LinkedIn/people parse retry loops. Coerce now lifts flattened fields, aliases, double-strings; defaults missing args to `{}`. Also drop stale `setSelectedSegmentId` after Market map removal. | `coerce-execute-tool-arguments.util.ts`, `useGtmLiveWorkingSet.ts` |
| GTM Ask AI ephemeral people upsert | New action tool `upsert_gtm_target_people` writes Redis People tab; People UI polls Redis + merges CRM Candidates; prompts/skills forbid `create_candidate` until Add to CRM / Enroll. Skill sync cmd `1785600000014`. | `upsert-gtm-target-people-tool.ts`, `gtm-people-cache.service.ts`, `useGtmLiveWorkingSet.ts`, `search-people.md`, `linkedin-search.md`, `chat-execution.service.ts` |
| Fix `upsert_gtm_target_companies` runtime | Tool crashed with `isNonEmptyString is not a function` because it imported from `twenty-shared/utils` (not exported). Switch to `@sniptt/guards` like other action tools. Verified via Ask AI retry → Redis Companies tab. | `upsert-gtm-target-companies-tool.ts` |
| GTM Ask AI ephemeral company upsert | New action tool `upsert_gtm_target_companies` writes Redis Companies tab; GTM browsing context on every `/gtm-home` chat turn; `search-companies` / `gtm-icp-onboarding` / system prompt routing; coerce stringified `execute_tool.arguments`; UI polls Redis 5s. Skill sync cmd `1785600000013`. | `upsert-gtm-target-companies-tool.ts`, `useBrowsingContext.ts`, `chat-execution.service.ts`, `search-companies.md`, `chat-system-prompts.const.ts`, `useGtmLiveWorkingSet.ts` |
| GTM Command chrome collapse | Dropped duplicate title/meta/run bars (7→2): run picker + New/CRM live in PageHeader; Definition/Latest/Open + workflow select trail on the main tabs row; panel is canvas-only. | `GtmHomePage.tsx`, `GtmRunProgressHeader.tsx`, `GtmMainTabs.tsx`, `GtmWorkflowToolbar.tsx`, `GtmWorkflowPanel.tsx` |
| GTM workflow picker canvas remount | Dropdown updated Ask AI / pin but canvas kept prior graph: `WorkflowDiagramEffect` treats DRAFT switches as position-preserving merges. Remount embed on `workflowId`. | `GtmWorkflowDiagramEmbed.tsx`, `GtmWorkflowPanel.tsx` |
| GTM workflow picker on Stage B | Dropdown of ACTIVE workflows next to Stage B hint; selecting rebinds `Project.outreachWorkflowId` + Ask AI context (does not overwrite an existing Project pin with the Stage B default). | `GtmWorkflowPanel.tsx`, `useGtmWorkflowEmbed.ts` |
| GTM workflow canvas centering | Embed canvas left/low because viewport subtracted `sidePanelWidth` from an already-flex-shrunk container and ignored `flowBounds.x` (IF_ELSE). Center on container bounds + ResizeObserver; top-align on open. | `WorkflowDiagramCanvasBase.tsx` |
| GTM LinkedIn connected false positive banner | Banner used accounts-list selector only; Projects/`useUnipile` ORs server member status. Member-bound LinkedIn skips workspace accounts list → banner said Connect LinkedIn while menu showed Connected. GTM now uses `useUnipile()`. | `useGtmLiveWorkingSet.ts` |
| GTM home Menu dropdown | Reused Projects `CandidateTableProjectsPageMenuDropdown` on `/gtm-home` PageHeader. LinkedIn/WhatsApp via `useUnipile` (same as Projects); credits + extension + download/credit modals. Add New Project → `createGtmProject`. | `GtmHomePage.tsx`, `CandidateTableProjectsPageMenuDropdown.tsx` |
| Remove GTM Market map tab | Dropped unused segment-overview tab; Companies/People/Workflow remain. `company.segment` still on ephemeral rows for table/CRM. | `GtmMainTabs.tsx`, `GtmHomePage.tsx`, deleted `GtmMarketMapPanel.tsx` |
| GTM Stage B default workflow embed | Workflow tab always resolves / auto-creates `GTM Outreach — Per Candidate`, binds `Project.outreachWorkflowId` (new runs + missing binds). Prefill ICP kickoff stays conversational. | `useGtmWorkflowEmbed.ts`, `useGtmLiveWorkingSet.ts`, `gtm-command.constants.ts`, `GtmWorkflowPanel.tsx` |
| Restore candidate-search shared plumbing | Accidental wipe of whole `candidate-search/` broke Vite. Restored `searchResultsState`, `searchConfigState`, `useFindManyAttachments`, API paths, types, empty `Search` route stub. UI (SearchPanel/AIChat) stays deleted. | `candidate-search/{states,hooks,types,constants,Search.tsx}` |
| Move AssistantDetailsTable → GTM | Renamed/refactored as `GtmDetailsTable` + `GtmTableData` under `gtm-home`; `GtmCompaniesPanel` uses it directly. Deleted assistant copy; `assistant.types` keeps a local table shape for JD upload thread types. | `GtmDetailsTable.tsx`, `GtmCompaniesPanel.tsx` |
| Retire SearchPanel + Assistant chat column | Removed Project `SearchPanel` / `SearchParametersForm` stack and legacy `/assistant` chat UI (`AssistantChatColumn`, MCP client chat, thread sidebar/results). `/assistant` is a stub that opens side-panel Ask AI. Kept `AssistantDetailsTable` (GTM Companies) + `searchResultsState`. | `candidate-search/*`, `assistant/components/AssistantPage.tsx`, `ProjectPage.tsx` |
| Remove unused AIChatAssistant | Deleted dead candidate-search AI chat modal stack (`ai-chat-assistant/`, `FloatingAIChat/`, `CandidateSearchModal`, `CandidateSearchResultsTable`, modal open atom). | `candidate-search/components/*`, `ProjectPage.tsx` |
| GTM home live shell (demo removed) | Dropped fixture walkthrough / Reset demo / phase bar; `/gtm-home` loads CRM by `gtm-demo-run-1`, Ask AI ICP kickoff, enroll wired, live channel banner | `gtm-home/*`, `GtmHomeNavigationDrawerItem.tsx` |
| GTM multi-project scope | Shell scopes by `?projectId=` (Project.id). Companies via `gtmRunKey` (= project id / legacy slug); Candidates via `projectsId`. Dropped unused `Company.gtmProjectId`. Project picker + New GTM run. | `useGtmLiveWorkingSet.ts`, `gtm-command-fields.data.ts`, `gtm-home/README.md` |
| GTM ephemeral companies | Cancelled projectCompany join. Companies tab = Redis cache `/gtm-command/cache/companies` per projectId. CRM Company only on people add/enroll. | `gtm-companies-cache.service.ts`, `GtmCommandController`, `gtm-companies-cache.ts`, `useGtmLiveWorkingSet.ts`, `useAddGtmRecordsToCrm.ts` |
| GTM ICP onboarding Ask AI skill | Standard skill `gtm-icp-onboarding` + chat system-prompt example; `/gtm-home` PREFILL kickoff via `openAskAiPageWithPreprompt`; Workflow tab Ask AI prefills run context; workspace backfill cmd `1785600000012` | `skill-metadata/contents/gtm-icp-onboarding.md`, `standard-skill.constant.ts`, `chat-system-prompts.const.ts`, `GtmHomePage.tsx`, `gtm-home.types.ts`, `2-25-workspace-command-1785600000012-*` |
| GTM outreach local seed (arxena ws) | Fixed seed GraphQL for `stepsDiff` + `updateWorkflowVersionTrigger`; trigger before first step; needs user ACCESS JWT. Ran B+C on `635976bf-…`, bound Project, simulator `full` OK | `setup-gtm-outreach-workflow.ts`, `gtm-home/README.md` |
| GTM outreach workflow spine | Candidate+Project execution / Person cross-run memory; operational fields (send mode, caps, stop flags, ICP spec); seed Workflow B/C; throttle + persona utils; `/gtm-home` context atom + Project.outreachWorkflowId embed; fixtures + simulator | `gtm-command-fields.data.ts`, `setup-gtm-outreach-workflow.ts`, `simulate-gtm-outreach-run.ts`, `gtm-home/*`, `gtm-outreach-throttle.util.ts` |
| Workspace member profile provisioning | Ported workflows `WorkspaceMemberProfileProvisioningService` + sync listener onto current branch via TwentyORM (`GlobalWorkspaceOrmManager`). Creates `workspaceMemberProfile` tagged to new `workspaceMember` (`RECRUITER_TYPE`) after member create (workspace init already syncs arxena standard first; invites reuse same hook). | `workspace-member-profile-provisioning.service.ts`, `listeners/workspace-member-profile-sync.listener.ts`, `user-workspace.service.ts` `createWorkspaceMember` |
| Google `/rest/connectedAccounts` 400 | ConnectedAccount left workspace REST; axios GET returned `object 'connectedAccounts' not found`. New `GoogleConnectedAccountAuthService` uses core `ConnectedAccountEntity` + `GoogleOAuth2ClientProvider` (encrypted refresh tokens). Wired into google-contacts, sheets, drive, calendar, gmail-sender. | `google-auth/google-connected-account-auth.*`, those five Google modules |
| Start-chat interim queue crash (`candidate.jobs`) | EngagedCandidateProcessor still read `candidate.jobs` after Job→Project → `candidateJob` undefined → TypeError on `.id` and start chat never sent. Remapped to `projects` + `Project` type; null-guard when project missing. Sibling: video-interview response create `jobId`/`candidate.jobs` → `projectId`/`projects`; WhatsApp command + spreadsheet dual-write + voice-call casts. | `engaged-candidate-processor.job.ts`, `engaged-candidate-queue.service.ts`, `video-interview.controller.ts`, `ArxSendToWhatsappCommand.tsx` |
| Org chart build UI stuck on preview | Sales Nav/Unipile builds wrote Redis under `sales_navigator`, but GET only read `classic` → blank preview after success. GET now checks classic/sales_navigator/recruiter. Also: WS `sendToUser` emits to member room; front refetches + polls during queued build and promotes non-blank cache hits. | `org-chart.service.ts` `loadCachedOrgChartAmongAliases`, `websocket.service.ts`, `useOrgChartActions.ts`, `ArxOrgChartContainer.tsx` |
| Clear org chart cache missed Sales Nav | Context-menu `/org-chart/company-cache/clear` only deleted `…:classic:…` Redis keys, so `sales_navigator` HIT still served after “clear”. Invalidate now deletes classic/sales_navigator/recruiter (+ apify source tag) and pattern-flushes function-grade keys. | `orgchart-cache.service.ts`, `org-chart.service.ts` |
| Org chart ctx menu dark mode | GoJS `ContextMenuButton` kept default white `ButtonBorder.fill` while dark palette used light text → invisible items. Themed button fill/hover/pressed via `getOrgChartCtxMenu` + `orgChartContextMenuButton` helper. | `twenty-orgchart/.../constants.ts`, `contextMenus.ts`, §2.12 |
| Queue/processor + delivery `jobId`→`projectId` | Controllers were aliasing HTTP `projectId` then still passing `{ jobId }` into services/queues that expect `projectId` (AI filters, compute-tokens). Processors `process-candidates` / `process-resume-uploads` / `process-ai-filters` read `jobData.jobId` while shared types enqueue `projectId`. Front `useCreateInterviewVideos` posted `{ jobId }` to project-only delivery endpoint. Fixed handoffs + shortlist/voice/cache/resume-upload aliases; upload-profiles accepts `projectName`. | `process-*-*.ts`, `candidate-sourcing.controller`, `arx-delivery.controller`, `useCreateInterviewVideos`, `candidate-search.controller`, `resume-upload.controller`, `voice-call.controller` |
| Candidate-sourcing `projectId` body/query sweep | Front already sent `projectId` for upload-jd / create-prompts / update-chat-questions / compute-tokens / process-ai-filters / by-linkedin-urls; server still required `jobId`. Accepted `projectId ?? jobId` on those handlers + enrichment; create-prompts GraphQL input `projectId`; by-linkedin-urls returns `projectIds` (+ `jobIds` alias). Front command-menu hooks → `get-candidates-by-project-id` + `projectId`. CRX/front upload-profiles also send `projectId`/`twenty_job_id` (legacy `job_id` kept). | `candidate-sourcing.controller.ts`, `useArxCheckContactAvailability`, `useArxFetchContactDetails`, `orgChartUtils`, `ProjectPage`, `MergeProjectsModal`, `ValidationStep`, `CandidateSearchModal`, CRX `initialize.{store,internal}.ts` |
| `upload-jd` body still required `jobId` | Front/MCP send `projectId`; controller only read `jobId` → 400 `Missing jobId or attachmentUrl`. Now accepts `projectId ?? jobId`. | `candidate-sourcing.controller.ts` `uploadJD` |
| Start chats false “OpenAI key missing” | `apiKeysState` only hydrated when `ApiKeysProvider` mounted (Settings General / JD modal). Project page start-chat read empty atom even when key was saved. Mount provider once in `WorkspaceAppProviders`; drop nested wrappers; gate start/validate on `apiKeysLoadingState`. | `WorkspaceAppProviders.tsx`, `useStartChats.ts`, `useCheckDataIntegrityOfProject.ts`, `SettingsGeneral.tsx`, `ProjectPage.tsx`, `Projects.tsx` |
| People findMany TOO_COMPLEX_QUERY | Phone lookup no longer uses `graphqlQueryToFindManyPeople` (nested `people→candidates→whatsappMessages` → `TOO_COMPLEX_QUERY`). `getPersonDetailsByPhoneNumber` now uses `graphqlToFetchAllCandidateData` (findManyCandidates) and synthesizes a PersonNode with `candidates.edges`. Shared people query also stripped nested 1-to-manys for other callers; messages hydrated separately where needed. Phone status `candidate.jobs` → `projects`. | `filter-candidates.ts`, `queries.ts`, `get-phone-number-status` |
| StaticGraphQL `updatedBy` actor | `setChromeExtensionId` → `StaticGraphQLService.executeGraphQL` uses **system** auth ALS. `UpdatedByUpdateOnePreQueryHook` called `ActorFromAuthContextService`, which only handled user/apiKey/application → threw `Unable to build actor metadata`. Added `buildCreatedByFromSystem` + `isSystemAuthContext` branch (same pattern for all StaticGraphQL / job writes with actor fields). **Redeploy/restart nest** on host — `/home/ubuntu/twenty` dist still old. | `actor-from-auth-context.service.ts`, `build-created-by-from-system.util.ts` |
| Apollo wrong-client sibling sweep | After fixing `useCheckDataIntegrityOfProject`, grepped ARX/migrated modules for `useQuery`/`useLazyQuery`/`useMutation` + `twenty-shared/graphql` without `useApolloCoreClient` or raw `/graphql`. **No further wrong-client call sites.** Intentional `/metadata`: `WORKSPACE_CREDITS`, billing `CREDIT_TRANSACTIONS`. Latent footgun: commented `FIND_MANY_VIDEO_INTERVIEW_MODELS` in `InterviewCreationModal` (hardcoded models today). | §5, §6 |
| Project page FindManyProjects → `/metadata` | `useCheckDataIntegrityOfProject` (runs on ProjectPage load / validate) used default Apollo client → `Unknown type "ProjectFilterInput"` / `Cannot query field "projects"`. Wired `useApolloCoreClient` (`/graphql`). Sibling JD upload paths already fixed. | `useCheckDataIntegrityOfProject.ts`, §5 |
| Org chart Unipile build no-op | Estimate OK but build stuck on "Waiting for worker pickup": `@Process({ jobName, concurrency })` stored the whole object as `jobName`, so explorer never matched handlers and BullMQ completed jobs in ~0.17ms. Fixed `Process` to accept string \| options; warn when a job matches no handler. Affects all orgchart-* processors + Unipile webhook + TheOrg enrich. Restart **twenty-worker**. | `process.decorator.ts`, `message-queue.explorer.ts` |
| ARX worker processor audit | Same object-form `@Process` hit 9 ARX processors (covered by decorator fix). Additional: `AutonomousRecruiterModule` missing from `JobsModule` (worker never loaded handler) + manual heartbeat enqueued queue name as job name. Wired module into `JobsModule`; controller now uses `AutonomousRecruiterProcessor.name`. Leftovers: orphan `CronProcessesModule`, dead `@nestjs/bull` `google-contacts.processor.ts`, Process `concurrency` ignored (queue config wins). | `jobs.module.ts`, `autonomous-recruiter.controller.ts` |
| setChromeExtensionId + Person.city GraphQL | `StaticGraphQLService.getCurrentUser` used `getRepositoryToken(Entity, 'core')` → Nest looked for `core_UserEntityRepository` (connection is unnamed/default; schema `"core"` ≠ connection name). Switched to `@InjectRepository` constructor DI + `TypeOrmModule.forFeature` on `GraphQLExecutionModule`; `VideoInterviewModule` now imports that module instead of re-providing the service. Removed obsolete `Person.city` / `xLink` from shared Person queries/mutations. Rebuild `twenty-shared` + **redeploy/restart nest on the host** (`/home/ubuntu/twenty` logs are still old dist). | `static-graphql.service.ts`, `graphql-execution.module.ts`, `video-interview.module.ts`, `twenty-shared/src/graphql/{queries,mutations}.ts`, §2.10 |
| TypeORM `'core'` connection sweep | Sibling sweep of workflows → current for `getRepositoryToken(X, 'core')` / `@InjectRepository(X, 'core')` / `forFeature([...], 'core')`. **Only runtime leftover was** `StaticGraphQLService` (fixed above + JWT fallback). Spec: `privacy-consent.service.spec.ts` dropped `'core'`. Ported ARX modules (`arx-chat`, `candidate-sourcing`, `org-chart-client-ip`, `whiskeysocket-baileys`) already use default connection. Workflows still has many old `'core'` hits (legacy named connection); current WT is clean. | `static-graphql.service.ts`, `privacy-consent.service.spec.ts`, §2.10 |
| HotTable selection → command menu | Side panel / Cmd+K missed ARX candidate actions: HotTable wrote selection to project-scoped context store only (MAIN synced on All Actions click), and never upserted rows into the record store so `noneDefined(selectedRecords, "deletedAt")` failed. `HotTableContextStoreEffect` now continuously syncs selection + candidate object/pageType to MAIN and upserts selected HotTable/search rows (with `deletedAt: null`). | `HotTableContextStoreEffect.tsx`, §2.11 |
| Dark mode: ARX hardcoded light colors | Handsontable switched via `useThemeColorScheme` → `ht-theme-main-dark`; AI Filtering inputs/cards, WhatsApp/LinkedIn account cards + signup/QR, candidate-table chrome, chat drawer, video-interview shells remapped to `themeCssVariables`. Org chart GoJS nodes/tooltips/menus via `colorScheme` + light/dark palette (remount on scheme change); ContextMenuButton `ButtonBorder` now themed too. See §2.12 + §6 leftovers. | `DataTable.tsx`, `AssistantDetailsTable.tsx`, `arx-ai-filtering/.../StyledComponents.tsx`, `Connected*Accounts.tsx`, LinkedIn/WhatsApp signup, `video-interview/interview-response/*`, `twenty-orgchart` node template + ctx menus + `ArxOrgChartContainer` |
| Direct startChat/stopChat cell edits | Flipping `startChat` / `startVideoInterviewChat` / `startMeetingSchedulingChat` to true on Handsontable or CRM object-record now queues the same interim-chat flow as the Start Chat button (`CandidateChatControlListener` on candidate UPDATED). `stopChat=true` already matched the stop endpoint (flag only). Stable BullMQ job id prevents button+listener double-queue. | `candidate-chat-control.listener.ts`, `update-chat.ts`, `engaged-candidate-queue.service.ts`, `arx-chat-agent.module.ts` |
| HOT column filter caret broken | Root cause: Vite 8 tree-shakes Handsontable `registerCondition()` side effects (`Filter condition "eq" does not exist`). Workflows used Vite 5.4 where this did not happen; same `initHandsontable` / HOT 15.x. Fix: yarn patch HOT `sideEffects` + vite `optimizeDeps.exclude` + preserve plugin. Also skip header `afterSelectionEnd` state updates. | `handsontable-npm-15.3.0-*.patch`, `vite.config.ts`, `HotHooks.tsx`, `DataTable.tsx` |
| Project Handsontable top bar | Restored workflows job-page toolbar into `ProjectTopBar`: search input, Active/Inactive toggle, Handsontable filter chips, clear-all filters/sorts, refresh, view object, import, statistics, bulk messages, modify project, AI filtering, multi-column sorting, validate data, fetched-candidate batch actions (All/Top20/Save/Discard + load more). Wired from `ProjectPage`. Skipped drip-campaign (inventory defer). Twenty `ObjectFilterDropdownButton` no longer exists upstream — see §6. | `ProjectTopBar.tsx`, `ProjectPage.tsx` |
| Create `metadata.unipile_accounts` | Ported workflows TypeORM `174070`/`174080` as fast instance cmd `1785600000011` (also `CREATE SCHEMA IF NOT EXISTS metadata`). Fixes pool `touchLastActive` after org-chart / Sales Nav estimates. Other ARX workflows TypeORM migs already covered by `1785600000001`–`0010`. | `2-25-instance-command-fast-1785600000011-create-unipile-accounts-table.ts`, `instance-commands.constant.ts` |
| Register missing credit instance cmds | `1785600000009` (`creditFulfillmentMode`) + `1785600000010` (`apiCredits`) existed on disk but were omitted from `INSTANCE_COMMANDS` — prod GraphQL failed with missing column. Registered both so upgrade applies them. | `instance-commands.constant.ts` |
| AI CRUD tool access by object | `OBJECT_DATABASE_CRUD_TOOL_ACCESS` (`all`/`read`/`none`); video interview objects `none`, `orgChart` `read-only`; wired in `DatabaseToolProvider` + `ToolExecutorService`; flags on Arxena `objects-data` | `object-database-crud-tool-access.const.ts`, `database-tool.provider.ts`, `objects-data.ts` |
| GetResourceCreditUsage on Razorpay | Return `[]` when no Stripe RESOURCE_CREDIT item / no subscription (was throwing `BILLING_SUBSCRIPTION_ITEM_NOT_FOUND`); front skips Stripe credits UI + AI chip when empty | `billing-usage.service.ts`, `useGetResourceCreditUsage.ts`, `SettingsBillingContent.tsx`, `CandidateTablePageHeader.tsx` |
| Project Options dropdown modals | `ChatOptionsDropdownButton` stubs (`console.log`) wired: Create Enrichments → `useArxEnrichCreationModal`, Upload CV → candidate spreadsheet import, Create Video Interview → `useInterviewCreationModal` (Upload JD already worked) | `ChatOptionsDropdownButton.tsx` |
| Hide Settings → Baileys | Removed Baileys from Accounts nav (route/page kept; Unipile/Business remain) | `useSettingsNavigationItems.tsx` |
| LinkedIn / WhatsApp Unipile connect UI | Hide connect form/QR when a matching account is already connected; show “Add another …” to reveal | `LinkedinAccounts.tsx`, `WhatsappUnipileAccounts.tsx` |
| API credits (People API) | New `workspaceCredits.apiCredits` pool; gate `people/search` + `search-by-title`; SKU `apiCredits` + `topup_api`; fulfillment/UI/admin/banners; debit tag `api_search` | `api-search-costs.constant.ts`, `people-api.controller.ts`, `1785600000010`, Settings Billing, menu |
| Unify Razorpay credits | Dual fulfillment: packs + subscriptions grant maps/reveals/AI; `creditFulfillmentMode`; UI rename + three-line menu; Arxena exhaustion banners | `entitlement-fulfillment.service.ts`, `credit-packs.constant.ts`, Settings Billing, CandidateTable menu |
| EC2 / Chatwoot ops scripts from workflows | Restored `build_app_in_new_instance.sh`, remote build script, Chatwoot builder + deploy compose/systemd scripts, e2e-on-EC2, `git_pull_all` / commit helpers, `tools/chatwoot-local` compose+branding, `docs/chatwoot-production-deploy.md`. Adapted defaults to `port/arxena-modules` and added `twenty-client-sdk` to app build/deploy. | `build*.sh`, `script_to_*.sh`, `scripts/deploy-chatwoot*.sh`, `build.config`, inventory “Ops / EC2 build scripts” |
| ARX record actions → command-menu-items | Ported workflows action-menu bulk actions to `EngineComponentKey` + seeded CMIs + headless commands; HotTable bottom bar pins + continuous MAIN sync + record-store upsert for selection filters. **Existing workspaces need** `upgrade:2-25:add-arxena-record-action-command-menu-items` (CMIs are not auto-synced). | `arxena-standard-command-menu-item.constant.ts`, `command-menu-item/engine-command/record/arx/`, `HotTableActionMenu.tsx`, `HotTableContextStoreEffect.tsx`, `2-25-workspace-command-1785600000007-…` |
| Legacy attachment download 404 | AttachmentPanel resolves legacy `fullPath` (`attachment/<uuid>.pdf`) to `/files/...`. Added workspace-scoped server compatibility route `GET /files/*path` to stream `workspace-${workspaceId}/${fullPath}` directly from storage for imported legacy rows while `attachment.file` is still null. New FILES-field attachments still use `/file/:folder/:id`. | `AttachmentPanel.tsx`, `file.controller.ts`; skill `attachment-files-field-migration`; S3 `arx-server-storage-940813655147` |
| Legacy DB import (local) | Nest CLI `workspace:import-legacy`; local dump → `arxena_legacy_local` → current `default` (activate + `_job`→`_project` ETL) | `packages/twenty-server/src/database/commands/workspace-import-legacy/` |
| Legacy DB import (app.arxanalytics) | Prod dump `arxena-prod-twenty40-default-20260724-115532.dump` → side DB `arxena_legacy_prod` on staging EC2 `i-0f294090da1d0956b` → ETL into `default`. 23/24 workspaces imported (`brave-wolf` skipped: no source `workspaceMember`). Projects/candidates match; some people/companies skipped on unique indexes. Seed subdomains renamed to free `arxena`. Pre-import backup: `~/backups/arxanalytics-default-pre-import-20260728-053443.dump`. | same CLI; host `3.234.178.51` |
| Legacy morph FK remap | Auto-map `fooId`→`targetFooId` on attachment/noteTarget/taskTarget/timelineActivity; `type`→`fileCategory`, `authorId`→`createdByWorkspaceMemberId`; camelCase enum→`TEXT_DOCUMENT`; re-ETL’d morph tables | `workspace-import-legacy.{constants,service}.ts` |
| Recoil → Jotai | ARX modules converted to `createAtomState` / `useAtomState*`; no `from 'recoil'` left in listed ARX modules | `.cursor/skills/recoil-to-jotai-migration/` |
| Emotion → Linaria | `@emotion/styled` + `theme.*` → `@linaria/react` + `themeCssVariables` across ARX UI | skill §5 |
| SnackBar API | `enqueueSnackBar` → typed enqueue helpers (partial; see §6 leftovers) | skill §6 |
| Job → Project | CRM object/files/routes renamed; MCP `job-tools` → `project-tools` | §3 below + rename script |
| twenty-shared barrels | Flat `from 'twenty-shared'` split to `/arx`, `/types`, `/utils`, `/graphql`, `/constants`, `/ai`, … | §2.4 |
| Attachment FILES-field server migration | `uploadAttachmentFile` + `file[]` + `target*Id`; `getAttachmentDownloadUrl` for reads | §2.10; hub `attachment-processes.ts`; skill `.cursor/skills/attachment-files-field-migration/` |
| Providers | `UnipileProvider`, `BaileysProvider`, `WebSocketProvider`, `NotificationProvider`, profile sync effect in `WorkspaceAppProviders` | §4 |
| Chrome extension bridges | Mounted `ChromeExtensionAuthBridgeEffect` + sidecar in providers; restored `CHROME_EXTENSION_ID` → client-config → `chromeExtensionIdState` | §0 / §4 / §6 / §9 |
| Enrichments + orgchart HMR | Guard non-array `find-many-ai-filters` `data`; orgchart lazy import retries once after Vite HMR abort | `useInitializeEnrichments`, `SampleEnrichments`, `OrgChartRoute`, candidate-sourcing controller |
| Settings Accounts | WhatsApp Unipile, Facebook SignUp, Baileys, LinkedIn SignUp, Contacts routes | `SettingsRoutes.tsx` |
| Workspace API keys form | Restored workflows `ApiKeysForm` on Settings → General (grouped: AI / Messaging / LinkedIn / Twilio / Workspace & extension); persists via `/workspace-modifications/workspace-keys` | `ApiKeysForm.tsx`, `SettingsGeneral.tsx` |
| Auth / codegen | `AuthTokenPair` etc. from `~/generated-metadata/graphql` (not `~/generated/graphql`) | §2.5 |
| Date picker | `react-date-range` → `react-datepicker` | §2.6 |
| Server base URL | `process.env.REACT_APP_SERVER_BASE_URL` → `~/config` (`REACT_APP_SERVER_BASE_URL`) across ARX modules | §2.8 |
| Candidate-sourcing HTTP Job→Project | Dual routes `get-all-projects` (+ job aliases); GraphQL `projects` | §3 |
| Apollo React hooks | `useQuery`/`useMutation`/… from `@apollo/client/react` (not `@apollo/client`); fixed `CreditHistoryModal` | §2.9 |
| OrgChart route wiring | Restored `OrgChartRoute` (reads `:companyKey` + location state); nested-button a11y; share slug null-safe | `OrgChartRoute.tsx`, `OrgChartCompanyInfo.tsx`, `orgChartPublishedSlug.ts` |
| OrgChart dual React | `gojs-react`/`ReactDiagram` crashed with “React Element from an older version” when `twenty-orgchart` nested React 18 under front React 19; react moved to peers + Vite `dedupe`/`alias` | `twenty-orgchart/package.json`, `twenty-front/vite.config.ts` |
| Duplicate icon import | `IconFileText` declared twice in `ChatOptionsDropdownButton` → `SyntaxError` / ErrorBoundary; removed redundant second import | `candidate-table/ChatOptionsDropdownButton.tsx` |
| Nav drawer clicks | `NavigationDrawerItem` with both `to` + side-effect-only `onClick` never navigates (`useMouseDownNavigation` skips `navigate(to)` when `onClick` is set); removed blocking `onClick` on projects + all-org-charts | `ProjectsNavigationDrawerItems.tsx`, `OrgChartsNavigationDrawerItems.tsx` |
| Candidate name → side panel | Stubbed `useRightDrawer` only flipped `tableState.isRightPanelOpen` (nothing rendered); wired `SidePanelPages.CandidateChat` → `CandidateChatDrawer` (workflows parity) | `SidePanelPages.ts`, `SidePanelPagesConfig.tsx`, `useRightDrawer.ts` |
| Job→Project string leftovers | Runtime `ObjectMetadataItemNotFoundError: "job"` from `useArxJDUpload('job')` / `objectNameSingular="job"`; remapped to `'project'` | `SearchPanel`, `CandidateSearchModal`, `AssistantJDSection`, `AssistantChatColumn`, `useArxJDUpload`, `ArxJDUploadModal`, `ProjectDetailsForm`, `Projects`, `ProjectPage` |
| GraphQL schema remaps | `CandidateEnrichment.fields` → `filterFields`; Attachment `authorId`/`type` → `createdBy`/`fileCategory`; controller `getCandidateFieldsByJobId` → `getCandidateFieldsByProjectId` | `twenty-shared/graphql`, candidate-sourcing, arx-chat, UploadCV |
| Workspace GraphQL scalars | Record ids `$objectRecordId` / `$idToUpdate` / `$idToDelete` / `$id` were `ID!` → now `UUID!` (matches schema builder) | `twenty-shared/src/graphql/{queries,mutations}.ts` |
| FindOneProject response key | `data.job` → `data.project` (keep `job` fallback) in chat-questions readers | `other-fields.service.ts`, `filter-candidates.ts` |
| Ops: nest + twenty-shared | Nest `--watch` does **not** reload `require('twenty-shared')` when only shared is rebuilt — restart `twenty-server` after `nx build twenty-shared` | runtime GraphQLExecutionService errors |
| Project DataTable blank | Upstream `PageBody`/`PagePanel` lost `flex:1`/`min-height:0` vs workflows → Handsontable `height:100%` collapses to 0 (header counts OK, grid invisible). Restored flex height chain; sync `filteredCandidatesCountState` on load | `PageBody.tsx`, `PagePanel.tsx`, `candidate-table/DataTable.tsx` |
| OrgChart Linaria `styled(Icon*)` | wyw-in-js ENOENT on `twenty-orgchart/node_modules/@tabler/icons-react` (Yarn hoists to root); use wrapper + `<Icon size={…} />` | `OrgChartFilters.tsx`, `OrgChartSignUpIntro.tsx` |
| Linaria `styled(Icon*)` sibling sweep | Only `@fs`/`wyw` include is `twenty-front` + `twenty-orgchart`. Orgchart: no remaining `styled(Icon*)`. Front: `styled(Icon*)` via `twenty-ui/icon` OK today (ui has local `@tabler`). Website: Emotion + local `@tabler` — not affected. | §2.2; greps below |
| Billing Linaria `spacing[220]` | invalid key (spacing only `'0'`…`'32'`) → Vite 500; was `theme.spacing(220)` = `880px` | `SettingsBillingPricing.tsx` |
| Search results Redis cache | `get()` required `payload.projectId`; pre-rename entries only had `jobId` → false 404 on project page | `search-results-cache.service.ts` |
| Object index ViewBar refresh | Ported workflows refresh onto `RecordIndexViewBar` + `ViewBar`; table reload via `recordIndexTableRefreshFunctionState` → `resetVirtualizationBecauseDataChanged` (not blanket `FindMany*` refetchQueries) | `ViewBar.tsx`, `RecordIndexViewBar.tsx`, `RecordIndexTableRefreshEffect.tsx` |
| Projects Menu dropdown UI | Header z-20 vs PageBody z-25 hid in-header menu under table. Portaled fixed panel (z-38) anchored to Menu via getBoundingClientRect | `CandidateTableProjectsPageMenuDropdown.tsx`, `CandidateTablePageHeader.tsx` (§2.3) |
| Linaria + `react-pdf` | wyw-in-js evaluates Linaria modules and chokes on `pdfjs-dist` private fields (`#divider`); lazy-load PDF viewer without Linaria | `AttachmentPanel.tsx` → `AttachmentPdfViewer.tsx` |
| AttachmentPanel Node `util` | `import { TextDecoder } from 'util'` crashes Vite client (`util.TextDecoder` externalized); use browser global `TextDecoder` | `AttachmentPanel.tsx` |
| CV drawer blank PDF preview | `styled()` for AttachmentPanel container was inside `CandidateChatDrawer` render → new component type every re-render remounted PDF viewer; also signed `/file/...?token=` fetch used Bearer (CORS preflight) and content-type fell back to URL path segment instead of `.pdf` name | `CandidateChatDrawer.tsx`, `AttachmentPanel.tsx`, `AttachmentPdfViewer.tsx` |
| CV drawer `InvalidPDFException` | Preview used `blob:` URLs; React Strict Mode cleanup `revokeObjectURL` mid-load. Pass `ArrayBuffer` to react-pdf; validate `%PDF-` magic; rewrite `localhost` file hosts to `REACT_APP_SERVER_BASE_URL` | `AttachmentPanel.tsx`, `AttachmentPdfViewer.tsx` |
| Website testimonial photos | Paths `/img/testimonials/{aaron-lintz,craig-rajpal,john-calvani}.jpg` were never backed by files on workflows or current — only `mannan-pacha.webp` exists. Legacy `lintz.jpg`/`rajpal.jpg`/`calvani.jpg` gitignored in arxena-site and missing on prod. Cleared broken paths → ui-avatars | `twenty-website` `homepage-content.ts` |
| AuthTokenPair field rename | `tokenPair.accessToken` → `accessOrWorkspaceAgnosticToken` (LinkedIn signup crash + Baileys `hasToken: false`) | §2.5; LinkedIn/WhatsApp Unipile/Baileys settings |
| Metadata `isCustom` dropped | `CreateOneField`/`CreateOneObject` + object metadata queries still selected `isCustom` (and `dataSourceId` / `relationDefinition`); schema only has `isSystem` after 2.12 drop | §2.10; `twenty-shared/src/graphql/{mutations,queries}.ts` — rebuild + restart nest |
| CMI REST `/objects/undefined/…` | Newly ported ARX command-menu + object-record hooks used `process.env.REACT_APP_SERVER_BASE_URL` (undefined under Vite) → relative `undefined/contacts/…` under `/objects/candidates`. Remapped all 18 hits to `~/config` | §2.8; `ArxAddToGoogleContactsCommand`, sibling ARX CMIs + `useStartChats` / video / chat / contact hooks |
| Profile account IDs | Restored workflows Profile “IDs” section (member/user/workspace id + schema + names) via `SettingsTableCard` + Jotai/Linaria | `pages/settings/profile/SettingsProfile.tsx` |

---

## 1. Apollo clients (critical runtime rule)

| Client | URI | Use for |
| --- | --- | --- |
| Default `ApolloProvider` | `/metadata` | Metadata GraphQL, Nest core resolvers (e.g. `workspaceCredits`, auth, settings metadata) |
| `useApolloCoreClient()` | `/graphql` | Workspace object records (`projects`, `candidates`, `attachments`, `workspaceMemberProfiles`, `orgCharts`, `videoInterview*`, …) |

### Symptoms of wrong client

Network tab shows `POST …/metadata` with errors like:

- `Unknown type "XFilterInput"`
- `Cannot query field "projects" / "workspaceMemberProfiles" on type "Query"`

### Correct patterns

```ts
const apolloCoreClient = useApolloCoreClient();
const [mutate] = useMutation(DOCUMENT, { client: apolloCoreClient });
const [runQuery] = useLazyQuery(DOCUMENT, { client: apolloCoreClient });
const { data } = useQuery(DOCUMENT, { client: apolloCoreClient, … });

const client = useApolloCoreClient();
await client.query({ query: DOCUMENT, variables });
await client.refetchQueries({ include: ['FindManyOrgCharts'] });

// OK without Apollo
await axios.post(`${SERVER}/graphql`, { query, variables }, { headers });
```

### Do **not** move these to core client

- `WORKSPACE_CREDITS` / billing Nest resolvers on `/metadata`
- Object/field metadata mutations
- Anything from `~/generated-metadata/graphql` meant for metadata schema

### Grep to find more bugs

```bash
rg -l "from 'twenty-shared/graphql'" packages/twenty-front/src/modules \
  | xargs rg -L "useApolloCoreClient|/graphql"

rg "use(Mutation|Query|LazyQuery)\(" packages/twenty-front/src/modules/{candidate-table,arx-jd-upload,orgchart,video-interview,unipile,candidate-search,assistant,arx-ai-filtering}
```

---

## 2. Import / path remaps (workflows → current)

### 2.1 State

| Broken (workflows / old) | Correct |
| --- | --- |
| `atom` / `selector` from `recoil` | `createAtomState` / `createAtomSelector` / `createAtomWritableSelector` / `createAtomFamilyState` |
| `createState` from `twenty-ui` | `createAtomState` from `@/ui/utilities/state/jotai/utils/createAtomState` |
| `useRecoilState` | `useAtomState` |
| `useRecoilValue` | `useAtomStateValue` |
| `useSetRecoilState` | `useSetAtomState` |
| `useRecoilComponentValueV2` | `useAtomComponentStateValue` |
| `useSetRecoilComponentStateV2` | `useSetAtomComponentState` |
| `type SetterOrUpdater` from `recoil` | remove; use setter from `useSetAtomState` / local `Dispatch` |
| `RecoilRoot` (tests) | `Provider` from `jotai` + `jotaiStore` |
| `mainContextStoreComponentInstanceId` | `MAIN_CONTEXT_STORE_INSTANCE_ID` |
| Declared setter `setProjects` / `setTableStateAtom` / `setChatSearchQuery` / … but call sites still use old `setJobs` / `setTableState` / `setSearchQuery` | Rename **call sites + deps** to the declared Jotai setter name (do not invent new state) |
| HotTable `setMainTargetedRecordsRule` / `setMainPageType` / … | Matching `setContextStore*` setters already declared for `MAIN_CONTEXT_STORE_INSTANCE_ID` |

**Grep for incomplete setter renames:**

```bash
# Example: declared setProjects but still calling setJobs
rg -n "setJobs\b|setTableState\b|setSearchQuery\b|setSelectedStatus\b|setFilteredCount\b|setCommandContext\b|setContactsByKey\b|setMain" packages/twenty-front/src/modules --glob '!**/node_modules/**'
```

### 2.2 UI packages

| Broken | Correct |
| --- | --- |
| `twenty-ui/icons` | `twenty-ui/icon` |
| `Button`, `Checkbox`, `Toggle`, `IconButton`, `Radio`, `ButtonGroup` from `twenty-ui` | `twenty-ui/input` |
| `MenuItem*` from `twenty-ui` | `twenty-ui/navigation` |
| `H2Title`, typography from `twenty-ui` | `twenty-ui/typography` |
| `Card`, `CardContent`, `Section`, `Modal` from `twenty-ui` / old layout paths | `twenty-ui/surfaces` (and layout as needed) |
| `AnimatedPlaceholder*` from `twenty-ui` root | current twenty-ui export path for placeholders |
| `@emotion/styled` + `theme.*` | `@linaria/react` + `themeCssVariables` from `twenty-ui/theme-constants` |
| `styled(IconX)` from `@tabler/icons-react` in `twenty-orgchart` | styled wrapper + `<IconX size={…} />` (Linaria resolves package under package-local `node_modules`, missing under Yarn hoist) |
| Static `react-pdf` / `pdfjs-dist` import in a Linaria module | Lazy-load a non-Linaria viewer (`AttachmentPdfViewer`); wyw-in-js cannot parse pdfjs private fields |
| `import { TextDecoder } from 'util'` in front modules | Browser global `TextDecoder` (Vite externalizes Node `util`) |
| `styled()` for drawer AttachmentPanel container inside render | Module-scope styled component (`StyledInlineAttachmentContainer`) — in-render styled remounts PDF viewer every parent update |
| axios + `Authorization` on signed `/file/...?token=` URLs | Fetch without Bearer (token in query); infer PDF from filename when content-type is weak/octet-stream |
| `theme.spacing(n)` | `themeCssVariables.spacing[n]` |
| `enqueueSnackBar` | `enqueueSuccessSnackBar` / `enqueueErrorSnackBar` / `enqueueInfoSnackBar` / `enqueueWarningSnackBar` |
| `useRightDrawer` / `RightDrawerPages` | side-panel APIs (`useSidePanelMenu`, `SidePanelPages` from `twenty-shared/types`) |
| `useDropdown(id)` (removed) | `useAtomComponentStateValue(isDropdownOpenComponentState, id)` + `useOpenDropdown` / `useCloseDropdown` |
| `usePreviousHotkeyScope` / `AppHotkeyScope` / `InputHotkeyScope` / `CountryPickerHotkeyScope` | focus stack: `FocusComponentType` + `usePushFocusItemToFocusStack` / related |
| `@/types/AppPath` | `AppPath` from `twenty-shared/types` |
| `@/object-metadata/types/CoreObjectNameSingular` | `CoreObjectNameSingular` from `twenty-shared/types` |
| `NavigationDrawerItem` with `to` + side-effect-only `onClick` | `to` alone, **or** `onClick` that calls `navigate(...)` (hook skips `navigate(to)` when `onClick` is set) |

### 2.12 Dark mode / theme tokens (ARX)

| Broken | Correct |
| --- | --- |
| Handsontable `themeName="ht-theme-main"` | `useThemeColorScheme()` → `ht-theme-main-dark` when dark (not `ht-theme-main-dark-auto` — that follows OS, not app setting) |
| Org chart GoJS node `fill: 'white'` / black text | Pass `colorScheme` into `OrgChartDiagram` / `createNodeTemplate`; use `getOrgChartNodePalette` / `getOrgChartCtxMenu` (canvas cannot use CSS vars). Remount diagram key with `${companyId}-${colorScheme}` |
| Org chart GoJS `ContextMenuButton` white fill + dark text colors | Set `ButtonBorder.fill` / `_buttonFillOver` / `_buttonFillPressed` from `getOrgChartCtxMenu` (helper `orgChartContextMenuButton`) — GoJS buttons are not theme-aware by default |
| `background: white` / `#fff` / `#f5f5f5` / `#f3f4f6` / `#f8f9fa` | `themeCssVariables.background.primary` / `.secondary` / `.tertiary` / `.quaternary` |
| `color: #1a1a1a` / `#374151` / `#6b7280` | `themeCssVariables.font.color.primary` / `.secondary` / `.tertiary` |
| `border: 1px solid #e5e7eb` / `#d1d5db` | `themeCssVariables.border.color.medium` |
| Imperative DOM colors (`el.style.backgroundColor = '#f5f5f5'`) | Same CSS var strings (`themeCssVariables.*`) — they resolve at runtime under `html.dark` |
| Brand accents (WhatsApp `#25d366`, LinkedIn `#0077b5`, FB `#1877f2`) | Keep as brand accents |

**Grep for leftovers:**
```bash
rg -n "background:\\s*white|background-color:\\s*white|#1a1a1a|#f5f5f5|#f3f4f6|#f8f9fa|#e5e7eb" packages/twenty-front/src/modules packages/twenty-front/src/pages/settings
```

### 2.3 Dropdown path moves

| Broken | Correct |
| --- | --- |
| `@/dropdown/constants/DropdownOffsetY` | `@/ui/layout/dropdown/constants/DropdownOffsetY` |
| `@/dropdown/constants/DropdownWidth` | `@/ui/layout/dropdown/constants/DropdownWidth` |
| `useDropdown` | `useCloseDropdown` / `useOpenDropdown` + `isDropdownOpenComponentState` |
| Prefer `DropdownContent` where old `DropdownMenu` wrappers were used | `@/ui/layout/dropdown/components/DropdownContent` |
| `dropdownMenuWidth={N}` / `dropdownHotkeyScope` (removed Dropdown props) | Wrap body in `<DropdownContent widthInPixels={…}>`; drop hotkeyScope (focus stack handles it); prefer `dropdownStrategy="fixed"` for header menus |
| `size={themeCssVariables.icon.size.sm}` on icons | `size={theme.icon.size.sm}` (`useTheme()` — CSS var strings are invalid Lucide sizes) |

### 2.4 twenty-shared barrel splits

Do **not** import Arxena/CRM types from the flat `twenty-shared` root when a deep export exists.

| Kind | Prefer |
| --- | --- |
| GraphQL query/mutation strings | `twenty-shared/graphql` |
| CRM / Unipile / interview / candidate shapes | `twenty-shared/arx` |
| Cross-app enums & filter/sort types (`LinkedInSearchType`, `FiltersResponse`, `AppPath`, …) | `twenty-shared/types` |
| Org-chart / Unipile field helpers | `twenty-shared/utils` |
| Chrome webstore URL, currency labels, … | `twenty-shared/constants` |
| AI chat message types | `twenty-shared/ai` |
| Workflow schemas | `twenty-shared/workflow` |
| Application manifests / triggers | `twenty-shared/application` |

Examples from diffs:

```ts
// BEFORE
import type { CandidateNode } from 'twenty-shared';
import { LinkedInSearchType } from 'twenty-shared';
import { ARXENA_CHROME_WEBSTORE_URL } from 'twenty-shared';

// AFTER
import type { CandidateNode } from 'twenty-shared/arx';
import type { LinkedInSearchType } from 'twenty-shared/types';
import { ARXENA_CHROME_WEBSTORE_URL } from 'twenty-shared/constants';
```

### 2.5 Generated GraphQL

| Broken | Correct |
| --- | --- |
| `AuthTokenPair` from `~/generated/graphql` | `~/generated-metadata/graphql` |
| `tokenPair?.accessToken?.token` / `tokenPair.accessToken.token` | `tokenPair?.accessOrWorkspaceAgnosticToken?.token` (`AuthTokenPair` no longer has `accessToken`) |
| Metadata documents (`FindOneAgentDocument`, permission enums, …) | `~/generated-metadata/graphql` |
| Workspace record codegen (when used) | `~/generated/graphql` + Apollo **core** client |

```bash
# Should return no matches after cleanup (ARX / settings Unipile + Baileys)
rg "tokenPair\??\.accessToken" packages/twenty-front/src
```

Fixed: `LinkedinSignup`, `ConnectedLinkedinAccounts`, `WhatsappUnipileQrCode`,
`ConnectedWhatsappUnipileAccounts`, `BaileysContext`, `BaileysAccounts`.

### 2.6 Third-party UI swaps

| Broken | Correct |
| --- | --- |
| `react-date-range` (`Calendar` + CSS) | `react-datepicker` (`DatePicker` + CSS) |

### 2.7 GraphQL document sources

| Pattern | Notes |
| --- | --- |
| `from 'twenty-shared/graphql'` | Workspace SDL strings; **must** hit `/graphql` (Apollo core or raw fetch) |
| `~/generated/graphql` | Workspace codegen → `/graphql` |
| `~/generated-metadata/graphql` | Metadata codegen → default `/metadata` client |

### 2.8 Server base URL (Vite / runtime env)

Vite does **not** inject CRA-style `process.env.REACT_APP_*`. Using
`process.env.REACT_APP_SERVER_BASE_URL` produces the string `"undefined"`, so
axios resolves `` `undefined/contacts/…` `` relative to the current path
(e.g. `/objects/candidates` → `/objects/undefined/contacts/…` → 404).

| Broken | Correct |
| --- | --- |
| `` `${process.env.REACT_APP_SERVER_BASE_URL}/…` `` | `` `${REACT_APP_SERVER_BASE_URL}/…` `` with `import { REACT_APP_SERVER_BASE_URL } from '~/config'` |
| Tests setting `process.env.REACT_APP_SERVER_BASE_URL` | `jest.mock('~/config', () => ({ REACT_APP_SERVER_BASE_URL: '…' }))` |

`~/config` resolves `window._env_?.REACT_APP_SERVER_BASE_URL` or defaults to
`http://{hostname}:3000` on localhost / same-origin elsewhere.

Re-sweep after any workflows→CMI / REST hook port — those often copy the
CRA `process.env` pattern.

```bash
# Must be empty under src/modules (codegen/scripts OK)
rg "process\.env\.REACT_APP_SERVER_BASE_URL" packages/twenty-front/src
```

### 2.9 Apollo Client React hooks (v4)

Apollo Client v4 no longer re-exports React hooks from `@apollo/client`.
Importing `useQuery` / `useMutation` / `useLazyQuery` / `useSubscription` /
`useApolloClient` from `@apollo/client` fails at runtime with:

`does not provide an export named 'useQuery'` (Vite ESM).

| Broken | Correct |
| --- | --- |
| `import { useQuery } from '@apollo/client'` | `import { useQuery } from '@apollo/client/react'` |
| same for `useMutation`, `useLazyQuery`, `useSubscription`, `useApolloClient` | `@apollo/client/react` |

`gql`, `ApolloClient`, `InMemoryCache`, link/cache types stay on `@apollo/client`.

```bash
# Should return no matches after cleanup
rg "import \{[^}]*\b(useQuery|useMutation|useLazyQuery|useSubscription|useApolloClient)\b[^}]*\} from ['\"]@apollo/client['\"]" packages/twenty-front
```

Fixed: `billing/components/CreditHistoryModal.tsx` (sibling sweep: only hit).

### 2.10 Workspace GraphQL field remaps (Attachment / CandidateEnrichment)

| Broken | Correct |
| --- | --- |
| `CandidateEnrichment.fields` | `filterFields` (query alias `fields: filterFields` ok for UI) |
| create enrichment input `fields` | `filterFields` |
| `Attachment.authorId` | `createdBy { workspaceMemberId name source }` (auto on create) |
| `Attachment.type` | `fileCategory` (`TEXT_DOCUMENT`, `VIDEO`, `AUDIO`, `OTHER`, …) |
| `uploadFile` + `FileFolder.Attachment` + create with `fullPath` | FILES upload (`useUploadAttachmentFile` / `uploadAttachmentFile`) + create with `file: [{ fileId, label }]` |
| Attachment morph FKs `candidateId` / `projectId` / `personId` / `companyId` | `targetCandidateId` / `targetProjectId` / `targetPersonId` / `targetCompanyId` |
| Download via `attachment.fullPath` | `getAttachmentDownloadUrl` → `file[0].url` (fullPath fallback for legacy rows) |
| `candidateService.getCandidateFieldsByJobId` | `getCandidateFieldsByProjectId` |
| `$objectRecordId: ID!` / `$idToUpdate: ID!` / `$idToDelete: ID!` / `$id: ID!` | `UUID!` (workspace + metadata id args) |
| `response.data.data.job` after `FindOneProject` | `response.data.data.project` (optional `?? job` fallback) |
| Metadata `Field`/`Object`.`isCustom` | removed — use `isSystem` (or omit); also drop `Object.dataSourceId` + `Field.relationDefinition` → `relation` in metadata SDL strings |
| `Person.city` / `Person.xLink` in shared queries | drop — `city` removed from standard Person; never in ARX `fields-data`. Also drop `xLink` from `findOnePersonQuery` |
| Nested 1-to-many under people findMany (`candidates { whatsappMessages {…} }`) | Forbidden (`TOO_COMPLEX_QUERY`). Keep `candidates` only; hydrate messages with root `whatsappMessages(filter: { candidateId })` |

Skill: [`.cursor/skills/attachment-files-field-migration/SKILL.md`](../.cursor/skills/attachment-files-field-migration/SKILL.md)

```bash
rg -n "authorId|\\btype\\b" packages/twenty-shared/src/graphql/queries.ts | rg -i attachment
rg -n "fields$" packages/twenty-shared/src/graphql/queries.ts | rg -i enrich
rg -n "getCandidateFieldsByJobId|authorId:|type: 'TextDocument'" packages/twenty-{server,front}/src
rg -n '\$objectRecordId: ID!|\$idToUpdate: ID!' packages/twenty-shared/src/graphql
rg -n 'data\?\.data\?\.job\b' packages/twenty-server/src/engine/core-modules
rg -n 'isCustom|dataSourceId|relationDefinition' packages/twenty-shared/src/graphql
rg -n 'uploadFile|FileFolder\.Attachment|fileFolder:\s*"Attachment"' packages/twenty-{front,server}/src
rg -n 'filter:\s*\{\s*(candidateId|projectId)\s*:' packages/twenty-front/src/modules/{candidate-table,arx-jd-upload,candidate-search}
rg -n 'attachment\.fullPath|getAttachmentDownloadUrl' packages/twenty-{front,server}/src
rg -n 'getRepositoryToken\([^)]+, [\'"]core[\'"]\)' packages/twenty-server/src
rg -n '^\s+city\s*$' packages/twenty-shared/src/graphql
```

**Symptom log (GraphQLExecutionService):** `Cannot query field "fields" on CandidateEnrichment`, `authorId`/`type` on `Attachment`, `Variable "$objectRecordId" of type "ID!" used in position expecting type "UUID"`, `Cannot query field "city" on type "Person"` — fix shared queries, rebuild `twenty-shared`, **restart nest** (module cache).

**Symptom log (setChromeExtensionId):** `Nest could not find core_UserEntityRepository` — do not pass `'core'` as TypeORM connection name to `getRepositoryToken` (schema ≠ connection).

**Legacy dump ETL (`workspace:import-legacy`):** morph FKs on `attachment` / `noteTarget` / `taskTarget` / `timelineActivity` auto-map `fooId`→`targetFooId` (plus `jobId`→`targetProjectId`, `type`→`fileCategory`, `authorId`→`createdByWorkspaceMemberId`). Without this, attachment rows copy but `targetCandidateId` stays null. Enum labels also accept camelCase (`TextDocument`→`TEXT_DOCUMENT`).

### 2.11 Record actions (workflows action-menu → command-menu-items)

| Broken (workflows) | Correct (current) |
| --- | --- |
| `action-menu` Recoil registry + `getActionConfig` | Metadata `command-menu-item` + `EngineComponentKey` headless commands |
| `CandidateActionsConfig` / `TableCandidateActionsConfig` / `JobActionsConfig` / `PeopleActionsConfig` | `ARXENA_STANDARD_COMMAND_MENU_ITEMS` + `command-menu-item/engine-command/record/arx/*` |
| `HotTableActionMenu` bottom bar via `actionMenuEntries` | `HotTableActionMenu` via `CommandMenuContextProvider` + pinned CMIs + All Actions |
| `RightDrawerPages.CandidateActions` | `SidePanelPages.CommandMenuDisplay` (HotTable continuously syncs selection + candidate object to MAIN; upserts selected rows into record store so `noneDefined(selectedRecords, "deletedAt")` passes) |
| Job-scoped actions | `project` via `objectMetadataItem.nameSingular == "project"` |

```bash
rg -n 'ARX_START_CHAT|ARX_CLONE_MULTIPLE|arxena-standard-command-menu' packages/twenty-{server,front}/src
rg -n 'HotTableActionMenu|HotTableContextStoreEffect' packages/twenty-front/src/modules/candidate-table
rg -n 'CandidateActions' packages/twenty-front/src/modules/ui/layout/right-drawer
```

## 3. Job → Project rename map

CRM “Job” object became **Project**. Script: `node packages/twenty-utils/rename-crm-job-to-project.mjs`.

### Routes / AppPath

| Old | New |
| --- | --- |
| `AppPath.Jobs` | `AppPath.Projects` |
| Jobs list route | `AppPath.Projects` → `@/candidate-table/Projects` |
| Job detail route | `AppPath.Project` → `@/candidate-table/ProjectPage` |
| Candidate-under-job paths | `${AppPath.Projects}/:candidateId`, `${AppPath.Project}/:candidateId` |

### Front file renames (representative)

| Deleted (Job*) | Added (Project*) |
| --- | --- |
| `candidate-table/Jobs.tsx` | `Projects.tsx` |
| `candidate-table/JobPage.tsx` | `ProjectPage.tsx` |
| `candidate-table/JobCard.tsx` | `ProjectCard.tsx` |
| `…/MergeJobsModal.tsx` | `…/MergeProjectsModal.tsx` |
| `…/JobStatisticsModal.tsx` | `…/ProjectStatisticsModal.tsx` |
| `…/CandidateTableJobsPageMenuDropdown.tsx` | `…/CandidateTableProjectsPageMenuDropdown.tsx` |
| `hooks/useJobPagination.ts` | `useProjectPagination.ts` |
| `hooks/useJobRefetch.ts` | `useProjectRefetch.ts` |
| `hooks/useJobStateReset.ts` | `useProjectStateReset.ts` |
| `hooks/useJobStatusToggle.ts` | `useProjectStatusToggle.ts` |
| `arx-jd-upload/…/JobDetailsForm.tsx` | `ProjectDetailsForm.tsx` |
| `…/useOpenAddJobModal.ts` | `useOpenAddProjectModal.ts` |
| `…/useJobDescriptionParser.ts` | `useProjectDescriptionParser.ts` |
| `…/sendCreateJobToArxena.ts` | `sendCreateProjectToArxena.ts` |
| `…/sendUpdateJobToArxena.ts` | `sendUpdateProjectToArxena.ts` |
| `candidate-search/…/JobFilters.tsx` | `ProjectFilters.tsx` |
| `orgchart/…/OrgChartAddToJobModal.tsx` | `OrgChartAddToProjectModal.tsx` |
| `…/OrgChartResultsAddToJobModal.tsx` | `OrgChartResultsAddToProjectModal.tsx` |
| `…/OrgChartResultsAddToJobPanel.tsx` | `OrgChartResultsAddToProjectPanel.tsx` |
| `orgchart/hooks/useJobOrgChartData.ts` | `useProjectOrgChartData.ts` |
| — | `navigation/…/ProjectsNavigationDrawerItems.tsx` |

### Server / MCP (same rename)

| Old | New |
| --- | --- |
| MCP `job-tools` | `project-tools` |
| GraphQL `jobs` / `JobFilterInput` | `projects` / `ProjectFilterInput` |
| Candidate relation field `candidate.jobs` | `candidate.projects` (runtime GraphQL + TS `CandidateNode`) |
| Redis search-results payload `jobId` | `projectId` (read accepts either; write uses `projectId`) |

### Candidate-sourcing HTTP paths (dual-mounted)

Front calls **project** paths; server keeps **job** aliases for site/CRX.

| Front / preferred | Legacy alias | Notes |
| --- | --- | --- |
| `POST …/upload-jd` | (same path) | Body `projectId` (+ legacy `jobId` accepted) + `attachmentUrl` |
| `POST …/create-prompts` | (same path) | Body `projectId` (+ legacy `jobId`); GraphQL input `projectId` |
| `POST …/update-chat-questions` | (same path) | Body `projectId` (+ legacy `jobId`) |
| `POST …/compute-tokens` / `process-ai-filters` | (same path) | Body `projectId` (+ legacy `jobId`) |
| `POST …/update-contact-from-enrichment` | (same path) | Body `projectId` (+ legacy `jobId`) |
| `GET …/candidates/by-linkedin-urls` | (same path) | Query `projectId` (+ legacy `jobId`); response `projectIds` (+ `jobIds`) |
| `POST …/get-all-projects` | `get-all-jobs` | Response `{ projects }` (+ `jobs` alias) |
| `POST …/arx-chat/move-candidates-to-project` | `move-candidates-to-job` | Body `projectId` (+ legacy `jobId` accepted) |
| `POST …/get-project-by-id` | `get-job-by-id` | Body `projectId` (or `jobId`); response `{ project }` (+ `job`) |
| `POST …/get-candidates-by-project-id` | `get-candidates-by-job-id` | Body `projectId`; filter `projectsId` |
| `POST …/get-candidate-fields-by-project` | `get-candidate-fields-by-job` | Body `projectId` |
| `POST …/create-project-in-arxena-and-sheets` | `create-job-in-arxena-and-sheets` | |
| `POST …/update-project-in-arxena-and-sheets` | `update-job-in-arxena-and-sheets` | |

```bash
rg "@Post\('get-all-jobs'\)|get-all-projects" packages/twenty-server/src/engine/core-modules/candidate-sourcing
rg "candidate-sourcing/get-all-" packages/twenty-front/src/modules
```

### Server / MCP file renames (representative)

| Old | New |
| --- | --- |
| `twenty-mcp-server/.../job-tools.ts` | `project-tools.ts` |
| `autonomous-recruiter/job-context.service.ts` | `project-context.service.ts` |
| `…/job-candidate-utils.ts` | `project-candidate-utils.ts` |
| `…/jobCreationService.ts` | `projectCreationService.ts` |

**Do not rename** queue/Bull “job” IDs, LinkedIn Jobs search schemas, or enrichment job processors (script denylist).

### Grep for leftovers

```bash
rg -n "AppPath\\.Jobs\\b|MergeJobsModal|useJobRefetch|useOpenAddJobModal|sendCreateJobToArxena|OrgChartAddToJob|@/candidate-table/Jobs\\b" packages/twenty-front packages/twenty-shared
rg -n "objectNameSingular[=:]\\s*['\"]job['\"]|useArxJDUpload\\(['\"]job['\"]\\)|nameSingular === ['\"]job['\"]|targetObjectNameSingular:\\s*['\"]job['\"]" packages/twenty-front/src/modules
rg -n "candidate\\.jobs|candidate\\?\\.jobs|node\\?\\.jobs|ProfileData\\.jobs" packages/twenty-server/src/engine/core-modules
```

---

## 4. Provider / settings wiring (ported)

| Change | File |
| --- | --- |
| Wrap workspace tree with `UnipileProvider` + `BaileysProvider` | `app/components/WorkspaceAppProviders.tsx` |
| Mount `WebSocketProvider` then `NotificationProvider` under `SnackBarProvider` | same — fixes `useNotification must be used within a NotificationProvider` in `DataTable` |
| Mount `WorkspaceMemberProfileUnipileSyncEffect` | same (must use Apollo **core** client — see §5) |
| Mount `ChromeExtensionAuthBridgeEffect` (JWT → extension `set_auth_token`) | `WorkspaceAppProviders.tsx` + `RootAppProviders.tsx` |
| Mount chrome-extension sidecar (iframe `tokens` / `navigate`) | `SharedAppProviders.tsx` |
| `CHROME_EXTENSION_ID` → `/client-config` → `chromeExtensionIdState` | server `config-variables` + `ClientConfigService`; front `useClientConfig` |
| Settings: Contacts, WhatsApp Unipile, Facebook SignUp, Baileys, LinkedIn SignUp | `app/components/SettingsRoutes.tsx` + `SettingsPath.*` |
| Nav: projects + org charts drawer items | `navigation/components/ProjectsNavigationDrawerItems.tsx`, `OrgChartsNavigationDrawerItems.tsx` |

---

## 5. Bugs found & fixed (Apollo wrong client)

Status: `fixed` = `useApolloCoreClient` wired; `ok-http` = already posts to `/graphql`; `ok-metadata` = intentionally on `/metadata`.

| Date | File | Operation | Status |
| --- | --- | --- | --- |
| 2026-08-03 | `object-record/hooks/useCheckDataIntegrityOfProject.ts` | `FindManyProjects` (validate on ProjectPage) | fixed |
| 2026-07-25 | `unipile/…/WorkspaceMemberProfileUnipileSyncEffect.tsx` | `findWorkspaceMemberProfiles` | fixed |
| 2026-07-25 | `unipile/…/LinkedinStoredProfileUnipileActions.tsx` | refetch profiles | fixed |
| 2026-07-25 | `arx-jd-upload/…/ProjectDetailsForm.tsx` | find projects + update profile | fixed |
| 2026-07-25 | `arx-jd-upload/hooks/useArxJDUpload.ts` | update profile | fixed |
| 2026-07-25 | `candidate-table/hooks/useProjectStatusToggle.ts` | `UpdateOneProject` | fixed |
| 2026-07-25 | `candidate-table/ProjectCard.tsx` | `UpdateOneProject` | fixed |
| 2026-07-25 | `candidate-table/…/MergeProjectsModal.tsx` | `CreateOneProject` | fixed |
| 2026-07-25 | `orgchart/…/OrgChartResultsAddToProjectPanel.tsx` | `CreateOneProject` | fixed |
| 2026-07-25 | `arx-jd-upload/…/ArxJDUploadModal.tsx` | `FindManyProjects` | fixed |
| 2026-07-25 | `video-interview/…/useCreateOneVideoInterviewQuery.tsx` | create template | fixed |
| 2026-07-25 | `video-interview/…/useCreateOneVideoInterviewQuestionQuery.tsx` | create question | fixed |
| 2026-07-25 | `orgchart/hooks/useOrgChartsRefetch.ts` | refetch FindManyOrgCharts | fixed |
| — | `candidate-table/CandidateInfoHeader.tsx` | update candidate | ok-http |
| — | `candidate-table/CandidateChatDrawer.tsx` | fetch candidate data | ok-http |
| — | `candidate-table/UploadCV.tsx` | create attachment | ok-http |
| — | `arx-jd-upload/…/ChatQuestionsSection.tsx` | `FindOneProject` | ok-http |
| — | `video-interview/…/VideoInterviewResponseViewer.tsx` | query by interview | ok-http |
| — | `candidate-table/Projects.tsx` / `ProjectPage.tsx` | `WORKSPACE_CREDITS` | ok-metadata |
| — | `billing/…/CreditHistoryModal.tsx` | `CREDIT_TRANSACTIONS` | ok-metadata |
| — | `video-interview/…/InterviewCreationModal.tsx` | `FIND_MANY_VIDEO_INTERVIEW_MODELS` (commented; uses hardcoded models) | latent — if restored must use core client |

---

## 6. Known leftovers (still to clear)

Tracked from current tree greps — fix then tick §7.

| Issue | Locations (as of 2026-07-25) |
| --- | --- |
| Candidate-sourcing body still `jobId`-only (no `projectId ?? jobId`) | **done** for HTTP handlers + queue processors + delivery shortlist/interview-videos + search cache + resume-upload + voice (2026-08-03). Remaining naming-only: CRX/site snake_case `job_id`/`job_name` on upload-profiles / create-project-in-arxena (intentional dual contract); shared job payloads still use field `jobName` (display name). |
| Apollo wrong client (workspace ops → `/metadata`) | **done** as of 2026-08-03 sweep — only remaining were intentional metadata (`WORKSPACE_CREDITS`, billing) + commented video-model query |
| ARX worker: orphan `CronProcessesModule` | Never imported → `CandidateEngagementCronService` never enqueues; `CandidateEngagementProcessor` exists in CandidateSourcing but cron producer is dead |
| Dead `@nestjs/bull` `GoogleContactsProcessor` | `google-contacts.processor.ts` uses empty `@Process()` from `@nestjs/bull`; not in any module. Live path is `GoogleContactsQueueProcessor` |
| `@Process({ concurrency })` ignored | Accepted by decorator but discarded; real concurrency is `MESSAGE_QUEUE_WORKER_CONFIG` (e.g. Apollo decorator says 2, orgchart queue is 1) |
| Twenty `ObjectFilterDropdownButton` / old Filter+Sort ViewBar buttons | workflows `JobPage`/`Projects` passed Filter+Sort dropdowns as `rightComponent`; component removed upstream. Project page uses Handsontable filter chips + multi-column sort button instead (`ProjectTopBar`). `Projects.tsx` still has commented-out ViewBar Filter/Sort. Revisit if CRM view filters needed on Handsontable. |
| `process.env.REACT_APP_SERVER_BASE_URL` (→ `/undefined/…`) | **done** — re-swept 2026-07-26 after CMI port; `rg` in `src/modules` clean (§2.8). Codegen/scripts may still use `process.env` (Node). |
| `enqueueSnackBar` still used | `orgchart/hooks/useOrgChartSnackBar.ts`, `useOrgChartActions.ts`, several `OrgChart*Modal*.tsx`, `ArxJDUploadDropzone.tsx` |
| `useRightDrawer` still used | **partial** — `useRightDrawer` opens `SidePanelPages.CandidateChat` and `CommandMenuDisplay` (was CandidateActions); call sites still go through shim (`DataTable`/`HotHooks`/`useOpenCandidateChatDrawer`). HotTable selection continuously syncs to MAIN via `HotTableContextStoreEffect` (All Actions still re-syncs before open) |
| `Button` from `twenty-ui` root (prefer `twenty-ui/input`) | e.g. `OrgChartResultsAddToProjectPanel.tsx` |
| Recoil→Jotai | **done** for ARX module set listed in §7 (no `from 'recoil'`) |
| Emotion leftovers in ARX modules | **done** (no `@emotion/styled` in those paths) |
| Hardcoded light palette in ARX dark mode | **partial** — fixed datatable HOT theme, AI Filtering form, WhatsApp/LinkedIn cards+signup, candidate-table chrome, chat drawer, video-interview shells (§2.12). Still open: remaining video-interview control knobs (`ControlsOverlay` white thumb), `orgchart/App.css`, some `TableColumns` score/link hex colors, QR `QrCodeWrapper` (keep white for scan contrast) |
| Apollo React hooks from `@apollo/client` (v4) | **done** — only `CreditHistoryModal` had `useQuery` from `@apollo/client`; remapped to `@apollo/client/react` (§2.9) |
| Attachment `authorId`/`type` + enrichment `fields` | **done** for shared queries + ARX create/read paths (§2.10); SQL index builders in `object-apis-creation.ts` still reference legacy `authorId`/`type` columns |
| Attachment FILES upload + morph FKs + URL reads | **done** — front UploadCV/AttachmentPanel/JD/AI/video + server hub + CV/WhatsApp/video/email paths; skill `attachment-files-field-migration`. Rebuild `twenty-shared` + restart nest. Transitional replicate may still write deprecated `fullPath` when legacy rows lack `file[]` |
| Legacy attachment binaries + `/files/*` route | **open** — arxena: 28 rows `file=null` + `fullPath=attachment/<uuid>.*`; S3 keys missing under `workspace-635976bf…` and `workspace-fe44a968…`. Upstream removed path `/files/*` (only `/file/:folder/:id`). Front URL prefix fixed in AttachmentPanel; still need storage copy or re-upload + optional legacy route restore |
| Workspace GraphQL `ID!` vs `UUID!` | **done** in `twenty-shared` queries/mutations (§2.10); rebuild + restart nest |
| Metadata `isCustom` / `dataSourceId` / `relationDefinition` | **done** — removed from `CreateOneField`/`CreateOneObject` + object metadata queries (§2.10); rebuild + restart nest |
| `FindOneProject` → `data.job` | **done** — `other-fields.service` + `filter-candidates` read `project` (§2.10) |
| `findActivitiesOperationSignatureFactory` `authorId` | upstream activities signature — verify separately vs Attachment remap |
| `NotificationProvider` / `WebSocketProvider` missing | **done** — mounted in `WorkspaceAppProviders` (§4) |
| `response.data.data is not iterable` (sample enrichments) | **done** — front Array.isArray guards + controller `?? []` |
| Stale server: `getCandidateFieldsByJobId is not a function` | **ops** — dist already has `getCandidateFieldsByProjectId`; restart `twenty-server` if process predates rebuild |
| Stale nest `twenty-shared` GraphQL strings | **ops** — after `nx build twenty-shared`, restart nest (watch does not invalidate `require` cache) |
| Google Contacts `/rest/connectedAccounts` 400 | **done** — core ConnectedAccount + OAuth2 provider via `GoogleConnectedAccountAuthService` (2026-08-03) |
| OrgChart lazy import fail during Vite reconnect | **mitigated** — `OrgChartRoute` retries dynamic import once; hard-refresh if HMR thrash persists |
| OrgChart Linaria `styled(Icon*)` ENOENT | **done** — wrapper + size props in `twenty-orgchart` (§0 / §2.2) |
| Billing Linaria invalid spacing keys | **done** — `spacing[220]` → `880px`, `spacing[2.5]` → `10px` in `SettingsBillingPricing.tsx` |
| Linaria + `react-pdf` / pdfjs `#divider` | **done** — lazy `AttachmentPdfViewer` (no Linaria) from `AttachmentPanel` (§0 / §2.2) |
| AttachmentPanel `util.TextDecoder` | **done** — dropped Node `util` import; use browser global (§0 / §2.2) |
| CV drawer blank PDF (`#cv`) | **done** — hoist `StyledInlineAttachmentContainer`; signed-URL fetch without Bearer; content-type from filename; PDF loading indicator (§0) |
| CV drawer `InvalidPDFException` | **done** — pass `ArrayBuffer` to react-pdf (no `blob:` revoke race); `%PDF-` / ZIP magic checks; normalize localhost file hosts (§0) |
| Website testimonial JPGs 404 | **partial** — broken paths cleared (ui-avatars). Drop real photos into `public/img/testimonials/` and restore `photo` in `homepage-content.ts` when assets are recovered |
| Chrome extension AuthBridge / Sidecar unwired | **done** — AuthBridge + Sidecar mounted; `CHROME_EXTENSION_ID` in client-config |
| ExtensionInstall onboarding path | **deferred** — workflows `ExtensionInstallOnboarding` + `AppPath.ExtensionInstallOnboarding` + `OnboardingStatus.EXTENSION_INSTALL`; current onboarding enum has no `EXTENSION_INSTALL` |
| Hardcoded OAuth `clientId=chrome` + `….chromiumapp.org` | **deferred** — workflows used env `CHROME_EXTENSION_ID` in `auth.service`; HEAD uses `ApplicationRegistration` redirect URIs (register chrome app there) |
| `InformationBannerLinkedinUnipileAutoConnect` | **deferred** — workflows-only banner; Unipile recovery still via org-chart banner / consent setting |
| Job-boards → Naukri queue action | **deferred** — `useUpdateSnapshotProfilesFromJobBoards*` not ported; `naukriQueueExtensionBridge` itself is present |

```bash
rg -n "enqueueSnackBar\\b" packages/twenty-front/src/modules/{orgchart,arx-jd-upload}
rg -n "useRightDrawer|RightDrawerPages" packages/twenty-front/src/modules/candidate-table
rg -n "from 'twenty-ui'" packages/twenty-front/src/modules/orgchart | head
rg -n "styled\\(Icon" packages/twenty-orgchart packages/twenty-front/src
rg -n "from '@tabler/icons-react'" packages/twenty-orgchart packages/twenty-front/src
rg -n "themeCssVariables\\.spacing\\[[0-9]{3,}\\]" packages/twenty-front/src
```

---

## 7. Module checklist (front compile + Apollo)

Mark as you clear each wave.

| Module | Recoil→Jotai | UI/Linaria | SnackBar API | Apollo `/graphql` | Job→Project | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `candidate-table` | [x] | [x] | [~] | [x] | [x] | CandidateChat via side panel; ARX record actions via CMI/HotTable (§2.11); `useRightDrawer` shim remains; `objectNameSingular` → project |
| `arx-jd-upload` | [x] | [x] | [~] | [x] | [x] | dropzone snackbar; upload target → project |
| `orgchart` | [x] | [x] | [ ] | [x] | [x] | snackbar helpers still old API; route via `OrgChartRoute` |
| `unipile` | [x] | [x] | [x]? | [x] | n/a | providers wired |
| `video-interview` | [x] | [x] | [x]? | [x] | n/a | create hooks fixed |
| `candidate-search` | [x] | [x] | [x]? | n/a | [x] | REST/`fetch` to candidate-search; no Apollo workspace GQL |
| `assistant` | [x] | [x] | [x]? | n/a | [x] | No Apollo GQL; uses `useProjectRefetch` REST |
| `arx-ai-filtering` | [x] | [x] | [x]? | n/a | n/a | No Apollo GQL in module |
| `linkedin-unipile` | [x] | [ ] | [ ] | n/a | n/a | types/state only; Unipile GQL via `unipile` module |
| `whatsapp-unipile` | [x] | [ ] | [ ] | n/a | n/a | types/state only |
| `chrome-extension*` | [x] | [x] | [x]? | [x] | n/a | AuthBridge + Sidecar + client-config ID wired |
| `websocket-context` | [x] | [ ] | [ ] | [ ] | n/a | |
| `baileys` | [x] | [ ] | [ ] | n/a | n/a | provider wired |

`[x]` done · `[~]` partial · `[ ]` open · `[x]?` likely done, re-verify with grep

Per-module gate:

```bash
npx tsc --noEmit --pretty false 2>&1 | rg "modules/<name>/"
```

---

## 8. How to extend this track

When a new class of error appears during port:

1. Add a row to **§0** (agent work log) and the matching remap table (**§2** / **§3**).
2. Fix call sites; append a row to **§5** or **§6**.
3. Tick **§7** when a module is clean for that column.
4. Prefer updating [`.cursor/skills/recoil-to-jotai-migration/SKILL.md`](../.cursor/skills/recoil-to-jotai-migration/SKILL.md) if the remap is mechanical and will recur.
5. For bulk CRM renames, prefer the rename script over hand edits, then re-grep leftovers in **§3**.
6. When you edit a file that already exists on `upstream/core`, add/update a row in **§9** (do not bury it only in ARX module notes).

Enforced by Cursor rule [`.cursor/rules/port-workflows-catalog.mdc`](../.cursor/rules/port-workflows-catalog.mdc): every workflows → `port/arxena-modules` change must (1) **sweep for the same pattern in other files**, then (2) update this file and [`port-workflows-inventory.md`](./port-workflows-inventory.md) in the same turn.

---

## 9. Upstream core files altered

Catalog of **existing Twenty / upstream files** touched for the Arxena port (not new ARX-only modules under `arx-*`, `orgchart`, `candidate-*`, etc.).

Status legend:

| Status | Meaning |
| --- | --- |
| `committed` | In `upstream/core...HEAD` |
| `working` | Unstaged / staged local change on top of HEAD |
| `intent` | Port wiring / product change (must survive rebases carefully) |
| `format` | Import/style-only churn (low merge risk; can often drop) |

### 9.1 Committed modifications vs `upstream/core` (`diff-filter=M`)

These files **already existed** on upstream and were edited on `port/arxena-modules`.

#### Root / tooling

| File | Status | Why |
| --- | --- | --- |
| `package.json` | committed · intent | Workspace scripts / package wiring for orgchart, MCP, tinybird |
| `yarn.lock` | committed · intent | Lockfile for new packages |
| `.gitignore` | committed · intent | Port ignores |
| `packages/twenty-front/tsconfig.json` | committed · intent | Path / package refs for ported front |
| `packages/twenty-shared/package.json` | committed · intent | Export map for `/arx`, `/graphql`, … |
| `packages/twenty-shared/project.json` | committed · intent | Nx target wiring |
| `packages/twenty-server/.env.example` | committed · intent | Arxena config keys documented |

#### Nest wiring / config

| File | Status | Why |
| --- | --- | --- |
| `packages/twenty-server/src/engine/core-modules/core-engine.module.ts` | committed · intent | Register Arxena Nest modules |
| `packages/twenty-server/src/engine/core-modules/environment/environment.module.ts` | committed · intent | EnvironmentService shim |
| `packages/twenty-server/src/engine/core-modules/twenty-config/config-variables.ts` | committed · intent | Arxena / billing config vars |
| `packages/twenty-server/src/engine/core-modules/message-queue/jobs.module.ts` | committed · intent | Register Arxena queue jobs |
| `packages/twenty-server/src/engine/core-modules/redis-client/redis-client.service.ts` | committed · intent | Port-related Redis usage |
| `packages/twenty-server/src/modules/modules.module.ts` | committed · intent | Module graph registration |
| `packages/twenty-server/src/engine/core-modules/application/application.service.ts` | committed · intent | App install / seed hooks for Arxena |
| `packages/twenty-server/src/engine/metadata-modules/object-metadata/object-metadata.service.ts` | committed · intent | Standard metadata seed integration |
| `packages/twenty-server/src/engine/metadata-modules/ai/ai-chat/services/agent-chat-cancel-subscriber.service.ts` | committed · intent | Ask AI / tool provider integration |

#### Workspace manager + billing (upstream modules extended)

| File | Status | Why |
| --- | --- | --- |
| `packages/twenty-server/src/engine/workspace-manager/workspace-manager.module.ts` | committed · intent | Wire `arxena-standard-metadata` |
| `packages/twenty-server/src/engine/workspace-manager/workspace-manager.service.ts` | committed · intent | Seed Arxena standard objects on workspace init |
| `packages/twenty-server/src/engine/core-modules/billing/billing.module.ts` | committed · intent | Stripe catalog ensure + Arxena credits |
| `packages/twenty-server/src/engine/core-modules/billing/commands/billing-sync-plans-data.command.ts` | committed · intent | Catalog sync |
| `packages/twenty-server/src/engine/core-modules/billing/stripe/services/stripe-price.service.ts` | committed · intent | Catalog helpers |
| `packages/twenty-server/src/engine/core-modules/billing/stripe/services/stripe-product.service.ts` | committed · intent | Catalog helpers |
| `packages/twenty-server/src/engine/core-modules/billing/utils/transform-stripe-price-to-database-price.util.ts` | committed · intent | Price transform |
| `packages/twenty-server/src/engine/core-modules/billing/utils/__tests__/transform-stripe-price-to-database-price.util.spec.ts` | committed · intent | Tests for above |

#### Shared types / barrels (upstream files extended)

| File | Status | Why |
| --- | --- | --- |
| `packages/twenty-shared/src/types/AppPath.ts` | committed · intent (+ working) | `Projects` / `Project` / org-chart / assistant paths |
| `packages/twenty-shared/src/types/SettingsPath.ts` | committed · intent (+ working) | Accounts Unipile / LinkedIn / WhatsApp / Contacts / Website paths |
| `packages/twenty-shared/src/types/index.ts` | committed · intent | Re-export ported types |
| `packages/twenty-shared/src/constants/index.ts` | committed · intent | Re-export Arxena constants |
| `packages/twenty-shared/src/utils/index.ts` | committed · intent | Re-export orgchart / Unipile / privacy utils |

#### Front router (upstream)

| File | Status | Why |
| --- | --- | --- |
| `packages/twenty-front/src/modules/app/hooks/useCreateWorkspaceAppRouter.tsx` | committed · intent (+ working) | Lazy routes for Projects / ProjectPage / org-chart via `OrgChartRoute` / ARX pages |

### 9.2 Working-tree intentional wiring (upstream files, still uncommitted)

Edit these carefully on rebase — product integration points.

| File | Status | Why |
| --- | --- | --- |
| `packages/twenty-front/src/modules/app/components/WorkspaceAppProviders.tsx` | working · intent | `UnipileProvider`, `BaileysProvider`, `WebSocketProvider`, `NotificationProvider`, profile sync effect, `ChromeExtensionAuthBridgeEffect`, `ApiKeysProvider` (workspace keys for start-chat / JD / settings) |
| `packages/twenty-front/src/modules/app/components/RootAppProviders.tsx` | working · intent | `ChromeExtensionAuthBridgeEffect` for root/auth shell |
| `packages/twenty-front/src/modules/app/components/SharedAppProviders.tsx` | working · intent | Chrome extension sidecar effect + provider |
| `packages/twenty-front/src/modules/client-config/hooks/useClientConfig.ts` | working · intent | Set `chromeExtensionIdState` from `/client-config` |
| `packages/twenty-server/src/engine/core-modules/client-config/services/client-config.service.ts` | working · intent | Expose `chromeExtensionId` from `CHROME_EXTENSION_ID` |
| `packages/twenty-server/src/engine/core-modules/client-config/client-config.entity.ts` | working · intent | `chromeExtensionId` field |
| `packages/twenty-server/src/engine/core-modules/twenty-config/config-variables.ts` | working · intent | `CHROME_EXTENSION_ID` (ARXENA group) |
| `packages/twenty-front/src/modules/app/components/SettingsRoutes.tsx` | working · intent | Accounts Contacts / WhatsApp / Facebook / Baileys / LinkedIn / Website routes; Org chart embed new/detail routes |
| `packages/twenty-front/src/pages/settings/general/SettingsGeneral.tsx` | working · intent | Grouped workspace integration keys form (`ApiKeysForm`; provider now in `WorkspaceAppProviders`) |
| `packages/twenty-front/src/modules/navigation/components/MainNavigationDrawerScrollableItems.tsx` | working · intent | Mount `ProjectsNavigationDrawerItems` + `OrgChartsNavigationDrawerItems` |
| `packages/twenty-front/src/modules/settings/hooks/useSettingsNavigationItems.tsx` | working · intent | Nav entries for Google Contacts / messaging accounts / Website |
| `packages/twenty-front/src/modules/settings/admin-panel/constants/SettingsAdminTabs.ts` | working · intent | Admin tabs: credits, org-chart IPs, published charts, LinkedIn cache, WhatsApp monitoring, users |
| `packages/twenty-front/src/modules/settings/admin-panel/components/SettingsAdminContent.tsx` | working · intent | Host new admin tab panels |
| `packages/twenty-front/src/modules/settings/admin-panel/components/SettingsAdminGeneral.tsx` | working · intent | Admin general extensions |
| `packages/twenty-front/src/modules/settings/admin-panel/components/SettingsAdminTabContent.tsx` | working · intent | Tab content switch |
| `packages/twenty-front/src/modules/settings/billing/components/SettingsBillingContent.tsx` | working · intent | Maps/reveals + Razorpay catalog; hide Stripe AI credits section when no RESOURCE_CREDIT usage |
| `packages/twenty-server/src/engine/core-modules/billing/services/billing-usage.service.ts` | working · intent | `getResourceCreditProductUsage` returns `[]` when no subscription / no RESOURCE_CREDIT item (Razorpay) |
| `packages/twenty-front/src/modules/settings/billing/graphql/mutations/checkoutSession.ts` | working · intent | Billing checkout for dual-wallet |
| `packages/twenty-front/src/modules/settings/accounts/hooks/useTriggerApiOAuth.ts` | working · intent | Google Contacts scopes / OAuth |
| `packages/twenty-front/src/modules/client-config/states/enterpriseInstanceTypeState.ts` | working · intent | Enterprise / instance config for Arxena |
| `packages/twenty-server/src/engine/core-modules/admin-panel/admin-panel.module.ts` | working · intent | Register Arxena admin resolvers/services |
| `packages/twenty-server/src/engine/core-modules/admin-panel/admin-panel.resolver.ts` | working · intent | Admin GraphQL + Job→Project arg renames |
| `packages/twenty-server/src/engine/core-modules/admin-panel/admin-panel-queue.service.ts` | working · intent | Queue admin / project ops |
| `packages/twenty-server/src/engine/core-modules/core-engine.module.ts` | working · intent | Further module registration beyond committed (WebsiteTrackerModule) |
| `packages/twenty-emails/src/components/Logo.tsx` | working · intent | Arxena logo |
| `packages/twenty-emails/src/constants/DefaultWorkspaceLogo.ts` | working · intent | Default logo asset |
| `packages/twenty-front/src/modules/ui/navigation/navigation-drawer/constants/DefaultWorkspaceLogo.ts` | working · intent | Front default logo |
| `packages/twenty-front/src/modules/views/components/ViewBar.tsx` | working · intent | Object-index refresh button (`showRefetch` / `onRefresh` / `isRefreshing`) — workflows parity with project page |
| `packages/twenty-front/src/modules/object-record/record-index/components/RecordIndexViewBar.tsx` | working · intent | Calls table-scoped refresh atom + aggregate refetch (not blanket FindMany) |
| `packages/twenty-front/src/modules/object-record/record-table/components/RecordTableWithWrappers.tsx` | working · intent | Mounts `RecordIndexTableRefreshEffect` |
| `packages/twenty-front/src/modules/ui/layout/page/components/PageBody.tsx` | working · intent | Restore `flex:1` / `min-height:0` / `min-width:0` on left column so ARX Handsontable (`height:100%`) gets a real height |
| `packages/twenty-front/src/modules/ui/layout/page/components/PagePanel.tsx` | working · intent | Restore `flex:1` / `min-height:0` on panel (workflows parity) for full-height project table |
| `packages/twenty-front/src/modules/workflow/workflow-diagram/components/WorkflowDiagramCanvasBase.tsx` | working · intent | Center GTM/full workflow canvas on real container width (no double side-panel subtract); account for `flowBounds.x/y`; ResizeObserver on canvas resize |
| `packages/twenty-shared/src/types/SidePanelPages.ts` | working · intent | Add `CandidateChat` side-panel page (candidate profile/chat drawer) |
| `packages/twenty-front/src/modules/side-panel/constants/SidePanelPagesConfig.tsx` | working · intent | Mount `CandidateChatDrawer` (+ WhatsApp templates) for `CandidateChat` |
| `.nvmrc` | working · intent | Node version pin for port env |

### 9.3 Working-tree format-only / low-value core churn

Large set of upstream front files with **import style** changes only (`import { type X }` → `import type { X }`). Prefer not treating these as port surface unless a real behavior change appears.

Examples (representative; regenerate with `git diff --name-only` under these trees):

- `packages/twenty-front/src/modules/object-record/**`
- `packages/twenty-front/src/modules/object-metadata/**`
- `packages/twenty-front/src/modules/activities/**`
- `packages/twenty-front/src/modules/ai/**` (some may also touch Ask AI — verify before discarding)
- `packages/twenty-front/src/modules/apollo/optimistic-effect/**`
- `packages/twenty-front/src/modules/ui/input/components/internal/date/**`

```bash
# Spot-check: if diff is only import lines, classify as format
git diff -U0 -- packages/twenty-front/src/modules/object-record | rg '^\+[^+]|^-[^-]' | head
```

### 9.4 New files that *extend* upstream areas (not modifications)

Not in `diff-filter=M`, but live next to core and matter for rebases:

| Area | Examples |
| --- | --- |
| `workspace-manager/arxena-standard-metadata/**` | Seed objects/fields/relations |
| `environment/environment.service.ts` | Shim used by Arxena modules |
| `billing/services/billing-stripe-catalog.service.ts` (+ command/constants) | Stripe catalog ensure |
| `settings/admin-panel/graphql/**` | New admin queries/mutations |
| `settings/admin-panel/components/SettingsAdmin*.tsx` | Credits, org charts, LinkedIn cache, WhatsApp, users |
| `pages/settings/{accounts,linkedin,whatsapp}/**` | Account connection UIs |
| `pages/settings/ApiKeysForm.tsx` | Workspace integration keys on Settings → General |
| `navigation/components/{Projects,OrgCharts}NavigationDrawerItems.tsx` | Nav mounts used by §9.2 |
| `auth/utils/arxenaSiteUrl.ts` | Site URL helper |
| `twenty-shared/src/{arx,graphql,utils/orgchart,…}` | New shared barrels (paired with §9.1 index edits) |

### 9.5 Refresh commands

```bash
# Committed upstream modifications only
git diff --diff-filter=M --name-only upstream/core...HEAD

# Intentional wiring still dirty
git diff --name-only -- \
  packages/twenty-front/src/modules/app \
  packages/twenty-front/src/modules/navigation \
  packages/twenty-front/src/modules/settings \
  packages/twenty-server/src/engine/core-modules/core-engine.module.ts \
  packages/twenty-server/src/engine/core-modules/admin-panel \
  packages/twenty-shared/src/types/AppPath.ts \
  packages/twenty-shared/src/types/SettingsPath.ts
```
