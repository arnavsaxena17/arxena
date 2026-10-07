import { callRestAPI } from '../api/rest-client';
import { McpTool } from '../types/tool-types';

const hasNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const toOptionalNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

export const brightDataBusinessSearchTools: McpTool[] = [
  {
    definition: {
      name: 'search_bright_data_business',
      title: 'Search Bright Data business',
      description:
        'Bright Data Business Search for companies or people from a raw natural-language request. Default mode ludicrous is billed at $0.002 per returned record (max $10 per query) and works in two steps. Step 1: call WITHOUT planId. The server plans several structured queries and samples them for a few cents, then returns planId, per-slice match counts, expected accuracy and the cost of fetching N records; nothing is fetched yet. Show these numbers to the user and ask which budget to spend. Step 2: after the user confirms, call again with planId and maxBudgetUsd (optionally targetCount, projectId). Modes smart and instant take a query up to 200 characters and return immediately without confirmation. Pass projectId so results are written to the Outreach tab; do not upsert those rows again. Requires BRIGHT_DATA_API_KEY.',
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
              'Raw natural-language request. Max 200 characters for smart/instant; ludicrous accepts longer requests and boolean title strings. Not a LinkedIn URL.',
          },
          mode: {
            type: 'string',
            enum: ['ludicrous', 'smart', 'instant'],
            description:
              'ludicrous (default, planned and budgeted), smart, or instant',
          },
          limit: {
            type: 'number',
            description:
              'Result count. smart max 100, instant max 1000. For ludicrous this is the target relevant-record count',
          },
          offset: { type: 'number', description: 'Optional page offset' },
          view: {
            type: 'string',
            enum: ['full', 'summary', 'id_only'],
            description: 'full (default), summary, or id_only',
          },
          projectId: {
            type: 'string',
            description:
              'Outreach project id. When set, mapped rows are merged into the Companies or People tab.',
          },
          planId: {
            type: 'string',
            description:
              'Ludicrous only. planId returned by the estimate call. Pass it, with maxBudgetUsd, once the user confirms the budget.',
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
          mode: hasNonEmptyString(args.mode) ? args.mode : undefined,
          limit: toOptionalNumber(args.limit),
          offset: toOptionalNumber(args.offset),
          view: hasNonEmptyString(args.view) ? args.view : undefined,
          projectId: hasNonEmptyString(args.projectId)
            ? args.projectId
            : undefined,
          planId: hasNonEmptyString(args.planId) ? args.planId : undefined,
          maxBudgetUsd: toOptionalNumber(args.maxBudgetUsd),
          targetCount: toOptionalNumber(args.targetCount),
        },
      );
    },
  },
];
