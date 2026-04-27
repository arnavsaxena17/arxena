/**
 * Bridges to the Arxena Chrome extension content script (same tab as the app).
 * Message types must stay in sync with arx-crx `contentWindowMessageShared.ts`.
 */

export const ARX_REQUEST_LINKEDIN_UNIPILE_SYNC =
  'ARX::REQUEST_LINKEDIN_UNIPILE_SYNC' as const;
export const ARX_LINKEDIN_UNIPILE_SYNC_RESULT =
  'ARX::LINKEDIN_UNIPILE_SYNC_RESULT' as const;

export const ARX_SET_LINKEDIN_COOKIE_SYNC_CONSENT =
  'ARX::SET_LINKEDIN_COOKIE_SYNC_CONSENT' as const;
export const ARX_LINKEDIN_COOKIE_SYNC_CONSENT_RESULT =
  'ARX::LINKEDIN_COOKIE_SYNC_CONSENT_RESULT' as const;
export const ARX_GET_LINKEDIN_COOKIE_SYNC_SETTINGS =
  'ARX::GET_LINKEDIN_COOKIE_SYNC_SETTINGS' as const;
export const ARX_LINKEDIN_COOKIE_SYNC_SETTINGS_RESULT =
  'ARX::LINKEDIN_COOKIE_SYNC_SETTINGS_RESULT' as const;

/** Page ← extension content: re-push JWT into extension storage (cold start / popup open). */
export const ARX_EXTENSION_REQUEST_AUTH =
  'ARX::EXTENSION_REQUEST_AUTH' as const;
export const ARX_EXTENSION_AUTH_BRIDGE_ACK =
  'ARX::EXTENSION_AUTH_BRIDGE_ACK' as const;
/** Content script → app: handler registered; push JWT for `chrome.storage.local`. */
export const ARX_CONTENT_SCRIPT_READY = 'ARX::CONTENT_SCRIPT_READY' as const;

const FETCH_RETRY_MAX = 3;
const FETCH_RETRY_BASE_MS = 400;

function isRetryableHttpStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

/**
 * Best-effort POST to extension content script: JWT + origin for background API calls.
 */
export function pushChromeExtensionAuthToContentScript(
  authToken: string | undefined,
  origin: string,
): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.postMessage(
    {
      message: 'set_auth_token',
      payload: {
        authToken: authToken ?? null,
        origin: origin || window.location.origin,
      },
    },
    window.location.origin,
  );
}

async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit,
): Promise<Response> {
  let lastNetworkError: unknown;
  for (let attempt = 0; attempt < FETCH_RETRY_MAX; attempt += 1) {
    try {
      const res = await fetch(input, init);
      if (res.ok || !isRetryableHttpStatus(res.status)) {
        return res;
      }
      if (attempt === FETCH_RETRY_MAX - 1) {
        return res;
      }
    } catch (err) {
      lastNetworkError = err;
      if (attempt === FETCH_RETRY_MAX - 1) {
        throw err;
      }
    }
    await sleep(FETCH_RETRY_BASE_MS * 2 ** attempt);
  }
  throw lastNetworkError instanceof Error
    ? lastNetworkError
    : new Error('fetchWithRetry: exhausted retries');
}

export type LinkedinCookieSyncSettingsPayload = {
  featureEnabled?: boolean;
  consentGiven?: boolean;
  requiresConsent?: boolean;
};

export function getLinkedinCookieSyncSettingsFromPage(): Promise<
  LinkedinCookieSyncSettingsPayload | null
> {
  const requestId = `arx-get-cookie-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      resolve(null);
    }, 12_000);

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) {
        return;
      }
      if (event.data?.type !== ARX_LINKEDIN_COOKIE_SYNC_SETTINGS_RESULT) {
        return;
      }
      if (event.data.requestId !== requestId) {
        return;
      }
      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      resolve({
        featureEnabled: event.data.featureEnabled,
        consentGiven: event.data.consentGiven,
        requiresConsent: event.data.requiresConsent,
      });
    };

    window.addEventListener('message', onMessage);
    window.postMessage(
      { type: ARX_GET_LINKEDIN_COOKIE_SYNC_SETTINGS, requestId },
      window.location.origin,
    );
  });
}

/**
 * Ask extension to persist LinkedIn cookie sync consent (mirrors extension popup).
 */
export function setLinkedinCookieSyncConsentFromPage(
  consent: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const requestId = `arx-consent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      resolve({ ok: false, error: 'Timed out waiting for extension' });
    }, 15_000);

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) {
        return;
      }
      if (event.data?.type !== ARX_LINKEDIN_COOKIE_SYNC_CONSENT_RESULT) {
        return;
      }
      if (event.data.requestId !== requestId) {
        return;
      }
      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      resolve({
        ok: Boolean(event.data.ok),
        error:
          typeof event.data.error === 'string' ? event.data.error : undefined,
      });
    };

    window.addEventListener('message', onMessage);
    window.postMessage(
      {
        type: ARX_SET_LINKEDIN_COOKIE_SYNC_CONSENT,
        requestId,
        consent,
      },
      window.location.origin,
    );
  });
}

export type LinkedinUnipileSyncResult = {
  connected?: boolean;
  skipped?: boolean;
  error?: string;
  requiresConsent?: boolean;
  featureEnabled?: boolean;
};

const SYNC_RESPONSE_TIMEOUT_MS = 90_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Returns extension id from the content script if the Arx extension is injected on this page.
 */
export function pingArxChromeExtension(
  timeoutMs = 3000,
): Promise<string | null> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      resolve(null);
    }, timeoutMs);

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) {
        return;
      }
      if (event.data?.type === 'EXTENSION_PONG') {
        const id = event.data.extensionId;
        window.clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        resolve(typeof id === 'string' && id.trim() ? id.trim() : null);
      }
    };

    window.addEventListener('message', onMessage);
    window.postMessage(
      { type: 'EXTENSION_PING', timestamp: Date.now() },
      window.location.origin,
    );
  });
}

/**
 * Asks the extension background to run the same Unipile cookie sync as the extension popup.
 */
export function requestLinkedinUnipileSyncFromPage(): Promise<
  LinkedinUnipileSyncResult & { requestId: string }
> {
  const requestId = `arx-li-sync-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      resolve({
        requestId,
        connected: false,
        error: 'Timed out waiting for LinkedIn sync from extension',
      });
    }, SYNC_RESPONSE_TIMEOUT_MS);

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) {
        return;
      }
      if (event.data?.type !== ARX_LINKEDIN_UNIPILE_SYNC_RESULT) {
        return;
      }
      if (event.data.requestId !== requestId) {
        return;
      }
      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      const d = event.data as LinkedinUnipileSyncResult & {
        type?: string;
        requestId?: string;
      };
      resolve({
        requestId,
        connected: Boolean(d.connected),
        skipped: d.skipped,
        error: typeof d.error === 'string' ? d.error : undefined,
        requiresConsent: d.requiresConsent,
        featureEnabled: d.featureEnabled,
      });
    };

    window.addEventListener('message', onMessage);
    window.postMessage(
      { type: ARX_REQUEST_LINKEDIN_UNIPILE_SYNC, requestId },
      window.location.origin,
    );
  });
}

export type UnipileConnectionStatusResponse = {
  linkedinConnected: boolean;
  connectLinkedinToUnipileAutomatically: boolean;
};

export async function fetchUnipileConnectionStatus(
  accessToken: string,
  serverBaseUrl: string,
): Promise<UnipileConnectionStatusResponse | null> {
  const base = serverBaseUrl.replace(/\/$/, '');
  if (!base) {
    return null;
  }
  try {
    const res = await fetchWithRetry(
      `${base}/candidate-engagement/unipile-connection-status`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) {
      return null;
    }
    const json = (await res.json()) as {
      linkedinConnected?: boolean;
      connectLinkedinToUnipileAutomatically?: boolean;
    };
    return {
      linkedinConnected: Boolean(json.linkedinConnected),
      // Default to enabled when backend omits the field (older server versions).
      connectLinkedinToUnipileAutomatically:
        json.connectLinkedinToUnipileAutomatically ?? true,
    };
  } catch {
    return null;
  }
}

export async function fetchOrgChartLinkedinUnipileConnected(
  accessToken: string,
  serverBaseUrl: string,
): Promise<boolean | null> {
  const base = serverBaseUrl.replace(/\/$/, '');
  if (!base) {
    return null;
  }
  try {
    const res = await fetchWithRetry(
      `${base}/org-chart/linkedin-data-sources-status`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) {
      return null;
    }
    const json = (await res.json()) as {
      status?: string;
      linkedinUnipileConnected?: boolean;
    };
    if (json?.status !== 'ok') {
      return null;
    }
    return Boolean(json.linkedinUnipileConnected);
  } catch {
    return null;
  }
}

export type ExtensionLinkedinRecoveryResult = {
  ok: boolean;
  extensionPresent: boolean;
  syncAttempted: boolean;
};

/**
 * Ping extension → optional cookie sync → poll org-chart LinkedIn status until connected or attempts exhausted.
 * Used after login (background) and before org chart Unipile search (blocking).
 */
export async function tryExtensionLinkedinUnipileRecovery(options: {
  accessToken: string;
  serverBaseUrl: string;
}): Promise<ExtensionLinkedinRecoveryResult> {
  const { accessToken, serverBaseUrl } = options;
  const base = serverBaseUrl.replace(/\/$/, '');
  if (!base || !accessToken) {
    return { ok: false, extensionPresent: false, syncAttempted: false };
  }

  const extensionId = await pingArxChromeExtension(4000);
  if (!extensionId) {
    return { ok: false, extensionPresent: false, syncAttempted: false };
  }

  const orgChartConnectedInitial = await fetchOrgChartLinkedinUnipileConnected(
    accessToken,
    serverBaseUrl,
  );
  if (orgChartConnectedInitial === true) {
    return { ok: true, extensionPresent: true, syncAttempted: false };
  }

  const apiStatus = await fetchUnipileConnectionStatus(
    accessToken,
    serverBaseUrl,
  );
  if (
    apiStatus &&
    apiStatus.connectLinkedinToUnipileAutomatically === false
  ) {
    return { ok: false, extensionPresent: true, syncAttempted: false };
  }

  const syncResult = await requestLinkedinUnipileSyncFromPage();
  if (syncResult.skipped) {
    return { ok: false, extensionPresent: true, syncAttempted: true };
  }

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const connected = await fetchOrgChartLinkedinUnipileConnected(
      accessToken,
      serverBaseUrl,
    );
    if (connected === true) {
      return { ok: true, extensionPresent: true, syncAttempted: true };
    }
    await sleep(800);
  }

  const fallback = await fetchUnipileConnectionStatus(
    accessToken,
    serverBaseUrl,
  );
  if (fallback?.linkedinConnected) {
    return { ok: true, extensionPresent: true, syncAttempted: true };
  }

  return { ok: false, extensionPresent: true, syncAttempted: true };
}
