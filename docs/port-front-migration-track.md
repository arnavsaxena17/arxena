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
| EC2 / Chatwoot ops scripts from workflows | Restored `build_app_in_new_instance.sh`, remote build script, Chatwoot builder + deploy compose/systemd scripts, e2e-on-EC2, `git_pull_all` / commit helpers, `tools/chatwoot-local` compose+branding, `docs/chatwoot-production-deploy.md`. Adapted defaults to `port/arxena-modules` and added `twenty-client-sdk` to app build/deploy. | `build*.sh`, `script_to_*.sh`, `scripts/deploy-chatwoot*.sh`, `build.config`, inventory “Ops / EC2 build scripts” |
| ARX record actions → command-menu-items | Ported workflows action-menu bulk actions to `EngineComponentKey` + seeded CMIs + headless commands; HotTable bottom bar pins + All Actions → side panel (syncs selection to MAIN). **Existing workspaces need** `upgrade:2-25:add-arxena-record-action-command-menu-items` (CMIs are not auto-synced). | `arxena-standard-command-menu-item.constant.ts`, `command-menu-item/engine-command/record/arx/`, `HotTableActionMenu.tsx`, `2-25-workspace-command-1785600000007-…` |
| Legacy attachment download 404 | AttachmentPanel was resolving relative `fullPath` (`attachment/<uuid>.pdf`) to `/attachment/...` (missing `/files/`). Fixed `normalizeAttachmentUrl`. **Separate data gap:** arxena workspace has 28 attachment rows all with `file=null`; none of those S3 keys exist under `workspace-{id}/attachment/` (import copied DB rows, not binaries). Re-upload CVs or copy storage; legacy `/files/*` route also removed upstream (only `/file/:folder/:id`). | `AttachmentPanel.tsx`; skill `attachment-files-field-migration`; S3 `arx-server-storage-940813655147` |
| Legacy DB import (local) | Nest CLI `workspace:import-legacy`; local dump → `arxena_legacy_local` → current `default` (activate + `_job`→`_project` ETL) | `packages/twenty-server/src/database/commands/workspace-import-legacy/` |
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
```

**Symptom log (GraphQLExecutionService):** `Cannot query field "fields" on CandidateEnrichment`, `authorId`/`type` on `Attachment`, `Variable "$objectRecordId" of type "ID!" used in position expecting type "UUID"` — fix shared queries, rebuild `twenty-shared`, **restart nest** (module cache).

**Legacy dump ETL (`workspace:import-legacy`):** morph FKs on `attachment` / `noteTarget` / `taskTarget` / `timelineActivity` auto-map `fooId`→`targetFooId` (plus `jobId`→`targetProjectId`, `type`→`fileCategory`, `authorId`→`createdByWorkspaceMemberId`). Without this, attachment rows copy but `targetCandidateId` stays null. Enum labels also accept camelCase (`TextDocument`→`TEXT_DOCUMENT`).

### 2.11 Record actions (workflows action-menu → command-menu-items)

| Broken (workflows) | Correct (current) |
| --- | --- |
| `action-menu` Recoil registry + `getActionConfig` | Metadata `command-menu-item` + `EngineComponentKey` headless commands |
| `CandidateActionsConfig` / `TableCandidateActionsConfig` / `JobActionsConfig` / `PeopleActionsConfig` | `ARXENA_STANDARD_COMMAND_MENU_ITEMS` + `command-menu-item/engine-command/record/arx/*` |
| `HotTableActionMenu` bottom bar via `actionMenuEntries` | `HotTableActionMenu` via `CommandMenuContextProvider` + pinned CMIs + All Actions |
| `RightDrawerPages.CandidateActions` | `SidePanelPages.CommandMenuDisplay` (HotTable syncs selection to MAIN first) |
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
| Redis search-results payload `jobId` | `projectId` (read accepts either; write uses `projectId`) |

### Candidate-sourcing HTTP paths (dual-mounted)

Front calls **project** paths; server keeps **job** aliases for site/CRX.

| Front / preferred | Legacy alias | Notes |
| --- | --- | --- |
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

---

## 6. Known leftovers (still to clear)

Tracked from current tree greps — fix then tick §7.

| Issue | Locations (as of 2026-07-25) |
| --- | --- |
| `process.env.REACT_APP_SERVER_BASE_URL` (→ `/undefined/…`) | **done** — re-swept 2026-07-26 after CMI port; `rg` in `src/modules` clean (§2.8). Codegen/scripts may still use `process.env` (Node). |
| `enqueueSnackBar` still used | `orgchart/hooks/useOrgChartSnackBar.ts`, `useOrgChartActions.ts`, several `OrgChart*Modal*.tsx`, `ArxJDUploadDropzone.tsx` |
| `useRightDrawer` still used | **partial** — `useRightDrawer` opens `SidePanelPages.CandidateChat` and `CommandMenuDisplay` (was CandidateActions); call sites still go through shim (`DataTable`/`HotHooks`/`useOpenCandidateChatDrawer`). HotTable All Actions uses `openSidePanelMenu` after syncing selection to MAIN |
| `Button` from `twenty-ui` root (prefer `twenty-ui/input`) | e.g. `OrgChartResultsAddToProjectPanel.tsx` |
| Recoil→Jotai | **done** for ARX module set listed in §7 (no `from 'recoil'`) |
| Emotion leftovers in ARX modules | **done** (no `@emotion/styled` in those paths) |
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
| `candidate-search` | [x] | [x] | [x]? | [ ] | [x] | `ProjectFilters`; `useArxJDUpload('project')` |
| `assistant` | [x] | [x] | [x]? | [ ] | [x] | JD section + chat column metadata → project |
| `arx-ai-filtering` | [x] | [x] | [x]? | [ ] | n/a | |
| `linkedin-unipile` | [x] | [ ] | [ ] | [ ] | n/a | |
| `whatsapp-unipile` | [x] | [ ] | [ ] | [ ] | n/a | |
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
| `packages/twenty-shared/src/types/SettingsPath.ts` | committed · intent (+ working) | Accounts Unipile / LinkedIn / WhatsApp / Contacts paths |
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
| `packages/twenty-front/src/modules/app/components/WorkspaceAppProviders.tsx` | working · intent | `UnipileProvider`, `BaileysProvider`, `WebSocketProvider`, `NotificationProvider`, profile sync effect, `ChromeExtensionAuthBridgeEffect` |
| `packages/twenty-front/src/modules/app/components/RootAppProviders.tsx` | working · intent | `ChromeExtensionAuthBridgeEffect` for root/auth shell |
| `packages/twenty-front/src/modules/app/components/SharedAppProviders.tsx` | working · intent | Chrome extension sidecar effect + provider |
| `packages/twenty-front/src/modules/client-config/hooks/useClientConfig.ts` | working · intent | Set `chromeExtensionIdState` from `/client-config` |
| `packages/twenty-server/src/engine/core-modules/client-config/services/client-config.service.ts` | working · intent | Expose `chromeExtensionId` from `CHROME_EXTENSION_ID` |
| `packages/twenty-server/src/engine/core-modules/client-config/client-config.entity.ts` | working · intent | `chromeExtensionId` field |
| `packages/twenty-server/src/engine/core-modules/twenty-config/config-variables.ts` | working · intent | `CHROME_EXTENSION_ID` (ARXENA group) |
| `packages/twenty-front/src/modules/app/components/SettingsRoutes.tsx` | working · intent | Accounts Contacts / WhatsApp / Facebook / Baileys / LinkedIn routes |
| `packages/twenty-front/src/pages/settings/general/SettingsGeneral.tsx` | working · intent | Mount `ApiKeysProvider` + grouped workspace integration keys form |
| `packages/twenty-front/src/modules/navigation/components/MainNavigationDrawerScrollableItems.tsx` | working · intent | Mount `ProjectsNavigationDrawerItems` + `OrgChartsNavigationDrawerItems` |
| `packages/twenty-front/src/modules/settings/hooks/useSettingsNavigationItems.tsx` | working · intent | Nav entries for Google Contacts / messaging accounts |
| `packages/twenty-front/src/modules/settings/admin-panel/constants/SettingsAdminTabs.ts` | working · intent | Admin tabs: credits, org-chart IPs, published charts, LinkedIn cache, WhatsApp monitoring, users |
| `packages/twenty-front/src/modules/settings/admin-panel/components/SettingsAdminContent.tsx` | working · intent | Host new admin tab panels |
| `packages/twenty-front/src/modules/settings/admin-panel/components/SettingsAdminGeneral.tsx` | working · intent | Admin general extensions |
| `packages/twenty-front/src/modules/settings/admin-panel/components/SettingsAdminTabContent.tsx` | working · intent | Tab content switch |
| `packages/twenty-front/src/modules/settings/billing/components/SettingsBillingContent.tsx` | working · intent | Maps/reveals + Razorpay catalog sections |
| `packages/twenty-front/src/modules/settings/billing/graphql/mutations/checkoutSession.ts` | working · intent | Billing checkout for dual-wallet |
| `packages/twenty-front/src/modules/settings/accounts/hooks/useTriggerApiOAuth.ts` | working · intent | Google Contacts scopes / OAuth |
| `packages/twenty-front/src/modules/client-config/states/enterpriseInstanceTypeState.ts` | working · intent | Enterprise / instance config for Arxena |
| `packages/twenty-server/src/engine/core-modules/admin-panel/admin-panel.module.ts` | working · intent | Register Arxena admin resolvers/services |
| `packages/twenty-server/src/engine/core-modules/admin-panel/admin-panel.resolver.ts` | working · intent | Admin GraphQL + Job→Project arg renames |
| `packages/twenty-server/src/engine/core-modules/admin-panel/admin-panel-queue.service.ts` | working · intent | Queue admin / project ops |
| `packages/twenty-server/src/engine/core-modules/core-engine.module.ts` | working · intent | Further module registration beyond committed |
| `packages/twenty-emails/src/components/Logo.tsx` | working · intent | Arxena logo |
| `packages/twenty-emails/src/constants/DefaultWorkspaceLogo.ts` | working · intent | Default logo asset |
| `packages/twenty-front/src/modules/ui/navigation/navigation-drawer/constants/DefaultWorkspaceLogo.ts` | working · intent | Front default logo |
| `packages/twenty-front/src/modules/views/components/ViewBar.tsx` | working · intent | Object-index refresh button (`showRefetch` / `onRefresh` / `isRefreshing`) — workflows parity with project page |
| `packages/twenty-front/src/modules/object-record/record-index/components/RecordIndexViewBar.tsx` | working · intent | Calls table-scoped refresh atom + aggregate refetch (not blanket FindMany) |
| `packages/twenty-front/src/modules/object-record/record-table/components/RecordTableWithWrappers.tsx` | working · intent | Mounts `RecordIndexTableRefreshEffect` |
| `packages/twenty-front/src/modules/ui/layout/page/components/PageBody.tsx` | working · intent | Restore `flex:1` / `min-height:0` / `min-width:0` on left column so ARX Handsontable (`height:100%`) gets a real height |
| `packages/twenty-front/src/modules/ui/layout/page/components/PagePanel.tsx` | working · intent | Restore `flex:1` / `min-height:0` on panel (workflows parity) for full-height project table |
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
