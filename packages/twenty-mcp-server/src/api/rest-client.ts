const TIMEOUT_MS = 90_000; // 90s — query-generation pipeline can take ~30–40s across 4 LLM agents

type HttpMethod = 'GET' | 'POST' | 'PATCH';

/** Minimal logger wrapper so MCP server calls are visible in logs. */
function logMcpRestCall(
  method: HttpMethod,
  url: string,
  status: number | 'ERROR',
  extra?: {
    pathPrefix?: string;
    endpoint?: string;
    queryParams?: Record<string, string>;
    requestBodyPreview?: unknown;
    errorMessage?: string;
  },
): void {
  // Avoid logging full bodies; stringify a small, safe preview instead.
  const bodyPreview =
    extra?.requestBodyPreview != null
      ? JSON.stringify(extra.requestBodyPreview).slice(0, 500)
      : undefined;

  // Use stderr so logs are visible in parent process without corrupting MCP stdio protocol
  // eslint-disable-next-line no-console
  console.error(
    JSON.stringify(
      {
        source: 'mcp-rest-client',
        method,
        url,
        status,
        pathPrefix: extra?.pathPrefix,
        endpoint: extra?.endpoint,
        queryParams: extra?.queryParams,
        requestBodyPreview: bodyPreview,
        errorMessage: extra?.errorMessage,
      },
    ),
  );
}

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

/** Header sent by MCP tools so the server can log and identify API calls from tools. */
export const MCP_REQUEST_SOURCE_HEADER = 'X-Request-Source';
export const MCP_REQUEST_SOURCE_VALUE = 'mcp';

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
        [MCP_REQUEST_SOURCE_HEADER]: MCP_REQUEST_SOURCE_VALUE,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      logMcpRestCall('GET', url, response.status, {
        pathPrefix,
        endpoint,
        queryParams,
        errorMessage: text,
      });
      throw new Error(
        `REST API call to /${pathPrefix}/${endpoint} failed: ${response.status} ${text}`,
      );
    }

    logMcpRestCall('GET', url, response.status, {
      pathPrefix,
      endpoint,
      queryParams,
    });

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
        [MCP_REQUEST_SOURCE_HEADER]: MCP_REQUEST_SOURCE_VALUE,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      logMcpRestCall('POST', url, response.status, {
        pathPrefix,
        endpoint,
        queryParams,
        requestBodyPreview: body,
        errorMessage: text,
      });
      throw new Error(
        `REST API call to /${pathPrefix}/${endpoint} failed: ${response.status} ${text}`,
      );
    }

    logMcpRestCall('POST', url, response.status, {
      pathPrefix,
      endpoint,
      queryParams,
      requestBodyPreview: body,
    });

    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Call any REST API with PATCH (e.g. update assistant thread with jobId).
 */
export async function callRestAPIPatch(
  baseUrl: string,
  apiToken: string,
  pathPrefix: string,
  endpoint: string,
  body: Record<string, unknown> = {},
): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = buildUrl(baseUrl, pathPrefix, endpoint);
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
        [MCP_REQUEST_SOURCE_HEADER]: MCP_REQUEST_SOURCE_VALUE,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      logMcpRestCall('PATCH', url, response.status, {
        pathPrefix,
        endpoint,
        requestBodyPreview: body,
        errorMessage: text,
      });
      throw new Error(
        `REST API PATCH /${pathPrefix}/${endpoint} failed: ${response.status} ${text}`,
      );
    }

    logMcpRestCall('PATCH', url, response.status, {
      pathPrefix,
      endpoint,
      requestBodyPreview: body,
    });

    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}
