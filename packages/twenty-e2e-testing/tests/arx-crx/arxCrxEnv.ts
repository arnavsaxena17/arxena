import path from 'path';

/** Monorepo root (arxena). From this file: tests/arx-crx -> ../../../.. */
const ARXENA_ROOT = path.resolve(__dirname, '../../../..');
/** Sibling checkout: arx-crx next to arxena */
const ARX_CRX_DEFAULT_INTERNAL_DIST = path.resolve(
  ARXENA_ROOT,
  '..',
  'arx-crx',
  'dist',
);
const ARX_CRX_DEFAULT_STORE_DIST = path.resolve(
  ARXENA_ROOT,
  '..',
  'arx-crx',
  'dist-store',
);

export const PASSWORD = 'Applecar2025';

/** `E2E_ARX_ENV=dev|prod` — drives expected API base + default app URL (with legacy overrides below). */
export type E2EArxEnv = 'dev' | 'prod';

/** `E2E_ARX_CRX=internal|store` — unpacked folder: `dist` vs `dist-store` (alias: `ARX_CRX_BUILD=store`). */
export type E2EArxCrxFlavor = 'internal' | 'store';

export const parseE2EArxEnv = (): E2EArxEnv | null => {
  const raw = process.env.E2E_ARX_ENV?.trim().toLowerCase();
  if (!raw) {
    return null;
  }
  if (raw === 'prod' || raw === 'production') {
    return 'prod';
  }
  if (raw === 'dev' || raw === 'development') {
    return 'dev';
  }
  return null;
};

export const parseE2EArxCrxFlavor = (): E2EArxCrxFlavor => {
  const fromE2E = process.env.E2E_ARX_CRX?.trim().toLowerCase();
  if (fromE2E === 'store') {
    return 'store';
  }
  if (fromE2E === 'internal') {
    return 'internal';
  }
  if (process.env.ARX_CRX_BUILD?.trim().toLowerCase() === 'store') {
    return 'store';
  }
  return 'internal';
};

/**
 * Expected `import.meta.env.ARX_BASE_URL` in the built extension (assertion in smoke test).
 * Override with `E2E_EXPECT_ARX_BASE_URL`; otherwise derived from `E2E_ARX_ENV` when set.
 *
 * In arx-crx, `yarn build:dev:store` and `yarn build:prod:store` both output to `dist-store` (same
 * folder; whichever build ran last wins). If the service worker reports `https://arxena.com` but
 * you expect dev (`http://localhost:5050`), rebuild with `build:dev:store` or set
 * `E2E_EXPECT_ARX_BASE_URL` to match the artifact you loaded.
 */
export const getExpectedArxBaseUrl = (): string | undefined => {
  const explicit = process.env.E2E_EXPECT_ARX_BASE_URL?.trim().replace(
    /\/$/,
    '',
  );
  if (explicit) {
    if (explicit.includes('://')) {
      return explicit;
    }
    if (/^(localhost|127\.0\.0\.1)(:|$)/i.test(explicit)) {
      return `http://${explicit}`;
    }
    return `https://${explicit}`;
  }

  const env = parseE2EArxEnv();
  if (env === 'prod') {
    return 'https://arxena.com';
  }
  if (env === 'dev') {
    return 'http://localhost:5050';
  }
  return undefined;
};

const isLocalDevAppHostname = (url: string): boolean => {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h === 'localhost' || h === '127.0.0.1' || h.endsWith('.localhost');
  } catch {
    return false;
  }
};

const resolveAppUrlFromFrontendBase = (): string => {
  const base = (process.env.FRONTEND_BASE_URL || 'http://localhost:3001')
    .trim()
    .replace(/\/$/, '');

  if (
    base.includes('app.localhost') ||
    base.includes('app.arxena.com') ||
    /\.localhost:\d+$/i.test(base)
  ) {
    return base;
  }

  if (base === 'http://localhost:3001' || base === 'http://127.0.0.1:3001') {
    return 'http://app.localhost:3001';
  }

  return base;
};

/**
 * App origin used by extension + onboarding (subdomain workspace flows).
 *
 * Precedence: `E2E_APP_URL` (unless localhost and prod expect base wins) → profile from `E2E_ARX_ENV` +
 * `E2E_ARX_CRX` → `E2E_EXPECT_ARX_BASE_URL` → `FRONTEND_BASE_URL`.
 *
 * When `E2E_EXPECT_ARX_BASE_URL` is https://arxena.com (extension prod `base_url`), Playwright must
 * open the CRM at https://app.arxena.com — same mapping as arx-crx `backgroundUtils` domain rules.
 * A localhost `E2E_APP_URL` from .env does not override that when you pass `E2E_EXPECT_ARX_BASE_URL` for remote runs.
 *
 * `E2E_ARX_ENV=dev` uses `FRONTEND_BASE_URL` (see `resolveAppUrlFromFrontendBase`) for both internal and store
 * unpacked folders — e.g. `yarn build:dev:store` still outputs to `dist-store` but targets the same local stack as `build:dev`.
 */
export const getAppUrl = (): string => {
  const explicit = process.env.E2E_APP_URL?.trim().replace(/\/$/, '');
  const expectArxBase = process.env.E2E_EXPECT_ARX_BASE_URL?.trim().replace(
    /\/$/,
    '',
  );
  const profileEnv = parseE2EArxEnv();
  const crxFlavor = parseE2EArxCrxFlavor();

  if (explicit && !expectArxBase) {
    return explicit;
  }

  if (!explicit) {
    if (profileEnv === 'prod') {
      return 'https://app.arxena.com';
    }
    if (profileEnv === 'dev') {
      return resolveAppUrlFromFrontendBase();
    }
    if (profileEnv === null && crxFlavor === 'store') {
      return 'https://app.arxena.com';
    }
  }

  if (expectArxBase) {
    try {
      const normalized = expectArxBase.includes('://')
        ? expectArxBase
        : `https://${expectArxBase}`;
      const hostname = new URL(normalized).hostname.toLowerCase();
      if (hostname === 'arxena.com') {
        if (!explicit || isLocalDevAppHostname(explicit)) {
          return 'https://app.arxena.com';
        }
        return explicit;
      }
    } catch {
      // fall through
    }
  }

  if (explicit) {
    return explicit;
  }

  if (expectArxBase) {
    try {
      const normalized = expectArxBase.includes('://')
        ? expectArxBase
        : `https://${expectArxBase}`;
      return normalized;
    } catch {
      return expectArxBase;
    }
  }

  return resolveAppUrlFromFrontendBase();
};

/**
 * Built extension folder (contains manifest.json). Required in CI; defaults next to arxena.
 * Override with `ARX_CRX_DIST`, or set `E2E_ARX_CRX=store` / `ARX_CRX_BUILD=store` for `dist-store/`.
 */
export const getExtensionDistPath = (): string => {
  const direct = process.env.ARX_CRX_DIST?.trim();
  if (direct) {
    return path.resolve(direct);
  }

  if (parseE2EArxCrxFlavor() === 'store') {
    const storeOverride = process.env.ARX_CRX_DIST_STORE?.trim();
    if (storeOverride) {
      return path.resolve(storeOverride);
    }
    return ARX_CRX_DEFAULT_STORE_DIST;
  }

  return ARX_CRX_DEFAULT_INTERNAL_DIST;
};

/** `dist-store` → store flavor; `dist` → internal (dev/prod share the same folder per flavor). */
export const getExtensionFlavorFromDistPath = (
  distPath: string,
): 'store' | 'internal' => {
  const n = distPath.replace(/\\/g, '/').toLowerCase();
  if (n.includes('/dist-store')) {
    return 'store';
  }
  return 'internal';
};

// /** Store manifest does not inject on http://*.localhost; skip content-script assertions. */
// export const shouldExpectContentScriptOnApp = (
//   appUrl: string,
//   distPath: string,
// ): boolean => {
//   const isStoreDist = getExtensionFlavorFromDistPath(distPath) === 'store';
//   console.log("This is the is Store dist:", isStoreDist)
//   if (!isStoreDist) {
//     return true;
//   }

//   try {
//     const host = new URL(appUrl).hostname;
//     if (host === 'localhost' || host.endsWith('.localhost')) {
//       return false;
//     }
//   } catch {
//     return true;
//   }

//   return true;
// };
