const TIMEOUT_MS = 30_000;

export async function executeGraphQL<T>(
  baseUrl: string,
  apiToken: string,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  console.log('executeGraphQL', baseUrl, apiToken, query, variables);
  try {
    const response = await fetch(`${baseUrl}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GraphQL request failed: ${response.status} ${text}`);
    }

    const result = (await response.json()) as {
      data?: T;
      errors?: Array<{ message: string }>;
    };

    if (result.errors && result.errors.length > 0) {
      const messages = result.errors.map((e) => e.message).join('; ');
      throw new Error(`GraphQL errors: ${messages}`);
    }

    return result.data as T;
  } finally {
    clearTimeout(timeoutId);
  }
}
