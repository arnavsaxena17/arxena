const TIMEOUT_MS = 30_000;

function buildUrl(
  baseUrl: string,
  pathPrefix: string,
  endpoint: string,
  queryParams?: Record<string, string>,
): string {
  let url = `${baseUrl}/${pathPrefix}/${endpoint}`;
  if (queryParams && Object.keys(queryParams).length > 0) {
    url += `?${new URLSearchParams(queryParams).toString()}`;
  }
  return url;
}

/**
 * Call any REST API under the Arxena server with GET.
 * pathPrefix is the first segment (e.g. 'candidate-sourcing'), endpoint is the rest (e.g. 'upload-profiles').
 */
export async function callRestAPIGet(
  baseUrl: string,
  apiToken: string,
  pathPrefix: string,
  endpoint: string,
  queryParams?: Record<string, string>,
): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = buildUrl(baseUrl, pathPrefix, endpoint, queryParams);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `REST API call to /${pathPrefix}/${endpoint} failed: ${response.status} ${text}`,
      );
    }

    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Call any REST API under the Arxena server with POST.
 * pathPrefix is the first segment (e.g. 'candidate-sourcing'), endpoint is the rest (e.g. 'upload-profiles').
 * Optional queryParams are appended to the URL.
 */
export async function callRestAPI(
  baseUrl: string,
  apiToken: string,
  pathPrefix: string,
  endpoint: string,
  body: Record<string, unknown> = {},
  queryParams?: Record<string, string>,
): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = buildUrl(baseUrl, pathPrefix, endpoint, queryParams);
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
      throw new Error(
        `REST API call to /${pathPrefix}/${endpoint} failed: ${response.status} ${text}`,
      );
    }

    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}
