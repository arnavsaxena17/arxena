export type ParsedMcpServerConfig = {
  label: string;
  slug: string;
  url: string;
  authHeaderName?: string;
  authToken?: string;
};

export type ParseMcpServersConfigResult = {
  servers: ParsedMcpServerConfig[];
  errors: string[];
};

type McpServerEntry = {
  url?: string;
  headers?: Record<string, string>;
  command?: string;
  args?: string[];
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);

const isHttpUrl = (value: string): boolean =>
  value.startsWith('http://') || value.startsWith('https://');

const parseHeaderFlagArgs = (args: string[]): Record<string, string> => {
  const headers: Record<string, string> = {};

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== '--header') {
      continue;
    }

    const rawHeader = args[index + 1];

    if (typeof rawHeader !== 'string') {
      continue;
    }

    const separatorIndex = rawHeader.indexOf(':');

    if (separatorIndex <= 0) {
      continue;
    }

    const headerName = rawHeader.slice(0, separatorIndex).trim();
    const headerValue = rawHeader.slice(separatorIndex + 1).trim();

    if (headerName !== '' && headerValue !== '') {
      headers[headerName] = headerValue;
    }
  }

  return headers;
};

const findRemoteUrlInArgs = (args: string[]): string | undefined =>
  args.find((arg) => isHttpUrl(arg));

const toAuthFields = (
  headers: Record<string, string>,
): Pick<ParsedMcpServerConfig, 'authHeaderName' | 'authToken'> => {
  const headerEntries = Object.entries(headers);

  if (headerEntries.length === 0) {
    return {};
  }

  if (headerEntries.length === 1) {
    const [headerName, headerValue] = headerEntries[0];

    return {
      authHeaderName: headerName,
      authToken: headerValue,
    };
  }

  // Multi-header auth is stored as a JSON map (connection manager supports this)
  return {
    authHeaderName: headerEntries[0][0],
    authToken: JSON.stringify(headers),
  };
};

const parseServerEntry = (
  label: string,
  entry: McpServerEntry,
): { server?: ParsedMcpServerConfig; error?: string } => {
  const slug = slugify(label);

  if (slug === '') {
    return { error: `Invalid server name "${label}"` };
  }

  if (typeof entry.url === 'string' && isHttpUrl(entry.url)) {
    const headers =
      entry.headers && typeof entry.headers === 'object' ? entry.headers : {};

    return {
      server: {
        label,
        slug,
        url: entry.url,
        ...toAuthFields(headers),
      },
    };
  }

  if (Array.isArray(entry.args)) {
    const remoteUrl = findRemoteUrlInArgs(entry.args);

    if (!remoteUrl) {
      return {
        error: `"${label}" uses a local command without an HTTP MCP URL. Only remote HTTP / mcp-remote servers are supported.`,
      };
    }

    return {
      server: {
        label,
        slug,
        url: remoteUrl,
        ...toAuthFields(parseHeaderFlagArgs(entry.args)),
      },
    };
  }

  return {
    error: `"${label}" must define either "url" or "command"/"args" with an HTTP MCP endpoint.`,
  };
};

export const parseMcpServersConfig = (
  rawJson: string,
): ParseMcpServersConfigResult => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawJson) as unknown;
  } catch {
    return { servers: [], errors: ['Invalid JSON'] };
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed) ||
    !('mcpServers' in parsed)
  ) {
    return {
      servers: [],
      errors: ['JSON must include a top-level "mcpServers" object'],
    };
  }

  const mcpServers = (parsed as { mcpServers: unknown }).mcpServers;

  if (
    !mcpServers ||
    typeof mcpServers !== 'object' ||
    Array.isArray(mcpServers)
  ) {
    return {
      servers: [],
      errors: ['"mcpServers" must be an object of named server configs'],
    };
  }

  const servers: ParsedMcpServerConfig[] = [];
  const errors: string[] = [];

  for (const [label, entry] of Object.entries(
    mcpServers as Record<string, unknown>,
  )) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`"${label}" config must be an object`);
      continue;
    }

    const result = parseServerEntry(label, entry as McpServerEntry);

    if (result.error) {
      errors.push(result.error);
      continue;
    }

    if (result.server) {
      servers.push(result.server);
    }
  }

  return { servers, errors };
};

export const MCP_SERVERS_CONFIG_PLACEHOLDER = `{
  "mcpServers": {
    "postman": {
      "url": "https://mcp.postman.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    },
    "example-remote": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://mcp.example.com",
        "--header",
        "x-api-key: YOUR_KEY"
      ]
    }
  }
}`;
