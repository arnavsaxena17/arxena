import {
  OUTREACH_TAB_TOOL_NAME,
  SEARCH_BRIGHT_DATA_BUSINESS_TOOL_NAME,
} from 'src/engine/core-modules/arxena-tools/constants/arxena-tool-names.const';

import { callRestAPI } from '../api/rest-client';
import { McpTool } from '../types/tool-types';

const hasNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const toOptionalNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const BRIGHT_DATA_BUSINESS_SEARCH_TIMEOUT_MS = 300_000;

// autoExecute skips the user's budget confirmation, so one call can never
// spend more than this, whatever maxBudgetUsd the model passes
const AUTO_EXECUTE_MAX_BUDGET_USD = 0.1;

export const brightDataBusinessSearchTools: McpTool[] = [
  {
    definition: {
      name: SEARCH_BRIGHT_DATA_BUSINESS_TOOL_NAME,
      title: 'Search Bright Data business',
      description:
        'Bright Data Business Search for companies or people from a raw natural-language request. Default ludicrous; billed at $0.002 per returned record (max $10 per query) and works in two steps. Step 1: call without execute. The server plans several structured queries and samples them for a few cents, writes the sampled rows to the project tab as probes, and returns per-slice match counts, expected accuracy and the cost of fetching N records. Show these numbers to the user and ask which budget to spend. Step 2: after the user confirms, call again with execute: true and maxBudgetUsd (optionally targetCount). Every result is written to the project tab; a project is required. instant sends one raw string with no estimate: a website or LinkedIn URL is a lookup cut to the exact match; any other short literal is a probe of up to 25 rows, written to the tab with otherFields.probe=true. The ludicrous result never contains the records, only counts and a summary. Requires BRIGHT_DATA_API_KEY.',
      annotations: { readOnlyHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          entity: {
            type: 'string',
            enum: ['company', 'people'],
            description: 'company or people',
          },
          query: {
            type: 'string',
            description:
              'Raw natural-language request; for mode instant a bare domain (stripe.com), a LinkedIn URL or a short literal (max 200 characters).',
          },
          mode: {
            type: 'string',
            enum: ['ludicrous', 'instant'],
            description:
              'Default ludicrous, for a set described by attributes. instant: a website or LinkedIn URL lookup (exact match, written), or a probe of any other short string (preview only, max 25 rows).',
          },
          limit: {
            type: 'number',
            description:
              'Target relevant-record count. Instant probe: rows to preview (default 10, max 25).',
          },
          projectId: {
            type: 'string',
            description:
              'Required. The project whose Companies or People tab receives every result.',
          },
          execute: {
            type: 'boolean',
            description:
              'Ludicrous only. Omitted: estimate and write probes. True: fetch the project active estimate within maxBudgetUsd.',
          },
          maxBudgetUsd: {
            type: 'number',
            description:
              'Ludicrous only. Spend cap in USD for this query (0.01 to 10).',
          },
          targetCount: {
            type: 'number',
            description:
              'Ludicrous only. Stop once this many relevant records are kept.',
          },
          autoExecute: {
            type: 'boolean',
            description:
              'Ludicrous only. Skip the estimate and confirmation step: plan and fetch in one call within maxBudgetUsd, and write to projectId. Use for targeted company + position lookups ("CEO of Burger King India"), where an estimate adds nothing.',
          },
        },
        required: ['entity', 'query'],
      },
    },
    handler: async (args, config) => {
      if (args.entity !== 'company' && args.entity !== 'people') {
        throw new Error('entity must be company or people');
      }

      if (!hasNonEmptyString(args.query)) {
        throw new Error('query is required');
      }

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'bright-data/business-search',
        args.entity,
        {
          query: args.query.trim(),
          mode: args.mode === 'instant' ? 'instant' : 'ludicrous',
          limit: toOptionalNumber(args.limit),
          projectId: hasNonEmptyString(args.projectId)
            ? args.projectId
            : undefined,
          execute: args.execute === true ? true : undefined,
          maxBudgetUsd:
            args.autoExecute === true
              ? Math.min(
                  toOptionalNumber(args.maxBudgetUsd) ??
                    AUTO_EXECUTE_MAX_BUDGET_USD,
                  AUTO_EXECUTE_MAX_BUDGET_USD,
                )
              : toOptionalNumber(args.maxBudgetUsd),
          targetCount: toOptionalNumber(args.targetCount),
          autoExecute: args.autoExecute === true ? true : undefined,
        },
        undefined,
        // plan + sample, or a multi-slice fetch of up to ~1,000 rows
        BRIGHT_DATA_BUSINESS_SEARCH_TIMEOUT_MS,
      );
    },
  },
  {
    definition: {
      name: OUTREACH_TAB_TOOL_NAME,
      title: 'Export or dedupe a project tab',
      description:
        'Export a project Companies or People tab as CSV, or dedupe it against the CRM. There is no list: the tab is the result store. Pass projectId and tab. dedupe marks matched rows with otherFields.inCrm, or removes them with remove: true. Never read the whole tab into the conversation.',
      annotations: { readOnlyHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['export', 'dedupe'],
            description: 'export the tab as CSV, or dedupe it against the CRM',
          },
          projectId: {
            type: 'string',
            description: 'Required. The project whose tab to act on',
          },
          tab: {
            type: 'string',
            enum: ['companies', 'people'],
            description: 'Which project tab to export or dedupe',
          },
          against: {
            type: 'string',
            enum: ['crm'],
            description: 'dedupe only: compare with existing CRM records',
          },
          remove: {
            type: 'boolean',
            description:
              'dedupe only: drop matching rows instead of only marking them',
          },
        },
        required: ['action', 'tab'],
      },
    },
    handler: async (args, config) =>
      callRestAPI(
        config.baseUrl,
        config.apiToken,
        'outreach-tab',
        'run',
        {
          action: args.action,
          projectId: hasNonEmptyString(args.projectId)
            ? args.projectId.trim()
            : undefined,
          tab: args.tab,
          against: hasNonEmptyString(args.against) ? args.against : undefined,
          remove: typeof args.remove === 'boolean' ? args.remove : undefined,
        },
        undefined,
        BRIGHT_DATA_BUSINESS_SEARCH_TIMEOUT_MS,
      ),
  },
];
