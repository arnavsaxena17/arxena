const TIMEOUT_MS = 30_000;

/**
 * Call any REST API under the Arxena server (candidate-sourcing, candidate-search, arx-chat, etc.).
 * pathPrefix is the first segment (e.g. 'candidate-sourcing'), endpoint is the rest (e.g. 'upload-profiles').
 * Sends POST with JSON body.
 */
export async function callRestAPI(
  baseUrl: string,
  apiToken: string,
  pathPrefix: string,
  endpoint: string,
  body: Record<string, unknown> = {},
): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = `${baseUrl}/${pathPrefix}/${endpoint}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`REST API call to /${pathPrefix}/${endpoint} failed: ${response.status} ${text}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function callCandidateSourcingRestAPI(
  baseUrl: string,
  apiToken: string,
  endpoint: string,
  body: Record<string, unknown> = {},
): Promise<unknown> {
  return callRestAPI(baseUrl, apiToken, 'candidate-sourcing', endpoint, body);
}
