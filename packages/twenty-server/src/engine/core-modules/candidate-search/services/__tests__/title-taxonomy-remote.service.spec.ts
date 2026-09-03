import {
  TITLE_TAXONOMY_CLASSIFY_PROFILES_MAX,
  TITLE_TAXONOMY_CLASSIFY_TITLES_MAX,
  TitleTaxonomyRemoteService,
} from '../title-taxonomy-remote.service';

const jsonResponse = (status: number, body: unknown): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  }) as Response;

describe('TitleTaxonomyRemoteService', () => {
  const originalSiteUrl = process.env.ARXENA_SITE_URL;
  const originalOrgchartUrl = process.env.ARXENA_SITE_ORGCHART_URL;
  let service: TitleTaxonomyRemoteService;

  beforeEach(() => {
    process.env.ARXENA_SITE_URL = 'http://taxonomy.test';
    delete process.env.ARXENA_SITE_ORGCHART_URL;
    service = new TitleTaxonomyRemoteService();
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env.ARXENA_SITE_URL = originalSiteUrl;
    process.env.ARXENA_SITE_ORGCHART_URL = originalOrgchartUrl;
  });

  it('sends classifyProfiles in one request when under the 500-item cap', async () => {
    const profiles = Array.from({ length: 125 }, (_, index) => ({
      jobTitle: `Title ${index}`,
    }));
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async (_url, init) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          profiles?: Array<{ job_title: string }>;
        };
        const chunk = body.profiles ?? [];

        expect(chunk.length).toBeLessThanOrEqual(
          TITLE_TAXONOMY_CLASSIFY_PROFILES_MAX,
        );

        return jsonResponse(200, {
          items: chunk.map((profile) => ({
            title: profile.job_title,
            normalized_title: profile.job_title,
            function_root: null,
            function: null,
            grade: null,
            confidence: 0.5,
          })),
        });
      });

    const result = await service.classifyProfiles(profiles);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(125);
    expect(result?.[0].title).toBe('Title 0');
    expect(result?.[124].title).toBe('Title 124');
  });

  it('chunks classifyProfiles over the Python cap and concatenates results', async () => {
    const profiles = Array.from(
      { length: TITLE_TAXONOMY_CLASSIFY_PROFILES_MAX + 25 },
      (_, index) => ({
        jobTitle: `Title ${index}`,
      }),
    );
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async (_url, init) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          profiles?: Array<{ job_title: string }>;
        };
        const chunk = body.profiles ?? [];

        expect(chunk.length).toBeLessThanOrEqual(
          TITLE_TAXONOMY_CLASSIFY_PROFILES_MAX,
        );

        return jsonResponse(200, {
          items: chunk.map((profile) => ({
            title: profile.job_title,
            normalized_title: profile.job_title,
            function_root: null,
            function: null,
            grade: null,
            confidence: 0.5,
          })),
        });
      });

    const result = await service.classifyProfiles(profiles);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(TITLE_TAXONOMY_CLASSIFY_PROFILES_MAX + 25);

    const firstBody = JSON.parse(
      String(fetchMock.mock.calls[0]?.[1]?.body ?? '{}'),
    );
    const lastBody = JSON.parse(
      String(fetchMock.mock.calls[1]?.[1]?.body ?? '{}'),
    );
    const chunkSizes = [
      firstBody.profiles.length,
      lastBody.profiles.length,
    ].sort((a, b) => b - a);

    expect(chunkSizes).toEqual([TITLE_TAXONOMY_CLASSIFY_PROFILES_MAX, 25]);
  });

  it('chunks classifyTitles at the Python 200-item cap', async () => {
    const titles = Array.from({ length: 201 }, (_, index) => `Title ${index}`);
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async (_url, init) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          titles?: string[];
        };
        const chunk = body.titles ?? [];

        expect(chunk.length).toBeLessThanOrEqual(
          TITLE_TAXONOMY_CLASSIFY_TITLES_MAX,
        );

        return jsonResponse(200, {
          items: chunk.map((title) => ({
            title,
            normalized_title: title,
            function_root: null,
            function: null,
            grade: null,
            confidence: 0.5,
          })),
        });
      });

    const result = await service.classifyTitles(titles);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(201);
  });

  it('returns null when a classifyProfiles chunk fails', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse(200, {
          items: Array.from(
            { length: TITLE_TAXONOMY_CLASSIFY_PROFILES_MAX },
            () => ({
              title: 'ok',
              normalized_title: 'ok',
              function_root: null,
              function: null,
              grade: null,
              confidence: 0.5,
            }),
          ),
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(400, {
          error: `profiles must contain at most ${TITLE_TAXONOMY_CLASSIFY_PROFILES_MAX} items`,
        }),
      );

    const result = await service.classifyProfiles(
      Array.from(
        { length: TITLE_TAXONOMY_CLASSIFY_PROFILES_MAX + 1 },
        (_, index) => ({ jobTitle: `Title ${index}` }),
      ),
    );

    expect(result).toBeNull();
  });

  it('fetches a taxonomy slice by function_root', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        function_root: 'technology',
        functions: [{ id: 'software', label: 'software' }],
        grades: [{ id: 'director', label: 'director' }],
      }),
    );

    const result = await service.getTaxonomySlice('technology');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://taxonomy.test/api/title-taxonomy/slice?function_root=technology',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result?.function_root).toBe('technology');
    expect(result?.functions?.[0].id).toBe('software');
  });

  it('posts job_titles to the LLM classifier', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        classifications: [
          {
            title: 'CTO',
            function_root: 'technology',
            std_function: 'information technology',
            source: 'llm',
          },
        ],
      }),
    );

    const result = await service.classifyLlm({ jobTitles: ['CTO'] });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://taxonomy.test/api/llm-classifier/classify',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ job_titles: ['CTO'] }),
      }),
    );
    expect(result?.classifications?.[0].function_root).toBe('technology');
  });

  it('posts formatted profiles to the LLM classifier', async () => {
    const profile =
      'Name: Clare Ralston\nTitle: Creative Operations Consultant\n';
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        classifications: [
          {
            title: 'Creative Operations Consultant',
            profile,
            function_root: 'operations',
            source: 'llm',
          },
        ],
      }),
    );

    const result = await service.classifyLlm({ profiles: [profile] });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://taxonomy.test/api/llm-classifier/classify',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ profiles: [profile] }),
      }),
    );
    expect(result?.classifications?.[0].profile).toBe(profile);
  });
});
