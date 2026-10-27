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
      name: 'search_bright_data_business',
      title: 'Search Bright Data business',
      description:
        'Bright Data Business Search for companies or people from a raw natural-language request. Default ludicrous; billed at $0.002 per returned record (max $10 per query) and works in two steps. Step 1: call WITHOUT listId. The server plans several structured queries and samples them for a few cents, then returns listId, per-slice match counts, expected accuracy and the cost of fetching N records; nothing is fetched yet. Show these numbers to the user and ask which budget to spend. Step 2: after the user confirms, call again with listId and maxBudgetUsd (optionally targetCount, projectId). Pick the mode by input: ludicrous for a set described by attributes (it has no URL, website or domain field); instant only with entity company and a bare domain (e.g. stripe.com) to look up one company by website. For one person by LinkedIn URL or name use fetch_profiles; a company LinkedIn URL is not supported. The ludicrous result never contains the records, only counts and a summary; they go to the project tab and a saved dataset. Fetched records are saved server-side under the listId for 30 days: if no project was known, call again with the same listId and a projectId to write them at no charge. Pass projectId so results are written to the Outreach tab; do not upsert those rows again. Requires BRIGHT_DATA_API_KEY.',
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
              'Raw natural-language request, or for mode instant a bare domain/URL (e.g. stripe.com). Not a LinkedIn URL.',
          },
          mode: {
            type: 'string',
            enum: ['ludicrous', 'instant'],
            description:
              'Default ludicrous, for a set described by attributes. Pass instant only with entity company for a lookup by website (bare host, no spaces); any other instant call runs as ludicrous.',
          },
          limit: {
            type: 'number',
            description: 'Target relevant-record count',
          },
          projectId: {
            type: 'string',
            description:
              'Outreach project id. When set, mapped rows are merged into the Companies or People tab.',
          },
          listId: {
            type: 'string',
            description:
              'Ludicrous only. listId returned by the estimate call. Pass it, with maxBudgetUsd, once the user confirms the budget.',
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
          mode:
            args.mode === 'instant' && args.entity === 'company'
              ? 'instant'
              : 'ludicrous',
          limit: toOptionalNumber(args.limit),
          projectId: hasNonEmptyString(args.projectId)
            ? args.projectId
            : undefined,
          listId: hasNonEmptyString(args.listId) ? args.listId : undefined,
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
      name: 'outreach_list',
      title: 'Search result lists',
      description:
        'Overflow for search result lists (listId). Find searches with projectId already write the project tab. Lists last 30 days when a source was paid, otherwise 7. actions: list, summary, peek (max 10), export (CSV), dedupe (crm or lists), attach (a list already on that project is skipped), save_to_crm (bag overflow; prefer save_outreach_targets_to_crm once rows are on the tab), delete. Never read a whole list into the conversation.',
      annotations: { readOnlyHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: [
              'list',
              'summary',
              'peek',
              'export',
              'dedupe',
              'attach',
              'save_to_crm',
              'delete',
            ],
            description: 'What to do with the list',
          },
          listId: {
            type: 'string',
            description: 'List id from a search result',
          },
          offset: {
            type: 'number',
            description: 'peek / attach / save_to_crm: first row',
          },
          limit: {
            type: 'number',
            description: 'peek max 10; attach and save_to_crm max 20000',
          },
          against: {
            type: 'string',
            enum: ['crm', 'lists'],
            description: 'dedupe target',
          },
          remove: {
            type: 'boolean',
            description: 'dedupe: drop matching rows',
          },
          projectId: {
            type: 'string',
            description:
              'attach / save_to_crm: project to tag rows to. Ask the user when unknown',
          },
        },
        required: ['action'],
      },
    },
    handler: async (args, config) => {
      const actions = [
        'list',
        'summary',
        'peek',
        'export',
        'dedupe',
        'attach',
        'save_to_crm',
        'delete',
      ];

      if (typeof args.action !== 'string' || !actions.includes(args.action)) {
        throw new Error(`action must be one of: ${actions.join(', ')}`);
      }

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'outreach-list',
        'run',
        {
          action: args.action,
          listId: hasNonEmptyString(args.listId)
            ? args.listId.trim()
            : undefined,
          offset: toOptionalNumber(args.offset),
          limit: toOptionalNumber(args.limit),
          against: hasNonEmptyString(args.against) ? args.against : undefined,
          remove: typeof args.remove === 'boolean' ? args.remove : undefined,
          projectId: hasNonEmptyString(args.projectId)
            ? args.projectId.trim()
            : undefined,
        },
        undefined,
        BRIGHT_DATA_BUSINESS_SEARCH_TIMEOUT_MS,
      );
    },
  },
];
