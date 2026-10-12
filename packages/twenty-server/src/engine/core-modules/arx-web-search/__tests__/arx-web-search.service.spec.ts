import { ArxWebSearchService } from 'src/engine/core-modules/arx-web-search/arx-web-search.service';

const perplexityEvidence = {
  query: 'q',
  provider: 'perplexity' as const,
  costUsd: 0.005,
  aiOverview: null,
  snippets: [],
  text: 'x',
};

const serpPage = {
  organic: [{ title: 'A', link: 'https://a.com', description: 'B' }],
};

const buildService = ({
  perplexitySearch = jest.fn().mockResolvedValue(null),
  perplexityConfigured = true,
  serpRequest = jest.fn(),
  serpConfigured = true,
}: {
  perplexitySearch?: jest.Mock;
  perplexityConfigured?: boolean;
  serpRequest?: jest.Mock;
  serpConfigured?: boolean;
}) =>
  new ArxWebSearchService(
    {
      isConfigured: () => perplexityConfigured,
      search: perplexitySearch,
    } as never,
    {
      isConfigured: () => serpConfigured,
      requestSerpGoogleJson: serpRequest,
    } as never,
  );

describe('ArxWebSearchService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    delete process.env.ARX_WEB_SEARCH_BRIGHT_DATA_FALLBACK;
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should use Perplexity first and never touch Bright Data when it answers', async () => {
    const serpRequest = jest.fn();
    const service = buildService({
      perplexitySearch: jest.fn().mockResolvedValue(perplexityEvidence),
      serpRequest,
    });

    await expect(service.search('acme')).resolves.toMatchObject({
      provider: 'perplexity',
    });
    expect(serpRequest).not.toHaveBeenCalled();
  });

  it('should not call Bright Data unless the fallback is switched on', async () => {
    const serpRequest = jest.fn().mockResolvedValue(serpPage);

    await expect(
      buildService({ serpRequest }).search('acme'),
    ).resolves.toBeNull();
    expect(serpRequest).not.toHaveBeenCalled();
  });

  it('should fall back to the Google SERP when enabled, Perplexity gives nothing, and retry an empty SERP answer', async () => {
    process.env.ARX_WEB_SEARCH_BRIGHT_DATA_FALLBACK = 'true';
    const serpRequest = jest
      .fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce(serpPage);
    const promise = buildService({ serpRequest }).search('acme employees');

    await jest.runAllTimersAsync();

    await expect(promise).resolves.toMatchObject({
      provider: 'bright-data-serp',
      query: 'acme employees',
    });
    expect(serpRequest).toHaveBeenCalledTimes(2);
    expect(serpRequest.mock.calls[0][0]).toContain('brd_json=1');
    expect(serpRequest.mock.calls[0][0]).not.toContain('brd_ai_overview');
  });

  it('should skip providers that are not configured', async () => {
    const perplexitySearch = jest.fn();
    const service = buildService({
      perplexityConfigured: false,
      perplexitySearch,
      serpConfigured: false,
    });

    expect(service.isAvailable()).toBe(false);
    await expect(service.search('acme')).resolves.toBeNull();
    expect(perplexitySearch).not.toHaveBeenCalled();
  });

  it('should return null after exhausting every provider so the caller can fall back', async () => {
    process.env.ARX_WEB_SEARCH_BRIGHT_DATA_FALLBACK = 'true';
    const serpRequest = jest.fn().mockRejectedValue(new Error('HTTP 502'));
    const promise = buildService({ serpRequest }).search('acme');

    await jest.runAllTimersAsync();

    await expect(promise).resolves.toBeNull();
    expect(serpRequest).toHaveBeenCalledTimes(3);
  });

  it('should search the SERP alone, without the legacy flag or Perplexity snippets', async () => {
    const perplexitySearch = jest.fn().mockResolvedValue(perplexityEvidence);
    const serpRequest = jest.fn().mockResolvedValue(serpPage);
    const service = buildService({ perplexitySearch, serpRequest });

    await expect(
      service.search('acme employees', { serpOnly: true }),
    ).resolves.toMatchObject({ provider: 'bright-data-serp' });
    expect(perplexitySearch).not.toHaveBeenCalled();
    expect(service.isSerpAvailable()).toBe(true);
  });

  it('should report the SERP unavailable when Bright Data is not configured', async () => {
    const service = buildService({ serpConfigured: false });

    expect(service.isSerpAvailable()).toBe(false);
    await expect(
      service.search('acme', { serpOnly: true }),
    ).resolves.toBeNull();
  });
});
