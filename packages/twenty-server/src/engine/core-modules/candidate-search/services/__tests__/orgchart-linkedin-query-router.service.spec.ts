/**
 * Org-chart modes → unresolved GeneratedSearchParameters (classic people).
 * Covers: simple company, business division, Python query generator, multi-agent LLM.
 */
import { LinkedinQueryGenerationService } from 'src/engine/core-modules/linkedin-query-generation/services/linkedin-query-generation.service';
import type { SearchQuerySet } from 'src/engine/core-modules/linkedin-query-generation/types/linkedin-query-generation.types';
import { WorkspaceQueryService } from '../../../workspace-modifications/workspace-modifications.service';
import type { GeneratedSearchParameters } from '../../types/candidate-search-request.type';
import {
    extractStrategiesFromGeneratedParams,
} from '../../utils/extract-strategies.util';
import { mapLinkedinSearchQueriesToGeneratedParameters } from '../../utils/linkedin-query-generation-mapper.util';
import { OrgchartLinkedInQueryRouterService } from '../orgchart-linkedin-query-router.service';
import type { PythonQueryInput } from '../python-query-generation.service';
import { PythonQueryGenerationService } from '../python-query-generation.service';
import { RequirementAnalyzerService } from '../requirement-analyzer.service';
import type { TitleTaxonomyRemoteService } from '../title-taxonomy-remote.service';

const API_TOKEN = 'test-api-token';
const COMPANY = 'Acme Corp';
const REQUIREMENT = `Find people at ${COMPANY}`;

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

function assertClassicUnresolvedShape(
  params: GeneratedSearchParameters,
  label: string,
): void {
  const hasPrimaryOrStrategies =
    params.classicPeopleSearch !== undefined ||
    (params.classicPeopleSearchStrategies?.length ?? 0) > 0;
  expect(hasPrimaryOrStrategies).toBe(true);
  if (!hasPrimaryOrStrategies) {
    throw new Error(
      `${label}: expected classicPeopleSearch and/or classicPeopleSearchStrategies`,
    );
  }
  const strategies = extractStrategiesFromGeneratedParams(
    params,
    'classic',
    'people',
  );
  expect(strategies.length).toBeGreaterThan(0);
  expect(strategies[0].parameters).toBeDefined();
  console.log(
    `[orgchart-unresolved-test] ${label} strategies=${strategies.length} firstId=${strategies[0].id}`,
  );
}

describe('OrgchartLinkedInQueryRouterService', () => {
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
    linkedinQueryGenerationService = {
      generateSearchQuerySet: jest.fn(),
    };
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

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveGeneratorPreference', () => {
    it('returns python when preference is python', () => {
      expect(service.resolveGeneratorPreference('python')).toBe('python');
    });
    it('returns multi_agent when preference is multi_agent', () => {
      expect(service.resolveGeneratorPreference('multi_agent')).toBe(
        'multi_agent',
      );
    });
    it('defaults to python when preference is undefined', () => {
      expect(service.resolveGeneratorPreference(undefined)).toBe('python');
    });
  });

  describe('buildPythonQueryInputForOrgchartMode', () => {
    it('adds leadership grade for leadership mode', () => {
      const input = service.buildPythonQueryInputForOrgchartMode({
        mode: 'leadership',
        primaryCompanyName: COMPANY,
        functionRoot: '',
      });
      expect(input.grades).toEqual([{ name: 'leadership', exclude: false }]);
      expect(input.company_names).toEqual([COMPANY]);
    });

    it('adds function_root and raw_job_titles for function_grade', () => {
      const input = service.buildPythonQueryInputForOrgchartMode({
        mode: 'function_grade',
        primaryCompanyName: COMPANY,
        functionRoot: 'Engineering',
        jobTitles: ['Staff Engineer', 'Principal Engineer'],
      });
      expect(input.function_root).toEqual([
        { name: 'Engineering', exclude: false },
      ]);
      expect(input.raw_job_titles).toEqual([
        'Staff Engineer',
        'Principal Engineer',
      ]);
    });

    it('uses stdFunction/stdGrade for current_node and omits function_root', () => {
      const input = service.buildPythonQueryInputForOrgchartMode({
        mode: 'current_node',
        primaryCompanyName: COMPANY,
        functionRoot: 'human resources',
        stdFunction: 'manufacturing',
        stdGrade: 'vp',
      });
      expect(input.function_root).toBeUndefined();
      expect(input.functions).toEqual([{ name: 'manufacturing', exclude: false }]);
      expect(input.grades).toEqual([{ name: 'vp', exclude: false }]);
    });
  });

  describe('buildGeneratedSearchParametersForOrgchart — no generator (company / division)', () => {
    it('entire_company: unresolved params are company-only classic search', async () => {
      const params = await service.buildGeneratedSearchParametersForOrgchart({
        rawQuery: REQUIREMENT,
        cleanedQuery: REQUIREMENT,
        requirement: REQUIREMENT,
        searchType: 'classic',
        mode: 'entire_company',
        primaryCompanyName: COMPANY,
        country: '',
        functionRoot: '',
        isAllPeopleInCompanyMode: true,
        apiToken: API_TOKEN,
      });
      assertClassicUnresolvedShape(params, 'entire_company');
      expect(params.classicPeopleSearch?.company).toEqual([COMPANY.toLowerCase()]);
    });

    it('business_division_map: unresolved params include keywords + company', async () => {
      const kw = '(passenger) AND (vehicles)';
      const params = await service.buildGeneratedSearchParametersForOrgchart({
        rawQuery: REQUIREMENT,
        cleanedQuery: REQUIREMENT,
        requirement: REQUIREMENT,
        searchType: 'classic',
        mode: 'business_division_map',
        primaryCompanyName: COMPANY,
        country: '',
        functionRoot: '',
        businessDivisionLinkedinKeywords: kw,
        isAllPeopleInCompanyMode: false,
        apiToken: API_TOKEN,
      });
      assertClassicUnresolvedShape(params, 'business_division_map');
      expect(params.classicPeopleSearch?.company).toEqual([COMPANY.toLowerCase()]);
      expect(params.classicPeopleSearch?.keywords).toBe(kw);
    });

    it('business_division_map + sales_navigator: unresolved uses Sales Nav strategy shape', async () => {
      const kw = '(passenger) AND (vehicles)';
      const params = await service.buildGeneratedSearchParametersForOrgchart({
        rawQuery: REQUIREMENT,
        cleanedQuery: REQUIREMENT,
        requirement: REQUIREMENT,
        searchType: 'sales_navigator',
        mode: 'business_division_map',
        primaryCompanyName: COMPANY,
        country: '',
        functionRoot: '',
        businessDivisionLinkedinKeywords: kw,
        isAllPeopleInCompanyMode: false,
        apiToken: API_TOKEN,
      });
      expect(params.salesNavigatorPeopleSearchStrategies?.length).toBe(1);
      const first = params.salesNavigatorPeopleSearchStrategies?.[0];
      expect(first?.parameters.company).toEqual({
        include: [COMPANY.toLowerCase()],
      });
      expect(first?.parameters.keywords).toBe(kw);
    });

    it('business_division_map + recruiter: unresolved uses Recruiter strategy shape', async () => {
      const kw = '(passenger) AND (vehicles)';
      const params = await service.buildGeneratedSearchParametersForOrgchart({
        rawQuery: REQUIREMENT,
        cleanedQuery: REQUIREMENT,
        requirement: REQUIREMENT,
        searchType: 'recruiter',
        mode: 'business_division_map',
        primaryCompanyName: COMPANY,
        country: '',
        functionRoot: '',
        businessDivisionLinkedinKeywords: kw,
        isAllPeopleInCompanyMode: false,
        apiToken: API_TOKEN,
      });
      expect(params.recruiterPeopleSearchStrategies?.length).toBe(1);
      const first = params.recruiterPeopleSearchStrategies?.[0];
      expect(first?.parameters.company?.[0]).toEqual({
        keywords: COMPANY.toLowerCase(),
      });
      expect(first?.parameters.keywords).toBe(kw);
    });
  });

  describe('buildGeneratedSearchParametersForOrgchart — Python (deterministic) → unresolved', () => {
    beforeEach(() => {
      pythonQueryGenerationService.generateSearchParameters.mockImplementation(
        async (input: PythonQueryInput) => {
          const qs: SearchQuerySet = {
            search_query_set: [
              {
                keywords: input.grades?.some((g) => g.name === 'leadership')
                  ? 'leadership OR director OR vp'
                  : 'engineer',
                job_title: null,
                company: input.company_names ?? [COMPANY],
                location: null,
                years_of_experience: null,
              },
            ],
          };
          return buildMockPythonUnresolvedFromQuerySet(qs, REQUIREMENT);
        },
      );
    });

    it('leadership: Python path produces classic unresolved with strategies', async () => {
      const params = await service.buildGeneratedSearchParametersForOrgchart({
        rawQuery: REQUIREMENT,
        cleanedQuery: REQUIREMENT,
        requirement: REQUIREMENT,
        searchType: 'classic',
        mode: 'leadership',
        primaryCompanyName: COMPANY,
        country: '',
        functionRoot: '',
        isAllPeopleInCompanyMode: false,
        apiToken: API_TOKEN,
        queryGenerator: 'python',
      });
      assertClassicUnresolvedShape(params, 'leadership-python');
      expect(pythonQueryGenerationService.generateSearchParameters).toHaveBeenCalled();
      const callArg = pythonQueryGenerationService.generateSearchParameters.mock
        .calls[0][0] as PythonQueryInput;
      expect(callArg.grades).toEqual([{ name: 'leadership', exclude: false }]);
      expect(callArg.company_names).toEqual([COMPANY]);
    });

    it('function_grade: Python receives function_root and job titles', async () => {
      await service.buildGeneratedSearchParametersForOrgchart({
        rawQuery: REQUIREMENT,
        cleanedQuery: REQUIREMENT,
        requirement: REQUIREMENT,
        searchType: 'classic',
        mode: 'function_grade',
        primaryCompanyName: COMPANY,
        jobTitles: ['Director', 'VP'],
        country: 'in',
        functionRoot: 'Engineering',
        isAllPeopleInCompanyMode: false,
        apiToken: API_TOKEN,
        queryGenerator: 'python',
      });
      const callArg = pythonQueryGenerationService.generateSearchParameters.mock
        .calls[0][0] as PythonQueryInput;
      expect(callArg.function_root).toEqual([
        { name: 'Engineering', exclude: false },
      ]);
      expect(callArg.raw_job_titles).toEqual(['Director', 'VP']);
    });

    it('current_node: Python path yields unresolved params', async () => {
      const params = await service.buildGeneratedSearchParametersForOrgchart({
        rawQuery: REQUIREMENT,
        cleanedQuery: REQUIREMENT,
        requirement: REQUIREMENT,
        searchType: 'classic',
        mode: 'current_node',
        primaryCompanyName: COMPANY,
        jobTitles: ['Product Manager'],
        country: '',
        functionRoot: 'Product',
        isAllPeopleInCompanyMode: false,
        apiToken: API_TOKEN,
        queryGenerator: 'python',
      });
      assertClassicUnresolvedShape(params, 'current_node-python');
    });

    it('selected_nodes: Python path yields unresolved params', async () => {
      const params = await service.buildGeneratedSearchParametersForOrgchart({
        rawQuery: REQUIREMENT,
        cleanedQuery: REQUIREMENT,
        requirement: REQUIREMENT,
        searchType: 'classic',
        mode: 'selected_nodes',
        primaryCompanyName: COMPANY,
        jobTitles: ['CFO', 'Finance Director'],
        country: '',
        functionRoot: 'Finance',
        isAllPeopleInCompanyMode: false,
        apiToken: API_TOKEN,
        queryGenerator: 'python',
      });
      assertClassicUnresolvedShape(params, 'selected_nodes-python');
    });
  });

  describe('buildGeneratedSearchParametersForOrgchart — multi-agent LLM → unresolved', () => {
    beforeEach(() => {
      linkedinQueryGenerationService.generateSearchQuerySet.mockResolvedValue({
        final_query_set: {
          search_query_set: [
            {
              keywords: 'strategy OR planning',
              job_title: null,
              company: [COMPANY],
              location: null,
              years_of_experience: null,
            },
          ],
        },
      } as Awaited<
        ReturnType<LinkedinQueryGenerationService['generateSearchQuerySet']>
      >);
    });

    it('leadership: multi-agent path maps orchestrator output to unresolved params', async () => {
      const params = await service.buildGeneratedSearchParametersForOrgchart({
        rawQuery: REQUIREMENT,
        cleanedQuery: REQUIREMENT,
        requirement: REQUIREMENT,
        searchType: 'classic',
        mode: 'leadership',
        primaryCompanyName: COMPANY,
        country: '',
        functionRoot: '',
        isAllPeopleInCompanyMode: false,
        apiToken: API_TOKEN,
        queryGenerator: 'multi_agent',
      });
      assertClassicUnresolvedShape(params, 'leadership-multi-agent');
      expect(
        linkedinQueryGenerationService.generateSearchQuerySet,
      ).toHaveBeenCalled();
      expect(requirementAnalyzerService.analyzeRequirement).toHaveBeenCalled();
      expect(
        pythonQueryGenerationService.generateSearchParameters,
      ).not.toHaveBeenCalled();
    });

    it('current_node: multi-agent path yields unresolved params', async () => {
      const params = await service.buildGeneratedSearchParametersForOrgchart({
        rawQuery: REQUIREMENT,
        cleanedQuery: REQUIREMENT,
        requirement: REQUIREMENT,
        searchType: 'classic',
        mode: 'current_node',
        primaryCompanyName: COMPANY,
        jobTitles: ['Head of Sales'],
        country: '',
        functionRoot: '',
        isAllPeopleInCompanyMode: false,
        apiToken: API_TOKEN,
        queryGenerator: 'multi_agent',
      });
      assertClassicUnresolvedShape(params, 'current_node-multi-agent');
    });
  });

  describe('round-trip: extractStrategies matches attachPeopleStrategies output', () => {
    it('Python-mapped query set round-trips through extractStrategiesFromGeneratedParams', () => {
      const qs: SearchQuerySet = {
        search_query_set: [
          {
            keywords: 'test',
            job_title: 'Role',
            company: [COMPANY],
            location: null,
            years_of_experience: null,
          },
        ],
      };
      const generated = buildMockPythonUnresolvedFromQuerySet(qs, REQUIREMENT);
      const strategies = extractStrategiesFromGeneratedParams(
        generated,
        'classic',
        'people',
      );
      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies[0].parameters).toBeDefined();
    });
  });
});
