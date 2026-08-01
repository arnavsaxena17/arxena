import {
  parseMcpServersConfig,
} from '~/pages/settings/ai/utils/parseMcpServersConfig';

describe('parseMcpServersConfig', () => {
  it('parses url + headers configs', () => {
    const result = parseMcpServersConfig(
      JSON.stringify({
        mcpServers: {
          postman: {
            url: 'https://mcp.postman.com/mcp',
            headers: {
              Authorization: 'Bearer token',
            },
          },
        },
      }),
    );

    expect(result.errors).toEqual([]);
    expect(result.servers).toEqual([
      {
        label: 'postman',
        slug: 'postman',
        url: 'https://mcp.postman.com/mcp',
        authHeaderName: 'Authorization',
        authToken: 'Bearer token',
      },
    ]);
  });

  it('parses mcp-remote command configs with multiple headers', () => {
    const result = parseMcpServersConfig(
      JSON.stringify({
        mcpServers: {
          'Example Hub': {
            command: 'npx',
            args: [
              'mcp-remote',
              'https://mcp.example.com',
              '--header',
              'x-api-host: example.p.rapidapi.com',
              '--header',
              'x-api-key: secret',
            ],
          },
        },
      }),
    );

    expect(result.errors).toEqual([]);
    expect(result.servers).toHaveLength(1);
    expect(result.servers[0].url).toBe('https://mcp.example.com');
    expect(result.servers[0].slug).toBe('example_hub');
    expect(JSON.parse(result.servers[0].authToken ?? '{}')).toEqual({
      'x-api-host': 'example.p.rapidapi.com',
      'x-api-key': 'secret',
    });
  });

  it('rejects local-only command servers without an HTTP URL', () => {
    const result = parseMcpServersConfig(
      JSON.stringify({
        mcpServers: {
          'aws-mcp': {
            command: 'uvx',
            args: ['mcp-proxy-for-aws@latest', 'https://somewhere.amazonaws.com'],
          },
        },
      }),
    );

    // URL in args is still accepted as remote HTTP endpoint
    expect(result.errors).toEqual([]);
    expect(result.servers[0].url).toBe('https://somewhere.amazonaws.com');
  });

  it('returns a clear error for stdio without remote URL', () => {
    const result = parseMcpServersConfig(
      JSON.stringify({
        mcpServers: {
          local: {
            command: 'npx',
            args: ['some-local-mcp'],
          },
        },
      }),
    );

    expect(result.servers).toEqual([]);
    expect(result.errors[0]).toContain('local command without an HTTP MCP URL');
  });
});
