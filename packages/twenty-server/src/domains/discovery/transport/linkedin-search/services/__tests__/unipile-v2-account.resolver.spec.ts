import { UnipileV2AccountResolver } from '../unipile-v2-account.resolver';

describe('UnipileV2AccountResolver', () => {
  const originalUrl = process.env.UNIPILE_API_URL_V2;
  const originalToken = process.env.UNIPILE_ACCESS_TOKEN_V2;
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.UNIPILE_API_URL_V2 = 'https://api.unipile.com';
    process.env.UNIPILE_ACCESS_TOKEN_V2 = 'v2-token';
    global.fetch = fetchMock as typeof fetch;
  });

  afterAll(() => {
    if (originalUrl === undefined) {
      delete process.env.UNIPILE_API_URL_V2;
    } else {
      process.env.UNIPILE_API_URL_V2 = originalUrl;
    }
    if (originalToken === undefined) {
      delete process.env.UNIPILE_ACCESS_TOKEN_V2;
    } else {
      process.env.UNIPILE_ACCESS_TOKEN_V2 = originalToken;
    }
  });

  it('returns v2 ids without listing accounts', async () => {
    const resolver = new UnipileV2AccountResolver();

    await expect(resolver.resolveAccountId('acc_already')).resolves.toBe(
      'acc_already',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps a v1 id using metadata.v1_account_id', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'acc_v2',
            metadata: { v1_account_id: 'tcUOzQ5hT9ycSvHIHQx0JA' },
          },
        ],
        has_more: false,
      }),
    });

    const resolver = new UnipileV2AccountResolver();

    await expect(
      resolver.resolveAccountId('tcUOzQ5hT9ycSvHIHQx0JA'),
    ).resolves.toBe('acc_v2');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.unipile.com/v2/accounts?provider=linkedin&limit=100&offset=0',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ 'X-API-KEY': 'v2-token' }),
      }),
    );
  });
});
