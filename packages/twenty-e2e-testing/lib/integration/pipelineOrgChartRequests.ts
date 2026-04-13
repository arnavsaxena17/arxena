/**
 * POST /org-chart/search bodies aligned with OrgChartLinkedInBuildService SearchOrgchartLinkedInBody.
 *
 * Unipile matrix: 3 searchType × 2 queryGenerator × each entry in {@link ORG_CHART_SEARCH_MODES}.
 * — searchType: classic | sales_navigator | recruiter (Unipile LinkedIn search)
 * — queryGenerator: python | multi_agent
 * — mode: every value in {@link ORG_CHART_SEARCH_MODES}
 *
 * Apify / LinkedIn x-ray matrices use the same mode dimension as Unipile ({@link ORG_CHART_SEARCH_MODES}).
 * Apify returns HTTP 400 for modes other than entire_company; integration tests skip 400 (and 503) like Unipile.
 */
import { ORG_CHART_SEARCH_MODES, type OrgchartSearchMode } from 'twenty-shared';

export type { OrgchartSearchMode };

/** Alias for integration tests; same tuple as {@link ORG_CHART_SEARCH_MODES}. */
export const ORG_CHART_MODES_FULL = ORG_CHART_SEARCH_MODES;

export type OrgchartSearchType = 'classic' | 'sales_navigator' | 'recruiter';

export type QueryGenerator = 'python' | 'multi_agent';

export type CandidateSource = 'unipile' | 'apify' | 'linkedin_xray';

/**
 * POST body for arxena-site `/api/query-generator/linkedin` (+ `/query-set`), aligned with
 * `OrgchartLinkedInQueryRouterService.buildPythonQueryInputForOrgchartMode` and the
 * `functionRoot` / `jobTitles` from `buildOrgChartSearchBody` for each mode.
 */
export function buildPythonLinkedInRequestBodyForOrgchartMode(args: {
  companyName: string;
  mode: OrgchartSearchMode;
}): Record<string, unknown> {
  const stub = buildOrgChartSearchBody({
    companyName: args.companyName,
    companyId: 'e2e-pipeline',
    linkedinCompanyUrl: 'https://www.linkedin.com/company/e2e-pipeline/',
    mode: args.mode,
    searchType: 'classic',
    queryGenerator: 'python',
    candidateSource: 'unipile',
  });

  const functionRootStr = String(stub.functionRoot ?? '').trim();
  const stdFn = String(stub.stdFunction ?? '').trim();
  const stdGr = String(stub.stdGrade ?? '').trim();
  const jobTitles = Array.isArray(stub.jobTitles)
    ? stub.jobTitles.map((t) => String(t))
    : [];

  const scopesRaw = stub.selectedNodeStdScopes;
  const scopesFromBody = Array.isArray(scopesRaw)
    ? scopesRaw
        .map((s) => {
          const o = s as Record<string, unknown>;
          const sf =
            typeof o.stdFunction === 'string' ? o.stdFunction.trim() : '';
          const sg =
            typeof o.stdGrade === 'string' ? o.stdGrade.trim() : '';
          return {
            stdFunction: sf.length > 0 ? sf : undefined,
            stdGrade: sg.length > 0 ? sg : undefined,
          };
        })
        .filter(
          (s) =>
            (s.stdFunction?.length ?? 0) > 0 || (s.stdGrade?.length ?? 0) > 0,
        )
    : [];

  const nodeScope =
    args.mode === 'current_node' || args.mode === 'selected_nodes';
  const legacySingleScope =
    nodeScope && (stdFn.length > 0 || stdGr.length > 0) && scopesFromBody.length === 0
      ? [
          {
            stdFunction: stdFn.length > 0 ? stdFn : undefined,
            stdGrade: stdGr.length > 0 ? stdGr : undefined,
          },
        ]
      : [];

  const effectiveScopes =
    scopesFromBody.length > 0 ? scopesFromBody : legacySingleScope;

  const out: Record<string, unknown> = {
    functions: [] as Array<{ name: string; exclude?: boolean }>,
    grades: [] as Array<{ name: string; exclude?: boolean }>,
    function_root: [] as Array<{ name: string; exclude?: boolean }>,
    company_names: args.companyName ? [args.companyName] : [],
    raw_job_titles: [] as string[],
  };

  if (args.mode === 'selected_nodes' && effectiveScopes.length > 1) {
    if (jobTitles.length > 0) {
      out.raw_job_titles = jobTitles;
    }
  } else if (effectiveScopes.length === 1) {
    const s = effectiveScopes[0]!;
    if (s.stdFunction) {
      out.functions = [{ name: s.stdFunction, exclude: false }];
    }
    if (s.stdGrade) {
      out.grades = [{ name: s.stdGrade, exclude: false }];
    }
  } else if (functionRootStr.length > 0) {
    out.function_root = [{ name: functionRootStr, exclude: false }];
  }

  if (args.mode === 'leadership') {
    out.grades = [{ name: 'leadership', exclude: false }];
  } else if (args.mode === 'function_grade' && jobTitles.length > 0) {
    out.raw_job_titles = jobTitles;
  }

  return out;
}

export function getPythonOrgchartModeContractCases(): {
  index: number;
  mode: OrgchartSearchMode;
  label: string;
}[] {
  return ORG_CHART_MODES_FULL.map((mode, i) => ({
    index: i + 1,
    mode,
    label: `python/orgchart-mode/${mode}`,
  }));
}

export function makeOrgChartRequestId(): string {
  return `orgchart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export type OrgChartSearchBodyArgs = {
  companyName: string;
  companyId: string;
  linkedinCompanyUrl: string;
  mode: OrgchartSearchMode;
  searchType: OrgchartSearchType;
  queryGenerator: QueryGenerator;
  candidateSource: CandidateSource;
  requestId?: string;
  /** Apify max profiles; x-ray search engine */
  apifyMaxItems?: number;
  xraySearchEngine?: string;
};

/**
 * Full POST body for /org-chart/search (same semantics as browser curl; fixes broken `candidateSource` line in pasted curl).
 */
export function buildOrgChartSearchBody(args: OrgChartSearchBodyArgs): Record<string, unknown> {
  const requestId = args.requestId?.trim() || makeOrgChartRequestId();
  const { companyName, companyId, linkedinCompanyUrl, mode, searchType, queryGenerator, candidateSource } =
    args;

  const base: Record<string, unknown> = {
    rawQuery: `Find all people currently working at ${companyName}.`,
    cleanedQuery: `Find all people currently working at ${companyName}.`,
    companyName,
    companyId,
    jobTitles: [] as string[],
    mode,
    searchType,
    requestId,
    country: 'global',
    candidateSource,
    linkedinCompanyUrl,
    queryGenerator,
  };

  if (mode === 'function_grade') {
    base.functionRoot = 'human resources';
  } else if (mode === 'entire_company') {
    base.functionRoot = 'fullcompany';
  } else if (mode === 'leadership') {
    base.functionRoot = 'human resources';
  }

  if (mode === 'business_division_map') {
    base.rawQuery = `Map business division at ${companyName}. User request: chemicals division`;
    base.cleanedQuery = base.rawQuery;
    base.businessDivisionRawQuery = 'chemicals division';
    base.functionRoot = 'human resources';
  }

  if (mode === 'function_grade') {
    base.rawQuery = `Find people at ${companyName} in similar functions and seniority.`;
    base.cleanedQuery = base.rawQuery;
    base.functionRoot = 'human resources';
  }

  if (mode === 'current_node') {
    base.rawQuery = `Find people in the same position at ${companyName}. Key titles: Manufacturing AVP.`;
    base.cleanedQuery = base.rawQuery;
    base.jobTitles = ['Manufacturing AVP'];
    base.stdFunction = 'manufacturing';
    base.stdGrade = 'vp';
  }

  if (mode === 'leadership') {
    base.rawQuery = `Find leadership roles at ${companyName}.`;
    base.cleanedQuery = base.rawQuery;
    base.functionRoot = 'human resources';
  }

  if (mode === 'selected_nodes') {
    base.rawQuery = `Find people for the selected nodes at ${companyName}.`;
    base.cleanedQuery = base.rawQuery;
    base.jobTitles = ['Manufacturing AVP', 'Engineering Director'];
    base.selectedNodeStdScopes = [
      { stdFunction: 'manufacturing', stdGrade: 'vp' },
      { stdFunction: 'engineering', stdGrade: 'director' },
    ];
  }

  if (candidateSource === 'linkedin_xray') {
    base.xraySearchEngine = args.xraySearchEngine || process.env.E2E_XRAY_SEARCH_ENGINE || 'google';
  }

  if (candidateSource === 'apify') {
    base.apifyMaxItems = args.apifyMaxItems ?? Number(process.env.E2E_APIFY_MAX_ITEMS || 50);
  }

  return base;
}

export const UNIPILE_SEARCH_TYPES: readonly OrgchartSearchType[] = [
  'classic',
  'sales_navigator',
  'recruiter',
];

export const QUERY_GENERATORS: readonly QueryGenerator[] = ['multi_agent', 'python'];

export type UnipileOrgChartMatrixCase = {
  index: number;
  label: string;
  searchType: OrgchartSearchType;
  queryGenerator: QueryGenerator;
  mode: OrgchartSearchMode;
};

/**
 * Full POST /org-chart/search (Unipile) matrix: 3 search types × 2 generators × {@link ORG_CHART_SEARCH_MODES}.
 */
export function getUnipileOrgChartMatrixCases(): UnipileOrgChartMatrixCase[] {
  const out: UnipileOrgChartMatrixCase[] = [];
  let index = 0;
  for (const searchType of UNIPILE_SEARCH_TYPES) {
    for (const queryGenerator of QUERY_GENERATORS) {
      for (const mode of ORG_CHART_SEARCH_MODES) {
        index += 1;
        out.push({
          index,
          label: `unipile/${searchType}/${queryGenerator}/${mode}`,
          searchType,
          queryGenerator,
          mode,
        });
      }
    }
  }
  return out;
}

export type ApifyXrayOrgChartMatrixCase = {
  index: number;
  label: string;
  candidateSource: Extract<CandidateSource, 'apify' | 'linkedin_xray'>;
  searchType: OrgchartSearchType;
  queryGenerator: QueryGenerator;
  mode: OrgchartSearchMode;
};

/**
 * Apify: 3 search types × 2 generators × each {@link ORG_CHART_SEARCH_MODES} entry.
 */
export function getApifyOrgChartMatrixCases(): ApifyXrayOrgChartMatrixCase[] {
  return buildApifyXrayOrgChartMatrixCases('apify');
}

/**
 * LinkedIn x-ray: same shape as {@link getApifyOrgChartMatrixCases} for the other candidate source.
 */
export function getLinkedinXrayOrgChartMatrixCases(): ApifyXrayOrgChartMatrixCase[] {
  return buildApifyXrayOrgChartMatrixCases('linkedin_xray');
}

function buildApifyXrayOrgChartMatrixCases(
  candidateSource: 'apify' | 'linkedin_xray',
): ApifyXrayOrgChartMatrixCase[] {
  const out: ApifyXrayOrgChartMatrixCase[] = [];
  let index = 0;
  for (const searchType of UNIPILE_SEARCH_TYPES) {
    for (const queryGenerator of QUERY_GENERATORS) {
      for (const mode of ORG_CHART_SEARCH_MODES) {
        index += 1;
        out.push({
          index,
          label: `${candidateSource}/${searchType}/${queryGenerator}/${mode}`,
          candidateSource,
          searchType,
          queryGenerator,
          mode,
        });
      }
    }
  }
  return out;
}

/** Apify rejects non–entire_company modes (400). */
export function getApifyExpect400UnsupportedModeCases(): {
  label: string;
  mode: OrgchartSearchMode;
}[] {
  return [
    {
      label: 'apify/classic/multi_agent/function_grade (expect 400)',
      mode: 'function_grade',
    },
    {
      label: 'apify/classic/multi_agent/current_node (expect 400)',
      mode: 'current_node',
    },
  ];
}
