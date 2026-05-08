# Onboarding Flow Guide

This guide captures what we learned while extending the onboarding flow from:

`sign in/up -> create workspace -> create profile -> optional phone -> jobs`

to:

`sign in/up -> create workspace -> create profile -> optional phone -> intent choice -> intent path -> jobs`

Use this when you need to add, change, reorder, branch, or remove onboarding steps in the future.

## Mental model

The onboarding flow is split across two layers:

1. The backend is the source of truth for `currentUser.onboardingStatus`.
2. The frontend decides which route matches that status and keeps the user on that route.

That means most onboarding changes are not complete until both layers agree.

## Where onboarding state really comes from

The GraphQL field `currentUser.onboardingStatus` is resolved dynamically on the server. It is not just a plain database column.

Key files:

- `/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-server/src/engine/core-modules/user/user.resolver.ts`
- `/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-server/src/engine/core-modules/onboarding/onboarding.service.ts`

The resolver asks `OnboardingService.getOnboardingStatus(user, workspace)`, which computes the current step from:

- workspace activation state
- user/workspace-scoped user vars
- environment flags

Current examples of persisted onboarding keys:

- `ONBOARDING_CREATE_PROFILE_PENDING`
- `ONBOARDING_INTENT_CHOICE_PENDING`
- `ONBOARDING_INTENT_PATH`
- `ONBOARDING_CONNECT_LINKEDIN_PENDING`
- `ONBOARDING_CONNECT_ACCOUNT_PENDING`
- `ONBOARDING_INVITE_TEAM_PENDING`

Rule of thumb:

- If a step must survive refreshes, auth rehydration, or re-entry into the app, it should usually be represented in server-derived onboarding state.
- If a step is only advanced locally on the client and the server does not know about it, it can disappear after a refetch.

## The frontend routing contract

The frontend uses `currentUser.onboardingStatus` from Recoil and enforces one canonical route per status.

Key files:

- `/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-front/src/modules/onboarding/hooks/useOnboardingStatus.ts`
- `/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-front/src/hooks/usePageChangeEffectNavigateLocation.ts`
- `/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-front/src/modules/app/components/PageChangeEffect.tsx`
- `/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-front/src/modules/types/AppPath.ts`
- `/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-front/src/modules/app/hooks/useCreateAppRouter.tsx`

How it works:

- `useOnboardingStatus()` reads `currentUser.onboardingStatus`.
- `usePageChangeEffectNavigateLocation()` maps that status to a route.
- `PageChangeEffect` navigates there if the current URL does not match.

This means adding a step is not just a new page. It also needs a status-to-route mapping.

## The local "next step" helper

Many onboarding pages call `useSetNextOnboardingStatus()` after completing a step.

Key file:

- `/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-front/src/modules/onboarding/hooks/useSetNextOnboardingStatus.ts`

This hook updates Recoil optimistically so the UI can move immediately, but it is not the long-term source of truth. The server still wins after the next query/refetch.

Important implication:

- If you add a new step and only update `useSetNextOnboardingStatus()`, the flow may seem to work until a refresh.
- If you update only the backend and not `useSetNextOnboardingStatus()`, the UX can feel delayed or jumpy.

## Feature flags and environment flags

Some onboarding branches exist only when enabled by config.

Examples:

- `USE_INTENT_CHOICE_ONBOARDING`
- `USE_CONNECT_LINKEDIN_ONBOARDING`
- `SKIP_OPTIONAL_ONBOARDING_STEPS`
- `DEAL_DILIGENCE_CALENDLY_EMBED_URL`

Key files:

- `/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-server/src/engine/core-modules/environment/environment-variables.ts`
- `/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-server/src/engine/core-modules/client-config/client-config.entity.ts`
- `/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-server/src/engine/core-modules/client-config/client-config.resolver.ts`
- `/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-front/src/modules/client-config/graphql/queries/getClientConfig.ts`
- `/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-front/src/modules/client-config/components/ClientConfigProviderEffect.tsx`

Important lesson:

If the frontend queries a new client-config field, the backend GraphQL schema must expose it. We hit this exact failure when the frontend started querying `useIntentChoiceOnboarding` and `dealDiligenceCalendlyEmbedUrl` before the backend `ClientConfig` type/resolver exposed them.

## Checklist for adding a new onboarding step

If the new step should be durable and survive refreshes, update all of the following:

1. Add or extend the backend enum/state.
2. Teach the backend how to derive that status.
3. Add a route constant and route component.
4. Add redirect logic so the route is enforced.
5. Update local next-step progression.
6. Ensure the onboarding auth shell/layout still applies.
7. Add mutations or listeners that mark the step complete, skipped, or pending.
8. Add tests.

More concretely:

### 1. Add enum values

Backend:

- `/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-server/src/engine/core-modules/onboarding/enums/onboarding-status.enum.ts`

If you are adding a branch selector or branch identity, also check:

- `/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-server/src/engine/core-modules/onboarding/enums/onboarding-intent-path.enum.ts`

Frontend generated types:

- regenerate GraphQL types/codegen so the new enum values appear in:
  `/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-front/src/generated/graphql.tsx`

### 2. Extend `OnboardingService`

Key file:

- `/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-server/src/engine/core-modules/onboarding/onboarding.service.ts`

You will often need to:

- add a new `OnboardingStepKeys` entry
- extend `OnboardingKeyValueTypeMap`
- read the new user var in `getOnboardingStatus()`
- return the new `OnboardingStatus`
- add setter/clearer helper methods

This is the core "truth" layer. If this file does not know about the step, the step is usually not real yet.

### 3. Add mutations or completion paths

Key file:

- `/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-server/src/engine/core-modules/onboarding/onboarding.resolver.ts`

Ask:

- How does a user enter the step?
- How do they complete it?
- Can they skip it?
- What data should be cleared when they leave it?

For intent onboarding we added mutations for:

- setting intent choice pending
- submitting the chosen intent path
- completing the intent path step

### 4. Add the route constant

Key file:

- `/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-front/src/modules/types/AppPath.ts`

This keeps route names centralized and is what the redirect hook relies on.

### 5. Mount the page in the app router

Key file:

- `/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-front/src/modules/app/hooks/useCreateAppRouter.tsx`

Import the page and add its `<Route ... />`.

### 6. Update redirect enforcement

Key file:

- `/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-front/src/hooks/usePageChangeEffectNavigateLocation.ts`

This is one of the most important files to update.

Make sure to:

- include the new route in `isMatchingOnboardingRoute`
- add the status -> path redirect
- update the logged-out guard exception if the route should be accessible while auth is still settling
- make sure `COMPLETED` redirects away from the step if needed

If this file is not updated, users may land on the wrong page or be bounced away from the step.

### 7. Update local step progression

Key file:

- `/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-front/src/modules/onboarding/hooks/useSetNextOnboardingStatus.ts`

This controls the immediate client-side step order. Update it when:

- inserting a step between two existing ones
- skipping a step behind a flag
- changing optional behavior
- switching from linear flow to branch selection

Example from the current flow:

- after `PROFILE_CREATION`, phone is considered first if enabled
- after phone, intent choice takes priority if enabled
- only after that do legacy optional steps apply

### 8. Keep the onboarding layout/auth shell

Key files:

- `/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-front/src/modules/ui/layout/hooks/useShowAuthModal.ts`
- `/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-front/src/modules/users/components/UserProvider.tsx`
- `/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-front/src/modules/object-metadata/components/ObjectMetadataItemsGater.tsx`

This was a subtle but important lesson.

The intent-path pages initially looked "blank" even though routing was correct. The cause was not the onboarding state machine. The cause was global app loaders and metadata gates still treating those pages like normal app pages.

When adding onboarding pages, make sure they are recognized as onboarding routes in places that:

- decide whether to show the auth modal shell
- block rendering behind user loading
- block rendering behind object metadata loading

If you forget these, the URL may be correct but the screen can still show only a skeleton.

### 9. Update client config if the page depends on env-driven content

If your step uses env-provided copy, URLs, or feature toggles:

- add them to server environment variables
- expose them via `ClientConfig`
- query them from the frontend
- store them in Recoil/client-config state if that is the existing pattern

This is how the inline Calendly URL is wired for the deal-diligence page.

### 10. Add tests before trusting the flow

Recommended coverage:

- backend service tests for status derivation
- frontend redirect tests for canonical routing
- frontend hook tests for local next-step progression
- end-to-end onboarding tests for the full path

Current examples:

- `/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-server/src/engine/core-modules/onboarding/onboarding.service.spec.ts`
- `/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-front/src/hooks/__tests__/usePageChangeEffectNavigateLocation.test.ts`
- `/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-front/src/modules/onboarding/hooks/__tests__/useSetNextOnboardingStatus.test.ts`
- `/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-e2e-testing/tests/onboarding.intent-paths.spec.ts`

## Checklist for changing or reordering an existing step

If you are not adding a new step, but changing an existing one, check these same areas:

- Does the backend still return the right `OnboardingStatus`?
- Does the frontend still redirect to the right URL for that status?
- Does `useSetNextOnboardingStatus()` still match the intended order?
- Do skip actions still clear the right server flags?
- Do env flags still produce valid combinations?
- Do loader/auth shell exceptions still cover the route?
- Do e2e tests still assert the real user-visible destination, not just the URL?

## Checklist for removing a step

When removing a step, do not stop at deleting the page.

You usually also need to:

- remove the enum value if no longer used
- remove the route constant and route
- remove redirect logic from `usePageChangeEffectNavigateLocation()`
- remove step transitions from `useSetNextOnboardingStatus()`
- remove server vars, mutations, and status branches
- remove auth-shell and loader exceptions
- remove client-config fields and env flags if they are now unused
- regenerate GraphQL types
- delete or update tests

Also think about migration behavior:

- What happens to existing users who still have the old pending flag stored?
- Should old vars be ignored, cleared, or mapped to a new status?

## Branching vs linear steps

We learned that there are really two kinds of onboarding steps:

- global status-machine steps
- branch-specific UX steps

Use a global `OnboardingStatus` when the server must be able to reconstruct the step after refresh.

Use a separate branch enum or page-level logic when:

- the user is choosing between different optional experiences
- multiple pages belong to one branch
- you do not want every branch detail to become a top-level global status

The intent flow is a good example:

- `INTENT_CHOICE` is a global onboarding status
- the selected branch is stored as `ONBOARDING_INTENT_PATH`
- each chosen path maps to one top-level status:
  `COMPETITIVE_RESEARCH`, `CORPORATE_TA`, `DEAL_DILIGENCE`, or `EXTENSION_INSTALL`

## Known failure modes we hit

These are the main issues that caused confusing behavior during implementation.

### 1. The route changes, but the page looks blank

Likely causes:

- onboarding route missing from `useShowAuthModal()`
- onboarding route missing from `UserProvider`
- onboarding route missing from `ObjectMetadataItemsGater`

Symptom:

- URL is correct
- page shows skeleton or near-empty layout
- refresh sometimes changes behavior

### 2. The frontend queries config the backend does not expose

Likely causes:

- new field added to frontend query only
- `ClientConfig` type/resolver not updated

Symptom:

- `/welcome` or onboarding screens fail early
- GraphQL errors appear before onboarding really starts

### 3. The flow reaches `/jobs`, but only a skeleton is visible until reload

Root cause we found:

- `isAppWaitingForFreshObjectMetadata` stayed `true` when object metadata refresh succeeded but returned unchanged data

Key file:

- `/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-front/src/modules/object-metadata/hooks/useRefreshObjectMetadataItem.ts`

Takeaway:

- when onboarding ends, verify not only the final URL, but also the first visible content on that page

### 4. E2E tests pass on URL changes but miss broken rendering

We tightened the spec to assert `Your workspace is ready` on `/jobs`, not just `/jobs` in the address bar.

Takeaway:

- always assert user-visible content, not just navigation

## Suggested implementation sequence

When adding a new onboarding step, this order tends to be safest:

1. Define the desired user journey and optional/skip rules.
2. Decide whether the new step needs durable server state.
3. Add backend enum/vars/service logic.
4. Add mutations/listeners for entering and exiting the step.
5. Add frontend route constants and page component.
6. Add redirect enforcement in `usePageChangeEffectNavigateLocation()`.
7. Update `useSetNextOnboardingStatus()`.
8. Update auth shell and loader/gater exceptions.
9. Add or expose any needed client-config fields.
10. Regenerate GraphQL types.
11. Add unit/integration/e2e tests.
12. Verify from `http://app.localhost:3001/welcome` through to the first fully rendered post-onboarding page.

## Suggested verification checklist

For any onboarding change, manually or automatically verify:

- fresh signup from `/welcome`
- workspace creation
- profile creation
- optional phone behavior when present and when skipped
- intended branch selection
- skip actions
- refresh on each onboarding route
- final redirect to jobs or home
- final page renders real content, not just a skeleton

For branch flows, verify each branch independently with fresh accounts.

## Current step map

At the time of writing, the intended onboarding path is:

- `SignInUp`
- `CreateWorkspace`
- `CreateProfile`
- `CollectPhoneNumber` if enabled
- `IntentChoice` if `USE_INTENT_CHOICE_ONBOARDING` is enabled
- one of:
  - `CompetitiveResearchOnboarding`
  - `CorporateTaOnboarding`
  - `DealDiligenceOnboarding`
  - `ExtensionInstallOnboarding`
- `/jobs`

## Practical advice

- Treat onboarding as a cross-cutting system, not a single page.
- Backend status derivation and frontend route enforcement must stay in sync.
- New onboarding pages often need loader/auth-shell exceptions.
- Verify the first rendered post-onboarding screen, not just the redirect.
- If a step should survive refresh, make the server aware of it.
