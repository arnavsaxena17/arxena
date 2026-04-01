# Twenty end-to-end (E2E) Testing

## Prerequisite

Installing the browsers:

```
npx nx setup twenty-e2e-testing
```

### Run end-to-end tests

```
npx nx test twenty-e2e-testing
```

### Start the interactive UI mode

```
npx nx test:ui twenty-e2e-testing
```

### Run test in specific file
```
npx nx test twenty-e2e-testing <filename>
```

Example (location of the test must be specified from the root of `twenty-e2e-testing` package):
```
npx nx test twenty-e2e-testing tests/login.spec.ts
```

### Runs the tests in debug mode.
```
npx nx test:debug twenty-e2e-testing
```

### Show report after tests
```
npx nx test:report twenty-e2e-testing
```

## LinkedIn-backed CRX E2E sessions

For LinkedIn-backed extension runs, a single `LINKEDIN_LI_AT` cookie is usually not enough to keep the session stable. The CRX E2E harness now supports importing a fuller LinkedIn session and reusing the same browser profile across runs:

- `E2E_CRX_BROWSER_CHANNEL=chrome` uses installed Google Chrome instead of bundled Chromium. This is now the default.
- `E2E_CRX_USER_DATA_DIR=/absolute/path/to/profile` reuses the same persistent browser profile instead of creating a fresh temp profile every run.
- `LINKEDIN_SESSION_STATE_PATH=/absolute/path/to/storage-state.json` imports a Playwright `storageState` JSON file, including LinkedIn cookies and origin localStorage.
- `LINKEDIN_BOOTSTRAP_STORAGE_STATE_PATH=/absolute/path/to/storage-state.json` saves the fuller LinkedIn session captured after a successful bootstrap so later runs can reuse it.
- `LINKEDIN_COOKIES_PATH=/absolute/path/to/cookies.json` imports a JSON cookie array if you only have cookies.
- `LINKEDIN_LI_AT=...` is still supported as a fallback, but it should be treated as the weakest option.

When `E2E_CRX_USER_DATA_DIR` is set, the test harness keeps that directory by default instead of deleting it on teardown. Set `E2E_CRX_CLEANUP_USER_DATA_DIR=1` if you want cleanup even for an explicit profile path.

A practical bootstrap flow is:

- Start with `LINKEDIN_LI_AT` plus a stable `E2E_CRX_USER_DATA_DIR`.
- Set `LINKEDIN_BOOTSTRAP_STORAGE_STATE_PATH` to a file you want the harness to write after the first successful LinkedIn run.
- On later runs, point `LINKEDIN_SESSION_STATE_PATH` at that saved file so the harness restores the expanded LinkedIn cookie jar instead of starting from only `li_at`.

## Q&A

#### Why there's `path.resolve()` everywhere?
That's thanks to differences in root directory when running tests using commands and using IDE. When running tests with commands, 
the root directory is `twenty/packages/twenty-e2e-testing`, for IDE it depends on how someone sets the configuration. This way, it
ensures that no matter which IDE or OS Shell is used, the result will be the same.
