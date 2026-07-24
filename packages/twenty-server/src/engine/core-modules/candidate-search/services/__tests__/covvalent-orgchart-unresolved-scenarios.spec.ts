/**
 * Covvalent-shaped org-chart contexts → unresolved GeneratedSearchParameters.
 * Request bodies match `POST /org-chart/search` (see org-chart.controller.ts).
 * Router tests use mocks (no live Python API / LLM). Business division cases pass
 * parser-resolved keywords — production sets these via OrgChartIntentService
 * from `businessDivisionRawQuery`.
 *
 * Live Python (arxena-site): same base URL as `PythonQueryGenerationService` — default
 * `http://localhost:5050` (override with `ARXENA_SITE_URL` / `ARXENA_SITE_ORGCHART_URL`).
 *
 * Opt-in integration (costs $ / needs local services):
 * - `COVVALENT_ORGCHART_LIVE_PYTHON=1` — raw `fetch` to query-set + real
 *   `PythonQueryGenerationService.generateSearchParameters` (HTTP to Python).
 * - `COVVALENT_ORGCHART_LIVE_LLM=1` and `OPENAI_KEY` — real
 *   `LinkedinQueryGenerationService.generateSearchQuerySet` (multi-agent LLM).
 */
import { LinkedinQueryGenerationService } from 'src/engine/core-modules/linkedin-query-generation/services/linkedin-query-generation.service';
import type { SearchQuerySet } from 'src/engine/core-modules/linkedin-query-generation/types/linkedin-query-generation.types';
import { hasMeaningfulOrgChartFunctionRootFilter } from 'src/engine/core-modules/org-chart/utils/orgchart-filter.util';
import { WorkspaceQueryService } from '../../../workspace-modifications/workspace-modifications.service';
import type { GeneratedSearchParameters } from '../../types/candidate-search-request.type';
import { extractStrategiesFromGeneratedParams } from '../../utils/extract-strategies.util';
import { mapLinkedinSearchQueriesToGeneratedParameters } from '../../utils/linkedin-query-generation-mapper.util';
import { OrgchartLinkedInQueryRouterService } from '../orgchart-linkedin-query-router.service';
import type { PythonQueryInput } from '../python-query-generation.service';
import { PythonQueryGenerationService } from '../python-query-generation.service';
import { RequirementAnalyzerService } from '../requirement-analyzer.service';
import type { TitleTaxonomyRemoteService } from '../title-taxonomy-remote.service';

const API_TOKEN = 'test-api-token';
/** Matches org-chart UI / curls (lowercase company slug) */
const COVVALENT = 'covvalent';
const BASE_REQ = `Find people at ${COVVALENT}`;

/** Same shape as `@Post('search')` body in org-chart.controller.ts */
type OrgChartSearchHttpBody = {
  rawQuery: string;
  cleanedQuery: string;
  companyName?: string;
  companyId?: string;
  jobTitles?: string[];
  mode:
    | 'current_node'
    | 'leadership'
    | 'entire_company'
    | 'function_grade'
    | 'business_division_map'
    | 'selected_nodes';
  searchType?: 'classic' | 'sales_navigator' | 'recruiter';
  country?: string;
  functionRoot?: string;
  candidateSource?: string;
  linkedinCompanyUrl?: string;
  businessDivisionRawQuery?: string;
  queryGenerator?: 'python' | 'multi_agent';
};

/** Curls from org-chart UI — function_grade + HR, global */
const CURL_FUNCTION_GRADE_HR: OrgChartSearchHttpBody = {
  rawQuery:
    'Find people at covvalent in similar functions and seniority.',
  cleanedQuery:
    'Find people at covvalent in similar functions and seniority.',
  companyName: COVVALENT,
  companyId: COVVALENT,
  jobTitles: [],
  mode: 'function_grade',
  searchType: 'classic',
  country: 'global',
  functionRoot: 'human resources',
  candidateSource: 'unipile',
  linkedinCompanyUrl: 'https://www.linkedin.com/company/covvalent/',
  queryGenerator: 'python',
};

/** Business division map — NL division request */
const CURL_BUSINESS_DIVISION_CHEMICALS: OrgChartSearchHttpBody = {
  rawQuery:
    'Map business division at covvalent. User request: chemicals division',
  cleanedQuery:
    'Map business division at covvalent. User request: chemicals division',
  companyName: COVVALENT,
  companyId: COVVALENT,
  jobTitles: [],
  mode: 'business_division_map',
  searchType: 'classic',
  country: 'global',
  functionRoot: 'human resources',
  candidateSource: 'unipile',
  linkedinCompanyUrl: 'https://www.linkedin.com/company/covvalent/',
  businessDivisionRawQuery: 'chemicals division',
  queryGenerator: 'python',
};

const CURL_LEADERSHIP: OrgChartSearchHttpBody = {
  rawQuery: `Leadership at ${COVVALENT}`,
  cleanedQuery: `Leadership at ${COVVALENT}`,
  companyName: COVVALENT,
  companyId: COVVALENT,
  jobTitles: [],
  mode: 'leadership',
  searchType: 'classic',
  country: 'global',
  functionRoot: 'human resources',
  candidateSource: 'unipile',
  linkedinCompanyUrl: 'https://www.linkedin.com/company/covvalent/',
  queryGenerator: 'python',
};

/**
 * Mirrors country / all-people / division flags in
 * CandidateSearchHandlerService.generateUnresolvedSearchParams (org-chart branch)
 * and OrgChartSearchService.runOrgchartLinkedInSearch.
 */
function routerArgsFromOrgChartSearchBody(
  body: OrgChartSearchHttpBody,
  options?: {
    /** Set after OrgChartIntentService in production */
    businessDivisionLinkedinKeywords?: string;
  },
): Parameters<
  OrgchartLinkedInQueryRouterService['buildGeneratedSearchParametersForOrgchart']
>[0] {
  const primaryCompanyName = body.companyName?.trim() ?? '';
  let country = body.country?.trim() ?? '';
  if (country.toLowerCase() === 'global') {
    country = '';
  }
  const functionRoot = body.functionRoot?.trim() ?? '';
  const businessDivisionRaw = body.businessDivisionRawQuery?.trim();
  const hasAdditionalFilters =
    !!country || hasMeaningfulOrgChartFunctionRootFilter(functionRoot);
  const searchType = body.searchType ?? 'classic';
  const isAllPeopleInCompanyMode =
    searchType === 'classic' &&
    !!primaryCompanyName &&
    body.mode === 'entire_company' &&
    !hasAdditionalFilters &&
    !businessDivisionRaw;

  return {
    rawQuery: body.rawQuery,
    cleanedQuery: body.cleanedQuery,
    requirement: body.cleanedQuery || body.rawQuery,
    searchType,
    mode: body.mode,
    primaryCompanyName,
    jobTitles: body.jobTitles,
    country,
    functionRoot,
    businessDivisionLinkedinKeywords: options?.businessDivisionLinkedinKeywords,
    isAllPeopleInCompanyMode,
    apiToken: API_TOKEN,
    queryGenerator: body.queryGenerator,
  };
}

function buildMockPythonUnresolvedFromQuerySet(
  querySet: SearchQuerySet,
  requirement: string,
): GeneratedSearchParameters {
  return mapLinkedinSearchQueriesToGeneratedParameters(
    querySet,
    'classic',
    requirement,
  );
}

function logUnresolved(label: string, params: GeneratedSearchParameters): void {
  const strategies = extractStrategiesFromGeneratedParams(
    params,
    'classic',
    'people',
  );
  console.log(
    `[covvalent-unresolved] ${label} strategies=${strategies.length} firstCompany=${JSON.stringify(strategies[0]?.parameters?.company ?? [])}`,
  );
}

describe('Covvalent org-chart → unresolved (POST /org-chart/search fixtures)', () => {
  let linkedinQueryGenerationService: jest.Mocked<
    Pick<LinkedinQueryGenerationService, 'generateSearchQuerySet'>
  >;
  let pythonQueryGenerationService: jest.Mocked<
    Pick<PythonQueryGenerationService, 'generateSearchParameters'>
  >;
  let requirementAnalyzerService: jest.Mocked<
    Pick<RequirementAnalyzerService, 'analyzeRequirement'>
  >;
  let workspaceQueryService: jest.Mocked<
    Pick<
      WorkspaceQueryService,
      'getWorkspaceIdFromToken' | 'initializeLLMClients'
    >
  >;
  let titleTaxonomyRemoteService: jest.Mocked<
    Pick<TitleTaxonomyRemoteService, 'searchKeywordsFromQuery'>
  >;
  let service: OrgchartLinkedInQueryRouterService;

  beforeEach(() => {
    linkedinQueryGenerationService = { generateSearchQuerySet: jest.fn() };
    pythonQueryGenerationService = {
      generateSearchParameters: jest.fn(),
    };
    requirementAnalyzerService = {
      analyzeRequirement: jest.fn().mockResolvedValue({
        primary_role_name: 'Director',
        location: '',
        industry: '',
      }),
    };
    workspaceQueryService = {
      getWorkspaceIdFromToken: jest.fn().mockResolvedValue('ws-1'),
      initializeLLMClients: jest
        .fn()
        .mockResolvedValue({ openAIclient: {} }),
    };
    pythonQueryGenerationService.generateSearchParameters.mockImplementation(
      async (
        input: PythonQueryInput,
        _searchType: 'classic' | 'sales_navigator' | 'recruiter',
        requirement?: string,
      ) => {
        const qs: SearchQuerySet = {
          search_query_set: [
            {
              keywords: 'fixture-keywords',
              job_title: null,
              company: input.company_names?.length
                ? input.company_names
                : [COVVALENT],
              location: null,
              years_of_experience: null,
            },
          ],
        };
        return buildMockPythonUnresolvedFromQuerySet(
          qs,
          requirement ?? BASE_REQ,
        );
      },
    );
    linkedinQueryGenerationService.generateSearchQuerySet.mockResolvedValue({
      final_query_set: {
        search_query_set: [
          {
            keywords: 'fixture-llm',
            job_title: null,
            company: [COVVALENT],
            location: null,
            years_of_experience: null,
          },
        ],
      },
    } as Awaited<
      ReturnType<LinkedinQueryGenerationService['generateSearchQuerySet']>
    >);
    titleTaxonomyRemoteService = {
      searchKeywordsFromQuery: jest.fn().mockResolvedValue(null),
    };

    service = new OrgchartLinkedInQueryRouterService(
      linkedinQueryGenerationService as unknown as LinkedinQueryGenerationService,
      pythonQueryGenerationService as unknown as PythonQueryGenerationService,
      requirementAnalyzerService as unknown as RequirementAnalyzerService,
      workspaceQueryService as unknown as WorkspaceQueryService,
      titleTaxonomyRemoteService as unknown as TitleTaxonomyRemoteService,
    );
  });

  it('full company: company-only unresolved (deterministic / no LLM)', async () => {
    const params = await service.buildGeneratedSearchParametersForOrgchart({
      ...routerArgsFromOrgChartSearchBody({
        rawQuery: BASE_REQ,
        cleanedQuery: BASE_REQ,
        companyName: COVVALENT,
        companyId: COVVALENT,
        mode: 'entire_company',
        searchType: 'classic',
        country: 'global',
      }),
    });
    logUnresolved('covvalent_full_company', params);
    expect(params.classicPeopleSearch?.company).toEqual([COVVALENT]);
    expect(pythonQueryGenerationService.generateSearchParameters).not.toHaveBeenCalled();
  });

  it('function_grade (curl HR): Python query generator — function_root + company from body', async () => {
    await service.buildGeneratedSearchParametersForOrgchart({
      ...routerArgsFromOrgChartSearchBody({
        ...CURL_FUNCTION_GRADE_HR,
        queryGenerator: 'python',
      }),
    });
    const callArg = pythonQueryGenerationService.generateSearchParameters.mock
      .calls[0][0] as PythonQueryInput;
    expect(callArg.function_root).toEqual([
      { name: 'human resources', exclude: false },
    ]);
    expect(callArg.company_names).toEqual([COVVALENT]);
    console.log(
      '[covvalent-unresolved] function_grade python input',
      JSON.stringify(callArg),
    );
  });

  it('function_grade (curl HR): multi-agent — orchestrator receives cleanedQuery', async () => {
    await service.buildGeneratedSearchParametersForOrgchart({
      ...routerArgsFromOrgChartSearchBody({
        ...CURL_FUNCTION_GRADE_HR,
        queryGenerator: 'multi_agent',
      }),
    });
    expect(
      linkedinQueryGenerationService.generateSearchQuerySet,
    ).toHaveBeenCalledWith(CURL_FUNCTION_GRADE_HR.cleanedQuery, expect.any(Object));
    expect(
      pythonQueryGenerationService.generateSearchParameters,
    ).not.toHaveBeenCalled();
    console.log(
      '[covvalent-unresolved] function_grade multi_agent cleanedQuery=',
      CURL_FUNCTION_GRADE_HR.cleanedQuery,
    );
  });

  it('supply chain function_grade (Python): function_root + titles from body', async () => {
    await service.buildGeneratedSearchParametersForOrgchart({
      ...routerArgsFromOrgChartSearchBody({
        rawQuery: BASE_REQ,
        cleanedQuery: BASE_REQ,
        companyName: COVVALENT,
        companyId: COVVALENT,
        jobTitles: ['Supply Chain Director', 'Head of Supply Chain'],
        mode: 'function_grade',
        searchType: 'classic',
        country: 'global',
        functionRoot: 'Supply Chain',
        queryGenerator: 'python',
      }),
    });
    const callArg = pythonQueryGenerationService.generateSearchParameters.mock
      .calls[0][0] as PythonQueryInput;
    expect(callArg.function_root).toEqual([
      { name: 'Supply Chain', exclude: false },
    ]);
    expect(callArg.raw_job_titles).toEqual([
      'Supply Chain Director',
      'Head of Supply Chain',
    ]);
  });

  it('geo India: not all-people mode → Python path with country', async () => {
    const params = await service.buildGeneratedSearchParametersForOrgchart({
      ...routerArgsFromOrgChartSearchBody({
        rawQuery: BASE_REQ,
        cleanedQuery: BASE_REQ,
        companyName: COVVALENT,
        companyId: COVVALENT,
        mode: 'entire_company',
        searchType: 'classic',
        country: 'India',
        queryGenerator: 'python',
      }),
    });
    logUnresolved('covvalent_india_geo_python', params);
    expect(pythonQueryGenerationService.generateSearchParameters).toHaveBeenCalled();
  });

  it('business_division_map (curl): keywords + company after parser resolves division', async () => {
    const resolvedKw = '(chemicals) AND (division)';
    expect(CURL_BUSINESS_DIVISION_CHEMICALS.businessDivisionRawQuery).toBe(
      'chemicals division',
    );
    const params = await service.buildGeneratedSearchParametersForOrgchart({
      ...routerArgsFromOrgChartSearchBody(CURL_BUSINESS_DIVISION_CHEMICALS, {
        businessDivisionLinkedinKeywords: resolvedKw,
      }),
    });
    logUnresolved('covvalent_chemicals_division', params);
    expect(params.classicPeopleSearch?.company).toEqual([COVVALENT]);
    expect(params.classicPeopleSearch?.keywords).toBe(resolvedKw);
    expect(pythonQueryGenerationService.generateSearchParameters).not.toHaveBeenCalled();
  });

  it('leadership: multi-agent path uses cleanedQuery for orchestrator', async () => {
    const params = await service.buildGeneratedSearchParametersForOrgchart({
      ...routerArgsFromOrgChartSearchBody({
        ...CURL_LEADERSHIP,
        queryGenerator: 'multi_agent',
      }),
    });
    logUnresolved('covvalent_leadership_multi_agent', params);
    const orchestratorRaw =
      linkedinQueryGenerationService.generateSearchQuerySet.mock.calls[0][0];
    console.log(
      '[covvalent-unresolved] leadership multi_agent raw orchestrator string:',
      orchestratorRaw,
    );
    expect(orchestratorRaw).toBe(CURL_LEADERSHIP.cleanedQuery);
    expect(
      linkedinQueryGenerationService.generateSearchQuerySet,
    ).toHaveBeenCalledWith(
      CURL_LEADERSHIP.cleanedQuery,
      expect.objectContaining({
        verbose: expect.any(Boolean),
      }),
    );
    expect(
      pythonQueryGenerationService.generateSearchParameters,
    ).not.toHaveBeenCalled();
  });

  it('leadership: Python — grades leadership + company; requirement string passed to generator', async () => {
    await service.buildGeneratedSearchParametersForOrgchart({
      ...routerArgsFromOrgChartSearchBody({
        ...CURL_LEADERSHIP,
        queryGenerator: 'python',
      }),
    });
    const callArg = pythonQueryGenerationService.generateSearchParameters.mock
      .calls[0][0] as PythonQueryInput;
    expect(callArg.grades).toEqual([{ name: 'leadership', exclude: false }]);
    expect(callArg.company_names).toEqual([COVVALENT]);
    expect(callArg.function_root?.[0]?.name).toBe('human resources');
    const requirementArg =
      pythonQueryGenerationService.generateSearchParameters.mock.calls[0][2];
    expect(requirementArg).toBe(CURL_LEADERSHIP.cleanedQuery);
    console.log(
      '[covvalent-unresolved] leadership python requirement string:',
      requirementArg,
    );
  });

  it('SearchQuerySet (Python shape) maps to generateUnresolved-compatible classic strategies', () => {
    const querySet: SearchQuerySet = {
      search_query_set: [
        {
          keywords: 'engineer OR developer',
          job_title: null,
          company: [COVVALENT],
          location: null,
          years_of_experience: null,
        },
      ],
    };
    expectQuerySetMapsToClassicUnresolvedParams(querySet, BASE_REQ);
  });
});

const RUN_LIVE_PYTHON =
  process.env.COVVALENT_ORGCHART_LIVE_PYTHON === 'true' ||
  process.env.COVVALENT_ORGCHART_LIVE_PYTHON === '1';

const RUN_LIVE_LLM =
  process.env.COVVALENT_ORGCHART_LIVE_LLM === 'true' ||
  process.env.COVVALENT_ORGCHART_LIVE_LLM === '1';

const HAS_OPENAI_KEY = Boolean(process.env.OPENAI_KEY?.trim());

function livePythonBaseUrl(): string {
  const raw =
    process.env.ARXENA_SITE_ORGCHART_URL ??
    process.env.ARXENA_SITE_URL ??
    'http://localhost:5050';
  return raw.replace(/\/api\/orgchart\/build\/?$/, '').replace(/\/+$/, '');
}

/** Same paths as `PythonQueryGenerationService.generateLinkedInQuerySet` */
const LIVE_QUERY_SET_PATH = '/api/query-generator/linkedin/query-set';

/**
 * Mirrors `PythonQueryGenerationService.generateLinkedInQuerySet` response handling
 * (JSON → `SearchQuerySet`).
 */
function searchQuerySetFromPythonQuerySetApiJson(
  result: unknown,
): SearchQuerySet {
  const typed = result as {
    search_query_set?: Array<{
      keywords?: string | null;
      job_title?: string | null;
      company?: string[] | null;
      location?: string[] | null;
      years_of_experience?: string | null;
    }>;
  };
  const rows = Array.isArray(typed.search_query_set)
    ? typed.search_query_set
    : [];
  return {
    search_query_set: rows.map((row) => ({
      keywords: row.keywords ?? null,
      job_title: row.job_title ?? null,
      company: row.company ?? null,
      location: row.location ?? null,
      years_of_experience: row.years_of_experience ?? null,
    })),
  };
}

/**
 * Shape expected from `mapLinkedinSearchQueriesToGeneratedParameters` / org-chart
 * `generateUnresolvedSearchParams` (classic people strategies).
 */
function assertGeneratedClassicUnresolvedShape(
  generated: GeneratedSearchParameters,
): void {
  const strategies = extractStrategiesFromGeneratedParams(
    generated,
    'classic',
    'people',
  );
  expect(strategies.length).toBeGreaterThan(0);
  expect(generated.classicPeopleSearchStrategies?.length).toBe(strategies.length);

  for (const s of strategies) {
    expect(s.id.startsWith('linkedin-query-classic-')).toBe(true);
    expect(s.parameters).toBeDefined();
    const p = s.parameters as Record<string, unknown>;
    const hasKeywords =
      typeof p.keywords === 'string' && p.keywords.trim().length > 0;
    const hasCompany = Array.isArray(p.company) && p.company.length > 0;
    const hasLocation = Array.isArray(p.location) && p.location.length > 0;
    const adv = p.advanced_keywords;
    const hasTitle =
      adv !== undefined &&
      typeof adv === 'object' &&
      adv !== null &&
      'title' in adv;
    expect(hasKeywords || hasCompany || hasLocation || hasTitle).toBe(true);
  }

  console.log(
    `[covvalent-unresolved] generateUnresolved-compatible: ${strategies.length} classicPeopleSearchStrategies`,
  );
}

/**
 * Same mapping as `PythonQueryGenerationService.generateSearchParameters` →
 * `mapLinkedinSearchQueriesToGeneratedParameters`, which feeds unresolved params for
 * `generateUnresolvedSearchParams` / org-chart Python routing.
 */
function expectQuerySetMapsToClassicUnresolvedParams(
  querySet: SearchQuerySet,
  requirement: string,
): GeneratedSearchParameters {
  const generated = mapLinkedinSearchQueriesToGeneratedParameters(
    querySet,
    'classic',
    requirement,
  );
  assertGeneratedClassicUnresolvedShape(generated);
  return generated;
}

(RUN_LIVE_PYTHON ? describe : describe.skip)(
  'Live Python query-set @ arxena-site (localhost:5050)',
  () => {
    jest.setTimeout(60_000);

    it('function_grade HR + covvalent (matches org-chart curl payload)', async () => {
      const url = `${livePythonBaseUrl()}${LIVE_QUERY_SET_PATH}`;
      const body = {
        functions: [],
        grades: [],
        function_root: [{ name: 'human resources', exclude: false }],
        company_names: [COVVALENT],
        raw_job_titles: [] as string[],
      };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      console.log(
        `[covvalent-unresolved] live Python query-set HR status=${res.status} url=${url}`,
      );
      expect(res.ok).toBe(true);
      const parsed = JSON.parse(text) as unknown;
      const querySet = searchQuerySetFromPythonQuerySetApiJson(parsed);
      expect(querySet.search_query_set.length).toBeGreaterThan(0);
      expectQuerySetMapsToClassicUnresolvedParams(
        querySet,
        CURL_FUNCTION_GRADE_HR.cleanedQuery,
      );
    });

    it('leadership grade + covvalent + human resources function_root', async () => {
      const url = `${livePythonBaseUrl()}${LIVE_QUERY_SET_PATH}`;
      const body = {
        functions: [],
        grades: [{ name: 'leadership', exclude: false }],
        function_root: [{ name: 'human resources', exclude: false }],
        company_names: [COVVALENT],
        raw_job_titles: [] as string[],
      };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      console.log(
        `[covvalent-unresolved] live Python query-set leadership status=${res.status} url=${url}`,
      );
      expect(res.ok).toBe(true);
      const parsed = JSON.parse(text) as unknown;
      const querySet = searchQuerySetFromPythonQuerySetApiJson(parsed);
      expect(querySet.search_query_set.length).toBeGreaterThan(0);
      expectQuerySetMapsToClassicUnresolvedParams(
        querySet,
        CURL_LEADERSHIP.cleanedQuery,
      );
    });
  },
);

(RUN_LIVE_PYTHON ? describe : describe.skip)(
  'PythonQueryGenerationService (real HTTP to arxena-site)',
  () => {
    jest.setTimeout(90_000);

    let pythonService: PythonQueryGenerationService;

    beforeAll(() => {
      pythonService = new PythonQueryGenerationService();
    });

    it('generateSearchParameters: function_grade HR + covvalent (production code path)', async () => {
      const generated = await pythonService.generateSearchParameters(
        {
          company_names: [COVVALENT],
          function_root: [{ name: 'human resources', exclude: false }],
        },
        'classic',
        CURL_FUNCTION_GRADE_HR.cleanedQuery,
      );
      assertGeneratedClassicUnresolvedShape(generated);
      console.log(
        '[covvalent-unresolved] PythonQueryGenerationService HR generateSearchParameters OK',
      );
    });

    it('generateSearchParameters: leadership + covvalent + HR function_root', async () => {
      const generated = await pythonService.generateSearchParameters(
        {
          company_names: [COVVALENT],
          grades: [{ name: 'leadership', exclude: false }],
          function_root: [{ name: 'human resources', exclude: false }],
        },
        'classic',
        CURL_LEADERSHIP.cleanedQuery,
      );
      assertGeneratedClassicUnresolvedShape(generated);
      console.log(
        '[covvalent-unresolved] PythonQueryGenerationService leadership generateSearchParameters OK',
      );
    });
  },
);

(RUN_LIVE_LLM && HAS_OPENAI_KEY ? describe : describe.skip)(
  'LinkedinQueryGenerationService (real multi-agent LLM)',
  () => {
    jest.setTimeout(360_000);

    let linkedinQueryGenerationService: LinkedinQueryGenerationService;

    beforeAll(() => {
      linkedinQueryGenerationService = new LinkedinQueryGenerationService(null);
    });

    it('generateSearchQuerySet: function_grade HR cleanedQuery (org-chart text)', async () => {
      const orchestrator = await linkedinQueryGenerationService.generateSearchQuerySet(
        CURL_FUNCTION_GRADE_HR.cleanedQuery,
        { verbose: false },
      );
      expect(
        orchestrator.final_query_set.search_query_set.length,
      ).toBeGreaterThan(0);
      expectQuerySetMapsToClassicUnresolvedParams(
        orchestrator.final_query_set,
        CURL_FUNCTION_GRADE_HR.cleanedQuery,
      );
      console.log(
        `[covvalent-unresolved] LLM orchestrator queries=${orchestrator.final_query_set.search_query_set.length}`,
      );
    });

    it('generateSearchQuerySet: leadership cleanedQuery', async () => {
      const orchestrator = await linkedinQueryGenerationService.generateSearchQuerySet(
        CURL_LEADERSHIP.cleanedQuery,
        { verbose: false },
      );
      expect(
        orchestrator.final_query_set.search_query_set.length,
      ).toBeGreaterThan(0);
      expectQuerySetMapsToClassicUnresolvedParams(
        orchestrator.final_query_set,
        CURL_LEADERSHIP.cleanedQuery,
      );
      console.log(
        `[covvalent-unresolved] LLM leadership queries=${orchestrator.final_query_set.search_query_set.length}`,
      );
    });
  },
);

describe('TheOrg leadership (pipeline note)', () => {
  it('run-with-query uses orgChartDataSource theorg_enrich (no LinkedIn unresolved in this path)', () => {
    const request = {
      pipeline: 'org_chart' as const,
      orgChartDataSource: 'theorg_enrich' as const,
      companyId: 'covvalent',
      companyName: COVVALENT,
      mode: 'leadership' as const,
      prompt: 'Leadership at Covvalent',
    };
    expect(request.orgChartDataSource).toBe('theorg_enrich');
    console.log(
      '[covvalent-unresolved] theorg_leadership uses enrichment API, not LinkedIn query generator',
    );
  });
});
