import { readFileSync } from 'fs';
import { join } from 'path';

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText, stepCountIs, tool } from 'ai';
import { z } from 'zod';

import {
  LIVE_BACKEND,
  LIVE_CAPPED_SETUP_NOTE,
  createLiveCapState,
  executeLiveTool,
  isLiveAllowlisted,
  readLiveToolConfig,
  type LiveCapState,
  type LiveToolConfig,
} from 'src/engine/metadata-modules/ai/ai-chat/__tests__/sourcing-eval/live-tools';
import { type SourcingScenario } from 'src/engine/metadata-modules/ai/ai-chat/__tests__/sourcing-eval/scenario';
import { buildRoutingLines } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/build-routing-lines.util';
import { selectSkillSections } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/select-skill-sections.util';
import {
  getSkillContent,
  resolveSkillSections,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/skill-library';

// Default: every tool is a stub that records its call and returns a fixed
// result (counts are made up — never judge yields). With
// SOURCING_EVAL_LIVE_BACKEND=1, allowlisted tools proxy to the running server
// under hard caps (see live-tools.ts).

export type ToolCall = { tool: string; args: Record<string, unknown> };

export type ScenarioTrace = {
  scenarioId: string;
  steps: number;
  calls: ToolCall[];
  finalText: string;
  error?: string;
};

const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash-0731';
const DEFAULT_MAX_STEPS = 30;
const DEFAULT_TIMEOUT_MS = 240_000;

// Ad-hoc exploration only — leave defaults for canned scenarios.
export const MAX_STEPS = Number(
  process.env.SOURCING_EVAL_MAX_STEPS ?? DEFAULT_MAX_STEPS,
);
export const TIMEOUT_MS = Number(
  process.env.SOURCING_EVAL_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS,
);

const SCHEMA_HINTS: Record<string, string> = {
  get_sourcing_ledger:
    '{ projectId, brief?, target?, stoppedBecause? } records or reads the sourcing brief',
  ask_questions:
    '{ questions: [{ question, options: [{ label, recommended? }] }] } at most 4 questions',
  preview_ai_column:
    '{ projectId, tab, fitment?: { stage, criteria }, description?, rowLimit?, rowIds?, rowScope?: chat_upserts|unfilled|all }',
  run_ai_column:
    '{ projectId, tab, previewId, rowLimit?, rowIds?, rowScope?: chat_upserts|unfilled|all, rerunAll?, approvedCostUsd? }',
  fetch_profiles: '{ projectId, rowLimit? }',
  find_people_by_company:
    '{ projectId, fromProject?, companies?: [{ id, name, alternateNames? }], roles, location, maxBudgetUsd?, onlyFailed? }',
  search_bright_data_business:
    '{ entity: "people" | "company", query, projectId (required), mode?, execute?, maxBudgetUsd?, targetCount?, autoExecute? }',
  google_serp_search: '{ query }',
  outreach_tab:
    '{ action: "export" | "dedupe", projectId, tab: "companies" | "people", against?: "crm", remove? }',
  get_outreach_tab: '{ projectId, tab?, summarize?, limit? }',
  generate_table_view: '{ projectId, tab, description }',
  apply_table_view: '{ projectId, tab, filters?, sort?, clear? }',
  search_linkedin_people:
    '{ searchType?, searchParameters, projectId?, limit?, account_id? }',
  search_linkedin_companies:
    '{ searchType?, searchParameters, projectId?, limit?, account_id? }',
  search_linkedin_continue:
    '{ cursor?, maxPages?, limit?, projectId? }',
  search_linkedin_parameters: '{ parameterType, query }',
  generate_linkedin_query_set:
    '{ rawRequirement, category?, provider?, searchType?, account_id? }',
  search_harvest_leads: '{ searchParameters, page?, limit?, projectId? }',
  search_harvest_accounts: '{ searchParameters, page?, limit?, projectId? }',
  search_apollo_people: '{ keywords?, personTitles?, projectId?, ... }',
  search_apollo_companies: '{ organizationName?, domains?, projectId?, ... }',
  exa_web_search: '{ query, category?, projectId? }',
};

const tabSearchStub = (
  args: Record<string, unknown>,
  counts: { fetched: number; added: number; duplicates: number; total: number },
): Record<string, unknown> => {
  const hasProject =
    typeof args.projectId === 'string' && args.projectId.trim().length > 0;

  if (!hasProject) {
    return {
      error:
        'projectId is required. Open the project whose tab should receive the rows, then retry.',
      fetched: counts.fetched,
      added: 0,
      duplicates: 0,
      total: 0,
      ephemeralWritten: 0,
      nextStep:
        'Nothing was written. Open or name a project, then run the search again.',
    };
  }

  return {
    ...counts,
    newUnique: counts.added,
    alreadyKnown: 0,
    ephemeralWritten: counts.added,
    nextStep:
      'Records were written to the project tab. Use get_outreach_tab; save_outreach_targets_to_crm only if the user asks to save.',
  };
};

const stubResult = (
  toolName: string,
  scenario: SourcingScenario,
  args: Record<string, unknown> = {},
): Record<string, unknown> => {
  switch (toolName) {
    case 'get_sourcing_ledger':
      return {
        ok: true,
        brief: scenario.setup.includes('already holds')
          ? {
              note: 'earlier brief on file for the same role, 30 rows on the People tab',
            }
          : null,
        shortfall: { short: 0 },
        searches: [],
      };
    case 'search_bright_data_business': {
      const hasProject =
        typeof args.projectId === 'string' && args.projectId.trim().length > 0;

      if (args.execute === true || args.autoExecute === true) {
        return {
          projectId: args.projectId,
          count: 40,
          fetchedCount: 280,
          ephemeralWritten: hasProject ? 280 : 0,
          spentUsd: 0.56,
          budgetUsd: 5,
          reused: false,
          nextStep:
            'Records were written to the project tab. Use get_outreach_tab; save_outreach_targets_to_crm only if the user asks to save.',
        };
      }

      return {
        projectId: args.projectId,
        awaitingConfirmation: true,
        intentSummary: 'The segment described in the request',
        shards: [
          {
            key: 'canonical',
            rationale: 'Canonical industry label',
            matched: 300,
            coveragePercent: 100,
            fetchableRecords: 300,
            estimatedCostUsd: 0.6,
            samplePrecision: 0.8,
          },
        ],
        totalFetchableRecords: 300,
        estimatedUniqueRecords: 280,
        estimatedAccurateRecords: 220,
        estimatedCostUsd: 0.56,
        estimateCostUsd: 0.02,
        maxBudgetUsd: 10,
        budgetOptions: [],
        message: 'About 280 records are reachable; the estimate cost $0.02.',
        probeRowsWritten: 30,
        probeRowsTotal: 30,
        nextStep:
          'Show the user the slices, counts and cost options, then call again with execute: true and the maxBudgetUsd they choose.',
      };
    }
    case 'google_serp_search':
      return { results: [{ title: 'Name - Role - Company', snippet: '...' }] };
    case 'search_linkedin_people':
    case 'search_linkedin_companies':
    case 'search_apollo_people':
    case 'search_apollo_companies':
    case 'exa_web_search':
    case 'search_people_index':
    case 'search_companies_index':
    case 'search_wikidata_companies':
      return tabSearchStub(args, {
        fetched: 100,
        added: 90,
        duplicates: 10,
        total: 90,
      });
    case 'find_people_by_company':
      return { companies: 2, matched: 2, people: 4, status: 'matched' };
    case 'fetch_profiles':
      return { fetched: 80, remaining: 0 };
    case 'preview_ai_column':
      return { ok: true, previewRows: 10 };
    case 'run_ai_column':
      return {
        ok: true,
        status: 'completed',
        pass: 40,
        unknown: 120,
        fail: 120,
      };
    case 'get_outreach_tab':
      return {
        total: 280,
        summary: { fitmentOutcome: { pass: 40, unknown: 120, fail: 120 } },
      };
    case 'outreach_tab':
      return {
        ok: true,
        projectId: args.projectId,
        tab: args.tab,
        matched: 12,
        removed: args.remove === true ? 12 : 0,
        total: args.remove === true ? 268 : 280,
        files:
          args.action === 'export'
            ? [{ filename: 'companies.csv', url: 'https://example.test/csv' }]
            : undefined,
      };
    default:
      return { ok: true };
  }
};

const loadSkillText = (name: string, sections?: string[]): string => {
  try {
    const content = getSkillContent(name);

    return name === 'sourcing'
      ? selectSkillSections(content, resolveSkillSections('sourcing', sections))
          .content
      : content;
  } catch {
    return `Skill "${name}" not found.`;
  }
};

const buildSystemPrompt = (
  scenario: SourcingScenario,
  projectId: string,
  liveNote?: string,
): string => {
  const core = readFileSync(
    join(__dirname, '../../constants/contents/core.md'),
    'utf-8',
  ).replace('{{SHARED_ROUTING_LINES}}', buildRoutingLines());
  const sessionNote = [scenario.setup, liveNote].filter(Boolean).join(' ');

  return `${core}\n\n## Browsing context\nWorkspace: Arxena (India). Project: ${projectId} "Search Requirements" (Outreach People tab). HQ country: India. Connected channels: LinkedIn (Unipile). projectId=${projectId}.\nSession note: ${sessionNote}`;
};

export const runScenario = async (
  scenario: SourcingScenario,
): Promise<ScenarioTrace> => {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is required for the sourcing eval');
  }

  const liveConfig: LiveToolConfig | null = LIVE_BACKEND
    ? readLiveToolConfig()
    : null;
  const liveCaps: LiveCapState = createLiveCapState();
  const projectId = liveConfig?.projectId ?? 'proj_001';

  // eslint-disable-next-line no-console
  console.log('[sourcing-eval] runScenario start', scenario.id);
  // eslint-disable-next-line no-console
  console.log('[sourcing-eval] userSays:', scenario.userSays);
  // eslint-disable-next-line no-console
  console.log(
    `[sourcing-eval] ${liveConfig ? 'LIVE backend' : 'stub tools'}: each tool call prints as it runs; Ctrl+C to stop`,
  );
  const calls: ToolCall[] = [];
  let stepsSeen = 0;
  const looseInput = z.object({}).loose();
  const record = (toolName: string, args: Record<string, unknown>) => {
    calls.push({ tool: toolName, args });
    // eslint-disable-next-line no-console
    console.log(
      `[sourcing-eval] #${calls.length} ${toolName} ${JSON.stringify(args).slice(0, 240)}`,
    );
  };
  const askReply = () => ({
    answers: `Accept the recommended option for each question.\nScripted user replies (use only when the question matches):\n${scenario.scriptedReplies}`,
  });
  const answer = async (
    toolName: string,
    args: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> => {
    if (toolName === 'ask_questions') {
      return askReply();
    }

    if (liveConfig && isLiveAllowlisted(toolName)) {
      try {
        return await executeLiveTool(toolName, args, liveConfig, liveCaps);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        return { ok: false, error: message };
      }
    }

    return stubResult(toolName, scenario, args);
  };
  const stubbed = (toolName: string) =>
    tool({
      description: SCHEMA_HINTS[toolName] ?? toolName,
      inputSchema: looseInput,
      execute: async (args: Record<string, unknown>) => {
        record(toolName, args);

        return answer(toolName, args);
      },
    });

  const tools = {
    load_skills: tool({
      description:
        'Load skill text. { skillNames: string[], sections?: string[] }',
      inputSchema: z.object({
        skillNames: z.array(z.string()),
        sections: z.array(z.string()).optional(),
      }),
      execute: async (args) => {
        record('load_skills', args);

        return args.skillNames
          .map((name) => loadSkillText(name, args.sections))
          .join('\n\n====\n\n');
      },
    }),
    learn_tools: tool({
      description: 'Learn tool schemas. { toolNames: string[] }',
      inputSchema: looseInput,
      execute: async (args: Record<string, unknown>) => {
        record('learn_tools', args);
        const names = (args.toolNames as string[] | undefined) ?? [];

        return {
          learned: names.map((name) => ({
            name,
            input: SCHEMA_HINTS[name] ?? '{}',
          })),
          note: 'Call them with execute_tool.',
        };
      },
    }),
    execute_tool: tool({
      description: 'Execute a learned tool. { toolName, arguments }',
      inputSchema: z.object({
        toolName: z.string(),
        arguments: z.record(z.string(), z.unknown()).optional(),
      }),
      execute: async (args) => {
        const toolArgs = args.arguments ?? {};

        record(args.toolName, toolArgs);

        return answer(args.toolName, toolArgs);
      },
    }),
    ...Object.fromEntries(
      Object.keys(SCHEMA_HINTS).map((name) => [name, stubbed(name)]),
    ),
  };

  const provider = createOpenAICompatible({
    name: 'openrouter',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
  });

  try {
    const result = await generateText({
      model: provider(process.env.SOURCING_EVAL_MODEL ?? DEFAULT_MODEL),
      system: buildSystemPrompt(
        scenario,
        projectId,
        liveConfig ? LIVE_CAPPED_SETUP_NOTE : undefined,
      ),
      prompt: scenario.userSays,
      tools,
      stopWhen: stepCountIs(MAX_STEPS),
      temperature: 0,
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
      onStepFinish: (step) => {
        stepsSeen += 1;
        const text = step.text?.trim();

        // eslint-disable-next-line no-console
        console.log(
          `[sourcing-eval] step ${stepsSeen}/${MAX_STEPS} tools=${step.toolCalls.length}${
            text ? ` text=${text.slice(0, 160)}` : ''
          }`,
        );
      },
    });

    // eslint-disable-next-line no-console
    console.log(
      `[sourcing-eval] done steps=${result.steps.length} calls=${calls.length}`,
    );

    return {
      scenarioId: scenario.id,
      steps: result.steps.length,
      calls,
      finalText: result.text,
    };
  } catch (error) {
    const message = formatCaughtError(error);

    // eslint-disable-next-line no-console
    console.error('[sourcing-eval] generateText failed:', message);

    return {
      scenarioId: scenario.id,
      steps: stepsSeen,
      calls,
      finalText: '',
      error: message,
    };
  }
};

const formatCaughtError = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const parts = [error.message];
  let cause: unknown = error.cause;

  for (let depth = 0; cause !== undefined && depth < 5; depth++) {
    if (cause instanceof Error) {
      parts.push(`cause: ${cause.message}`);
      cause = cause.cause;
      continue;
    }

    parts.push(`cause: ${String(cause)}`);
    break;
  }

  const apiError = error as Error & {
    statusCode?: number;
    url?: string;
    responseBody?: string;
  };

  if (apiError.statusCode !== undefined) {
    parts.push(`statusCode: ${apiError.statusCode}`);
  }

  if (apiError.url !== undefined) {
    parts.push(`url: ${apiError.url}`);
  }

  if (apiError.responseBody !== undefined) {
    parts.push(`responseBody: ${apiError.responseBody.slice(0, 2000)}`);
  }

  return parts.join('\n');
};
