/**
 * JSON REST helpers for twenty-server (org-chart, candidate-search-chat).
 * Uses `fetch` so no extra lockfile deps are required; callers may switch to axios locally.
 * Set BACKEND_BASE_URL or TWENTY_SERVER_URL and E2E_API_TOKEN.
 */
export function getBackendBaseUrl(): string {
  const raw =
    process.env.BACKEND_BASE_URL ||
    process.env.TWENTY_SERVER_URL ||
    'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}

export function getE2eBearerHeaders(): Record<string, string> {
  const token = process.env.E2E_API_TOKEN?.trim() ?? '';
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'Content-Type': 'application/json',
    Accept: '*/*',
  };
}

function withTimeoutMs(ms: number): AbortSignal {
  const ac = new AbortController();
  setTimeout(() => ac.abort(), ms);
  return ac.signal;
}

export async function backendPostJson<T>(
  path: string,
  body: unknown,
): Promise<{ status: number; data: T }> {
  const url = `${getBackendBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getE2eBearerHeaders(),
    body: JSON.stringify(body),
    signal: withTimeoutMs(600_000),
  });
  const data = (await res.json()) as T;
  return { status: res.status, data };
}

export async function backendGetJson<T>(
  path: string,
): Promise<{ status: number; data: T }> {
  const url = `${getBackendBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: getE2eBearerHeaders(),
    signal: withTimeoutMs(120_000),
  });
  const data = (await res.json()) as T;
  return { status: res.status, data };
}
