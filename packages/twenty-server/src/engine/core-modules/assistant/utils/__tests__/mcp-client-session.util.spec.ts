import {
  buildMcpEndpointUrl,
  withMcpClient,
} from 'src/engine/core-modules/assistant/utils/mcp-client-session.util';

const mockConnect = jest.fn();
const mockClose = jest.fn();
const transportConstructor = jest.fn();

jest.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    close: mockClose,
  })),
}));

jest.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: jest
    .fn()
    .mockImplementation((...args: unknown[]) => {
      transportConstructor(...args);

      return {};
    }),
}));

describe('mcp client session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
    mockClose.mockResolvedValue(undefined);
  });

  it('should build the /mcp endpoint from the server base url', () => {
    expect(buildMcpEndpointUrl('https://app.example.com/').toString()).toBe(
      'https://app.example.com/mcp',
    );
    expect(buildMcpEndpointUrl('http://localhost:3000').toString()).toBe(
      'http://localhost:3000/mcp',
    );
  });

  it('should connect over HTTP with the api token as a Bearer header', async () => {
    await withMcpClient(
      { serverBaseUrl: 'https://app.example.com', apiToken: 'token\n' },
      undefined,
      async () => 'ok',
    );

    const [url, options] = transportConstructor.mock.calls[0];

    expect(String(url)).toBe('https://app.example.com/mcp');
    expect(options.requestInit.headers).toEqual({
      Authorization: 'Bearer token',
    });
  });

  it('should return the callback result and close the client', async () => {
    const result = await withMcpClient(
      { serverBaseUrl: 'http://localhost:3000', apiToken: 'token' },
      undefined,
      async () => 'done',
    );

    expect(result).toBe('done');
    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('should close the client when the callback throws', async () => {
    await expect(
      withMcpClient(
        { serverBaseUrl: 'http://localhost:3000', apiToken: 'token' },
        undefined,
        async () => {
          throw new Error('tool failed');
        },
      ),
    ).rejects.toThrow('tool failed');

    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('should not connect when already aborted', async () => {
    const controller = new AbortController();

    controller.abort();

    await expect(
      withMcpClient(
        { serverBaseUrl: 'http://localhost:3000', apiToken: 'token' },
        controller.signal,
        async () => 'unreachable',
      ),
    ).rejects.toThrow();

    expect(mockConnect).not.toHaveBeenCalled();
  });
});
