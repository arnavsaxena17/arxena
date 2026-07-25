---
name: recoil-to-jotai-migration
description: >-
  Migrates twenty-front Recoil state to Jotai using createAtomState helpers,
  and fixes related compile errors (UI imports, Linaria theme, snackbars,
  dropdown/modal/side-panel APIs). Use when converting Recoil atoms/selectors,
  fixing State vs RecoilState type errors, createState from twenty-ui, or
  ARX module front compile failures after the Recoil removal.
---

# Recoil → Jotai Migration (twenty-front)

Migrate one module (or file group) at a time. Prefer mechanical replacements
below; do not invent new state APIs.

## Checklist per module

```
- [ ] Convert state definitions (atom/selector/createState)
- [ ] Convert Recoil hooks to Jotai helpers
- [ ] Fix UI package imports (icon, input, surfaces, navigation)
- [ ] Convert @emotion/styled + theme.* → @linaria/react + themeCssVariables
- [ ] Fix snackbar / dropdown / modal / hotkey / context-store APIs
- [ ] Update tests (RecoilRoot → Jotai Provider)
- [ ] Remove recoil imports from the module
- [ ] Re-run tsc filtered to the module path
```

## 1. State definitions

### Atom → createAtomState

```typescript
// BEFORE
import { atom } from 'recoil';
export const fooState = atom<boolean>({
  key: 'fooState',
  default: false,
});

// AFTER
import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';
export const fooState = createAtomState<boolean>({
  key: 'fooState',
  defaultValue: false,
});
```

### createState (removed from twenty-ui) → createAtomState

```typescript
// BEFORE
import { createState } from 'twenty-ui';
export const barState = createState<string[]>({
  key: 'barState',
  defaultValue: [],
});

// AFTER — same shape; only the import/helper changes
import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';
export const barState = createAtomState<string[]>({
  key: 'barState',
  defaultValue: [],
});
```

### Read-only selector → createAtomSelector

```typescript
// BEFORE
import { selector } from 'recoil';
export const fooSelector = selector({
  key: 'fooSelector',
  get: ({ get }) => get(barState) + 1,
});

// AFTER
import { createAtomSelector } from '@/ui/utilities/state/jotai/utils/createAtomSelector';
export const fooSelector = createAtomSelector({
  key: 'fooSelector',
  get: ({ get }) => get(barState) + 1,
});
```

`get(state)` still takes the State/Selector wrapper (not `.atom`).

### Writable selector → createAtomWritableSelector

```typescript
// BEFORE
selector({
  key: 'writableFoo',
  get: ({ get }) => get(fooState),
  set: ({ set }, newValue) => set(fooState, newValue),
});

// AFTER
import { createAtomWritableSelector } from '@/ui/utilities/state/jotai/utils/createAtomWritableSelector';
createAtomWritableSelector({
  key: 'writableFoo',
  get: ({ get }) => get(fooState),
  set: ({ set }, newValue) => set(fooState, newValue),
});
```

### atomFamily → createAtomFamilyState

```typescript
import { createAtomFamilyState } from '@/ui/utilities/state/jotai/utils/createAtomFamilyState';

export const itemByIdState = createAtomFamilyState<Item | null, string>({
  key: 'itemByIdState',
  defaultValue: null,
});
```

Hooks: `useAtomFamilyStateValue(family, key)`, `useSetAtomFamilyState(family, key)`.

### Component state (V2 Recoil hooks)

| Recoil | Jotai |
| --- | --- |
| `useRecoilComponentValueV2` | `useAtomComponentStateValue` |
| `useSetRecoilComponentStateV2` | `useSetAtomComponentState` |
| `useRecoilComponentStateV2` | `useAtomComponentState` |

Import from `@/ui/utilities/state/jotai/hooks/...`.

`mainContextStoreComponentInstanceId` → `MAIN_CONTEXT_STORE_INSTANCE_ID` from
`@/context-store/constants/MainContextStoreInstanceId`.

## 2. Hooks

| Recoil | Jotai helper | Import |
| --- | --- | --- |
| `useRecoilState(state)` | `useAtomState(state)` | `@/ui/utilities/state/jotai/hooks/useAtomState` |
| `useRecoilValue(state)` | `useAtomStateValue(state)` | `@/ui/utilities/state/jotai/hooks/useAtomStateValue` |
| `useSetRecoilState(state)` | `useSetAtomState(state)` | `@/ui/utilities/state/jotai/hooks/useSetAtomState` |

Do **not** call raw `useAtom(state.atom)` in app code — use the helpers so
types stay consistent with `State<T>` / `Selector<T>`.

Outside React (effects, callbacks, tests):

```typescript
import { jotaiStore } from '@/ui/utilities/state/jotai/jotaiStore';
jotaiStore.set(fooState.atom, nextValue);
const value = jotaiStore.get(fooState.atom);
```

## 3. Tests

```typescript
// BEFORE
import { RecoilRoot } from 'recoil';
render(<RecoilRoot>{ui}</RecoilRoot>);

// AFTER
import { Provider as JotaiProvider } from 'jotai';
import { jotaiStore } from '@/ui/utilities/state/jotai/jotaiStore';
render(
  <JotaiProvider store={jotaiStore}>{ui}</JotaiProvider>,
);
```

Seed state with `jotaiStore.set(state.atom, value)` before render.

## 4. UI import path fixes (common compile breakages)

| Broken | Correct |
| --- | --- |
| `twenty-ui/icons` | `twenty-ui/icon` |
| `Button`, inputs from `twenty-ui` | `twenty-ui/input` |
| `MenuItem*` from `twenty-ui` | `twenty-ui/navigation` |
| `Modal` from `@/ui/layout/modal/components/Modal` | `Modal` / `ModalContent` from `twenty-ui/surfaces` |
| `createState` from `twenty-ui` | `createAtomState` (see §1) |
| `useRightDrawer` / `RightDrawerPages` | side-panel APIs (`useSidePanelMenu`, `SidePanelPages` from `twenty-shared/types`) |
| `useDropdown(id)` (removed) | `useAtomComponentStateValue(isDropdownOpenComponentState, id)` + `useOpenDropdown` / `useCloseDropdown` |
| `usePreviousHotkeyScope` / `AppHotkeyScope` / `InputHotkeyScope` | focus stack: `usePushFocusItemToFocusStack` / related focus hooks |
| `@/types/AppPath` | `AppPath` from `twenty-shared/types` |
| `@/object-metadata/types/CoreObjectNameSingular` | `CoreObjectNameSingular` from `twenty-shared/types` |

## 5. Emotion Theme → Linaria + themeCssVariables

Emotion `Theme` is no longer augmented — `theme.background` etc. fail typecheck.

```typescript
// BEFORE
import styled from '@emotion/styled';
const Box = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  padding: ${({ theme }) => theme.spacing(2)};
`;

// AFTER
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
const Box = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  padding: ${themeCssVariables.spacing[2]};
`;
```

Runtime theme object: `import { useTheme } from 'twenty-ui/theme-constants'`.

Mapping notes:
- `theme.spacing(n)` → `themeCssVariables.spacing[n]` (string keys `'0'`…`'32'`)
- Keep dynamic prop interpolations as `({ prop }) => ...`; only theme reads become CSS variables.
- Do **not** use `styled(IconX)` for `@tabler/icons-react` (or other deps) inside
  packages like `twenty-orgchart`: Linaria/wyw resolves the package under
  `packages/<pkg>/node_modules/`, which is empty when Yarn hoists to the repo
  root (`ENOENT …/package.json`). Prefer a styled wrapper + `<IconX size={…} />`.

## 6. SnackBar API

`enqueueSnackBar` was removed. Use:

- `enqueueSuccessSnackBar({ message, options? })`
- `enqueueErrorSnackBar({ message, options? })`
- `enqueueInfoSnackBar({ message, options? })`
- `enqueueWarningSnackBar({ message, options? })`

## 6b. Server base URL

Vite does not inject `process.env.REACT_APP_*`. Always:

```typescript
import { REACT_APP_SERVER_BASE_URL } from '~/config';
// `${REACT_APP_SERVER_BASE_URL}/candidate-sourcing/...`
```

Never `` `${process.env.REACT_APP_SERVER_BASE_URL}/…` `` (becomes `/undefined/…`).
In tests: `jest.mock('~/config', () => ({ REACT_APP_SERVER_BASE_URL: 'http://…' }))`.

## 7. Order of work (module-by-module)

1. Convert all `states/*.ts` in the module first.
2. Convert hooks/providers that only touch those states.
3. Convert components (hooks + UI imports + Linaria).
4. Convert tests.
5. `npx tsc --noEmit --pretty false 2>&1 | rg "modules/<name>/"` and fix remaining errors in that module before moving on.

Target ARX modules that still import recoil (as of migration):

- `candidate-table`, `candidate-search`, `arx-jd-upload`, `arx-ai-filtering`
- `orgchart`, `assistant`, `video-interview`, `unipile`
- `websocket-context`, `linkedin-xray`, `linkedin-unipile`, `whatsapp-unipile`
- `chrome-extension`, `chrome-extension-sidecar`

## 8. Done criteria

- No `from 'recoil'` / `createState` from `twenty-ui` in the module
- No `twenty-ui/icons` (use `twenty-ui/icon`)
- No `@emotion/styled` theme property access (use Linaria + CSS vars)
- Module-filtered `tsc` shows no Recoil/State-type or Theme errors for that path
