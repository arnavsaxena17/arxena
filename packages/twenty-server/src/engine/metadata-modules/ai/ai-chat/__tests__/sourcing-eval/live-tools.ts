// Capped live tool proxy for the sourcing eval. Calls the running server's
// MCP execute_tool endpoint so Nest action tools and Arxena search tools hit
// the real backend (tab, Bright Data, LinkedIn, AI columns).

import {
  GENERATE_LINKEDIN_QUERY_SET_TOOL_NAME,
  OUTREACH_LIST_TOOL_NAME,
  SEARCH_BRIGHT_DATA_BUSINESS_TOOL_NAME,
  SEARCH_LINKEDIN_COMPANIES_TOOL_NAME,
  SEARCH_LINKEDIN_CONTINUE_TOOL_NAME,
  SEARCH_LINKEDIN_PARAMETERS_TOOL_NAME,
  SEARCH_LINKEDIN_PEOPLE_TOOL_NAME,
} from 'src/engine/core-modules/arxena-tools/constants/arxena-tool-names.const';

export const LIVE_BACKEND = process.env.SOURCING_EVAL_LIVE_BACKEND === '1';

const CAP_ROWS = 25;
const BD_MAX_BUDGET_USD = 0.05; // ~25 × $0.002
const FIND_ROLE_MAX_BUDGET_PER_COMPANY_USD = 0.04;
const FIND_ROLE_MAX_CALLS = 2; // one full + one onlyFailed
const AI_COLUMN_ROW_LIMIT = 25;

export type LiveToolConfig = {
  baseUrl: string;
  apiToken: string;
  projectId: string;
};

export type LiveCapState = {
  brightDataCompanyFetches: number;
  brightDataPeopleFetches: number;
  linkedInRows: number;
  findPeopleCalls: number;
  findPeopleOnlyFailedCalls: number;
};

export const createLiveCapState = (): LiveCapState => ({
  brightDataCompanyFetches: 0,
  brightDataPeopleFetches: 0,
  linkedInRows: 0,
  findPeopleCalls: 0,
  findPeopleOnlyFailedCalls: 0,
});

export const readLiveToolConfig = (): LiveToolConfig | null => {
  if (!LIVE_BACKEND) {
    return null;
  }

  const baseUrl = (
    process.env.SOURCING_EVAL_BASE_URL ?? 'http://localhost:3000'
  ).replace(/\/$/, '');
  const apiToken = process.env.SOURCING_EVAL_API_TOKEN?.trim();
  const projectId = process.env.SOURCING_EVAL_PROJECT_ID?.trim();

  if (!apiToken || !projectId) {
    throw new Error(
      'SOURCING_EVAL_LIVE_BACKEND=1 requires SOURCING_EVAL_API_TOKEN and SOURCING_EVAL_PROJECT_ID',
    );
  }

  return { baseUrl, apiToken, projectId };
};

export const LIVE_CAPPED_SETUP_NOTE = [
  `Live capped eval: projectId is fixed. Bright Data company fetch ≤${CAP_ROWS} rows / $${BD_MAX_BUDGET_USD}; Bright Data people fetch ≤${CAP_ROWS} / $${BD_MAX_BUDGET_USD}; LinkedIn ≤${CAP_ROWS} rows total; find_people_by_company ≤${CAP_ROWS} companies and maxBudgetUsd ≤$${FIND_ROLE_MAX_BUDGET_PER_COMPANY_USD} per company (one full call + one onlyFailed); AI columns rowLimit ≤${AI_COLUMN_ROW_LIMIT}.`,
  'Prefer company-first: Bright Data companies → enrich oncology manufacture → find_people_by_company for sales/medical/territory/field reps → score and rank a shortlist of about 25.',
].join(' ');

const LIVE_ALLOWLIST = new Set([
  SEARCH_BRIGHT_DATA_BUSINESS_TOOL_NAME,
  OUTREACH_LIST_TOOL_NAME,
  'get_outreach_tab',
  'get_sourcing_ledger',
  'find_people_by_company',
  'fetch_profiles',
  'preview_ai_column',
  'run_ai_column',
  'get_ai_column_run_status',
  'generate_table_view',
  'apply_table_view',
  SEARCH_LINKEDIN_PEOPLE_TOOL_NAME,
  SEARCH_LINKEDIN_COMPANIES_TOOL_NAME,
  SEARCH_LINKEDIN_CONTINUE_TOOL_NAME,
  SEARCH_LINKEDIN_PARAMETERS_TOOL_NAME,
  GENERATE_LINKEDIN_QUERY_SET_TOOL_NAME,
]);

export const isLiveAllowlisted = (toolName: string): boolean =>
  LIVE_ALLOWLIST.has(toolName);

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};

const numberOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const mcpExecute = async (
  config: LiveToolConfig,
  toolName: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const response = await fetch(`${config.baseUrl}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiToken}`,
      Accept: 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: `sourcing-eval-${Date.now()}`,
      method: 'tools/call',
      params: {
        name: 'execute_tool',
        arguments: { toolName, arguments: args },
      },
    }),
  });

  const text = await response.text();
  let body: Record<string, unknown>;

  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(
      `MCP ${toolName} returned non-JSON (${response.status}): ${text.slice(0, 500)}`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `MCP ${toolName} HTTP ${response.status}: ${text.slice(0, 500)}`,
    );
  }

  if (body.error !== undefined) {
    const error = asRecord(body.error);

    throw new Error(
      `MCP ${toolName} error: ${String(error.message ?? JSON.stringify(body.error))}`,
    );
  }

  const result = asRecord(body.result);
  const content = Array.isArray(result.content) ? result.content : [];
  const first = asRecord(content[0]);
  const payloadText = typeof first.text === 'string' ? first.text : '{}';

  try {
    const parsed = JSON.parse(payloadText) as Record<string, unknown>;

    if (parsed.success === false) {
      return {
        ok: false,
        error: String(parsed.error ?? parsed.message ?? 'tool failed'),
        message: parsed.message,
        result: parsed.result,
      };
    }

    if (parsed.result !== undefined && typeof parsed.result === 'object') {
      return asRecord(parsed.result);
    }

    return parsed;
  } catch {
    return { raw: payloadText };
  }
};

const withProjectId = (
  args: Record<string, unknown>,
  projectId: string,
): Record<string, unknown> =>
  args.projectId === undefined || args.projectId === 'proj_001'
    ? { ...args, projectId }
    : args;

const capBrightData = (
  args: Record<string, unknown>,
  state: LiveCapState,
): Record<string, unknown> | { error: string } => {
  const entity = String(args.entity ?? '');
  const isFetch =
    typeof args.listId === 'string' ||
    args.autoExecute === true ||
    typeof args.maxBudgetUsd === 'number';

  if (!isFetch) {
    // Estimate: strip projectId so nothing is written yet
    const { projectId: _projectId, ...estimateArgs } = args;

    return {
      ...estimateArgs,
      limit: Math.min(numberOr(args.limit, CAP_ROWS), CAP_ROWS),
    };
  }

  if (entity === 'company') {
    if (state.brightDataCompanyFetches >= 1) {
      return {
        error: `Live cap: only one Bright Data company fetch (≤${CAP_ROWS} rows) allowed per run`,
      };
    }

    state.brightDataCompanyFetches += 1;
  } else if (entity === 'people') {
    if (state.brightDataPeopleFetches >= 1) {
      return {
        error: `Live cap: only one Bright Data people fetch (≤${CAP_ROWS} rows) allowed per run`,
      };
    }

    state.brightDataPeopleFetches += 1;
  }

  return {
    ...args,
    targetCount: Math.min(numberOr(args.targetCount, CAP_ROWS), CAP_ROWS),
    limit: Math.min(numberOr(args.limit, CAP_ROWS), CAP_ROWS),
    maxBudgetUsd: Math.min(
      numberOr(args.maxBudgetUsd, BD_MAX_BUDGET_USD),
      BD_MAX_BUDGET_USD,
    ),
  };
};

const capLinkedIn = (
  toolName: string,
  args: Record<string, unknown>,
  state: LiveCapState,
): Record<string, unknown> | { error: string } => {
  const remaining = CAP_ROWS - state.linkedInRows;

  if (remaining <= 0) {
    return {
      error: `Live cap: LinkedIn row budget (${CAP_ROWS}) already used`,
    };
  }

  if (toolName === 'search_linkedin_continue') {
    const maxPages = Math.min(numberOr(args.maxPages, 1), 3);
    const limit = Math.min(numberOr(args.limit, remaining), remaining);

    state.linkedInRows += Math.min(remaining, limit * maxPages);

    return { ...args, limit, maxPages };
  }

  const limit = Math.min(numberOr(args.limit, remaining), remaining);

  state.linkedInRows += limit;

  return { ...args, limit };
};

const capFindRole = async (
  args: Record<string, unknown>,
  state: LiveCapState,
  config: LiveToolConfig,
): Promise<Record<string, unknown> | { error: string }> => {
  const onlyFailed = args.onlyFailed === true;

  if (onlyFailed) {
    if (state.findPeopleOnlyFailedCalls >= 1) {
      return {
        error:
          'Live cap: only one find_people_by_company onlyFailed retry allowed',
      };
    }

    state.findPeopleOnlyFailedCalls += 1;
  } else {
    if (state.findPeopleCalls >= 1) {
      return {
        error: 'Live cap: only one full find_people_by_company call allowed',
      };
    }

    state.findPeopleCalls += 1;
  }

  let companies = Array.isArray(args.companies)
    ? (args.companies as Record<string, unknown>[])
    : undefined;

  if (
    args.fromProject === true &&
    (companies === undefined || companies.length === 0)
  ) {
    const tab = await mcpExecute(config, 'get_outreach_tab', {
      projectId: config.projectId,
      tab: 'companies',
      limit: CAP_ROWS,
    });
    const rows = Array.isArray(tab.rows)
      ? (tab.rows as Record<string, unknown>[])
      : [];

    companies = rows.slice(0, CAP_ROWS).map((row) => ({
      id: row.id,
      name: row.name ?? row.companyName ?? row.label,
    }));
  }

  if (companies !== undefined && companies.length > CAP_ROWS) {
    companies = companies.slice(0, CAP_ROWS);
  }

  return {
    ...args,
    fromProject: companies !== undefined ? false : args.fromProject,
    companies,
    maxBudgetUsd: Math.min(
      numberOr(args.maxBudgetUsd, FIND_ROLE_MAX_BUDGET_PER_COMPANY_USD),
      FIND_ROLE_MAX_BUDGET_PER_COMPANY_USD,
    ),
    projectId: config.projectId,
  };
};

const capAiColumn = (
  args: Record<string, unknown>,
): Record<string, unknown> => ({
  ...args,
  rowLimit: Math.min(
    numberOr(args.rowLimit, AI_COLUMN_ROW_LIMIT),
    AI_COLUMN_ROW_LIMIT,
  ),
});

export const executeLiveTool = async (
  toolName: string,
  rawArgs: Record<string, unknown>,
  config: LiveToolConfig,
  state: LiveCapState,
): Promise<Record<string, unknown>> => {
  if (!isLiveAllowlisted(toolName)) {
    return {
      ok: false,
      error: `Live cap: tool "${toolName}" is not on the live allowlist; use a stubbed path or an allowed tool`,
    };
  }

  let args = withProjectId(rawArgs, config.projectId);

  if (toolName === SEARCH_BRIGHT_DATA_BUSINESS_TOOL_NAME) {
    const capped = capBrightData(args, state);

    if ('error' in capped) {
      return { ok: false, error: capped.error };
    }

    args = withProjectId(capped, config.projectId);
  } else if (
    toolName === 'search_linkedin_people' ||
    toolName === 'search_linkedin_companies' ||
    toolName === 'search_linkedin_continue'
  ) {
    const capped = capLinkedIn(toolName, args, state);

    if ('error' in capped) {
      return { ok: false, error: capped.error };
    }

    args = capped;
  } else if (toolName === 'find_people_by_company') {
    const capped = await capFindRole(args, state, config);

    if ('error' in capped) {
      return { ok: false, error: capped.error };
    }

    args = capped;
  } else if (
    toolName === 'preview_ai_column' ||
    toolName === 'run_ai_column' ||
    toolName === 'fetch_profiles'
  ) {
    args = withProjectId(capAiColumn(args), config.projectId);
  } else if (toolName === 'outreach_list' && args.action === 'attach') {
    args = {
      ...args,
      limit: Math.min(numberOr(args.limit, CAP_ROWS), CAP_ROWS),
      projectId: config.projectId,
    };
  }

  // eslint-disable-next-line no-console
  console.log(
    `[sourcing-eval] live→ ${toolName} ${JSON.stringify(args).slice(0, 200)}`,
  );

  return mcpExecute(config, toolName, args);
};

export const fetchTabForQuality = async (
  config: LiveToolConfig,
  tab: 'people' | 'companies',
): Promise<Record<string, unknown>> =>
  mcpExecute(config, 'get_outreach_tab', {
    projectId: config.projectId,
    tab,
    limit: CAP_ROWS,
    summarize: [
      'fitmentOutcome',
      'fitmentScore',
      'title',
      'companyName',
      'location',
      'industry',
    ],
  });
