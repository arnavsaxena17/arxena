import { z } from 'zod';

const subjectSchema = z
  .enum(['person', 'company'])
  .default('person')
  .describe(
    "Default and almost always: person (the People tab rows; also for questions about the people's companies, using companyName). company only when the user is on the Companies tab.",
  );

export const GetOutreachWorkingSetInputZodSchema = z.object({
  projectId: z
    .string()
    .describe('Project id from the outreachCommand browsing context'),
  subject: subjectSchema,
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe('Rows to return (max 50). Keep small.'),
  cursor: z
    .string()
    .optional()
    .describe('nextCursor from the previous page, to continue'),
  summarize: z
    .array(z.string())
    .max(12)
    .optional()
    .describe(
      'Column keys (otherFields keys such as brandCategory, or name, domain, industry, employees) to summarize over ALL rows: yes/no and label columns return value counts, number columns return count, min, quartiles and max. Use this to count and to choose a cut-off instead of paging rows.',
    ),
  onlyViewMatches: z
    .boolean()
    .optional()
    .describe(
      'With summarize: only count rows that match the filters of the view currently applied to the table.',
    ),
});

export type GetOutreachWorkingSetInput = z.infer<
  typeof GetOutreachWorkingSetInputZodSchema
>;

const fieldSchema = z.object({
  name: z
    .string()
    .regex(/^[a-zA-Z][a-zA-Z0-9]*$/)
    .describe('Column key, camelCase, unique in the project (e.g. isCeo)'),
  type: z
    .enum(['boolean', 'enum', 'text', 'number', 'integer'])
    .describe(
      'boolean for yes/no, enum for one of a fixed list, integer for counts (employees), number for money or ratios, text only for free text',
    ),
  description: z.string().optional(),
  enumValues: z.array(z.string()).optional(),
});

export const OutreachAiColumnFilterZodSchema = z.object({
  name: z.string().min(1).describe('Column label shown in the table header'),
  prompt: z
    .string()
    .min(1)
    .describe('What a yes / the right answer looks like, in plain language'),
  selectedModel: z
    .string()
    .describe(
      'jev (boolean filters from fields on the row), gpt4omini, gpt4ominisearchpreview (web search: revenue, headcount), gpt4o',
    ),
  fields: z.array(fieldSchema).min(1).max(4),
  selectedMetadataFields: z
    .array(z.string())
    .describe(
      'Row fields the model may see. People: name, jobTitle, headline, companyName, location. Companies: name, domain, industry, size, employees',
    ),
});

const fitmentCriterionSchema = z.object({
  key: z
    .string()
    .regex(/^[a-zA-Z][a-zA-Z0-9]*$/)
    .describe(
      'Column key, camelCase, unique among the criteria (e.g. isPlantHead)',
    ),
  description: z
    .string()
    .min(3)
    .describe(
      'What passing means, in plain words and in the user\'s terms (e.g. "currently heads a manufacturing plant")',
    ),
  mustHave: z
    .boolean()
    .default(true)
    .describe(
      'true: a fail rejects the row. false: nice-to-have, it only moves the score.',
    ),
  weight: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(1)
    .describe('How much the criterion counts toward the score'),
});

export const OutreachAiColumnFitmentZodSchema = z.object({
  stage: z
    .enum(['snapshot', 'profile'])
    .describe(
      'snapshot: the rows hold only what a search previews, so criteria they cannot answer come back unknown (go to a profile fetch). profile: the rows hold the full profile, so unknown must-haves fail.',
    ),
  criteria: z.array(fitmentCriterionSchema).min(1).max(8),
  request: z
    .string()
    .optional()
    .describe("The user's request in their own words, for context"),
  minimumScore: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe(
      "Raise the bar above the server's fitment threshold (0 to 1). It can never go below it.",
    ),
});

export type OutreachAiColumnFitmentInput = z.infer<
  typeof OutreachAiColumnFitmentZodSchema
>;

export const PreviewOutreachAiColumnInputZodSchema = z
  .object({
    projectId: z.string(),
    subject: subjectSchema,
    description: z
      .string()
      .min(3)
      .optional()
      .describe(
        'The user\'s request in their own words (e.g. "revenue of each company"). The server designs the typed columns, the prompt, the input fields and the model from it. Prefer this.',
      ),
    filter: OutreachAiColumnFilterZodSchema.optional().describe(
      'Only when the user asks for a specific column design: overrides the designed one.',
    ),
    fitment: OutreachAiColumnFitmentZodSchema.optional().describe(
      "Score the rows against the user's criteria: pass, fail or unknown per criterion, then a score and an outcome computed in code against the server's fitment threshold. Use instead of description for sourcing a list. Needs no design call.",
    ),
    rowLimit: z.number().int().min(1).max(10).default(10),
  })
  .refine(
    (input) =>
      input.description !== undefined ||
      input.filter !== undefined ||
      input.fitment !== undefined,
    {
      message: 'Pass fitment (sourcing), description (preferred) or filter',
    },
  );

export type PreviewOutreachAiColumnInput = z.infer<
  typeof PreviewOutreachAiColumnInputZodSchema
>;

// A run is a background job; the tool waits for it so the agent does not spend
// a model step per check. Every extra step re-reads the whole conversation.
export const AI_COLUMN_DEFAULT_RUN_WAIT_SECONDS = 150;
export const AI_COLUMN_DEFAULT_STATUS_WAIT_SECONDS = 120;
export const AI_COLUMN_MAX_WAIT_SECONDS = 240;

const waitSecondsSchema = (defaultSeconds: number) =>
  z
    .number()
    .int()
    .min(0)
    .max(AI_COLUMN_MAX_WAIT_SECONDS)
    .default(defaultSeconds)
    .describe(
      `Seconds to wait for the run to finish before answering (default ${defaultSeconds}, max ${AI_COLUMN_MAX_WAIT_SECONDS}). The call returns as soon as the run is done. 0 answers at once.`,
    );

export const RunOutreachAiColumnInputZodSchema = z.object({
  projectId: z.string(),
  waitSeconds: waitSecondsSchema(AI_COLUMN_DEFAULT_RUN_WAIT_SECONDS),
  approvedCostUsd: z
    .number()
    .min(0)
    .optional()
    .describe(
      'The most the user approved for this run, in USD. Needed only when the preview says needsApproval; pass the amount they agreed to (or the enrichment cap they approved once for the whole list build).',
    ),
  subject: subjectSchema,
  previewId: z
    .string()
    .describe('previewId from preview_ai_column. Only after user confirmed.'),
  rerunAll: z
    .boolean()
    .optional()
    .describe(
      'Default false: rows that already have the column are skipped, so calling again retries only failed rows. true recomputes every row.',
    ),
  onlyViewMatches: z
    .boolean()
    .optional()
    .describe(
      'true runs only the rows that match the filters of the view currently applied to the project table (apply_table_view), so rows an earlier filter already ruled out are not paid for. Default false: every row.',
    ),
  // Caps how many working-set rows (in table order) are touched. Omit only for an explicit full run.
  rowLimit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe(
      'Only process the first N rows of the working set (table order). Use for tests / "first N" / regenerate-N. Omit ONLY when the user explicitly asked to run for all rows.',
    ),
});

export type RunOutreachAiColumnInput = z.infer<
  typeof RunOutreachAiColumnInputZodSchema
>;

export const AiColumnRunIdInputZodSchema = z.object({
  runId: z.string().describe('runId returned by run_ai_column'),
});

export const GetAiColumnRunStatusInputZodSchema =
  AiColumnRunIdInputZodSchema.extend({
    waitSeconds: waitSecondsSchema(AI_COLUMN_DEFAULT_STATUS_WAIT_SECONDS),
  });

const tabSchema = z
  .enum(['people', 'companies'])
  .default('people')
  .describe('The table tab. Default people.');

export const GenerateOutreachTableViewInputZodSchema = z.object({
  projectId: z.string(),
  tab: tabSchema,
  description: z
    .string()
    .min(3)
    .describe(
      'The user\'s request in their own words (for example "show only the CEOs of companies over 500 employees, biggest first"). The server decides whether a filter and/or a sort is needed at all.',
    ),
});

const tableFilterSchema = z.union([
  z.object({
    columnId: z.string(),
    kind: z.literal('values'),
    values: z.array(z.string()),
  }),
  z.object({
    columnId: z.string(),
    kind: z.literal('condition'),
    operator: z.enum([
      'contains',
      'notContains',
      'equals',
      'empty',
      'notEmpty',
      'greaterThan',
      'greaterThanOrEqual',
      'lessThan',
      'lessThanOrEqual',
    ]),
    value: z.string(),
  }),
]);

export const ApplyOutreachTableViewInputZodSchema = z.object({
  projectId: z.string(),
  tab: tabSchema,
  filters: z
    .array(tableFilterSchema)
    .default([])
    .describe('Filters from generate_table_view, passed unchanged'),
  sort: z
    .object({
      columnId: z.string(),
      direction: z.enum(['asc', 'desc']),
    })
    .nullable()
    .optional()
    .describe('Sort from generate_table_view, passed unchanged'),
  summary: z.string().optional(),
  clear: z
    .boolean()
    .optional()
    .describe('true removes every filter and the sort'),
});

export const RemoveOutreachAiColumnInputZodSchema = z.object({
  projectId: z.string().describe('Project id from the outreach browsing context'),
  subject: subjectSchema,
  columnKeys: z
    .array(z.string().min(1))
    .min(1)
    .describe(
      'AI column keys to remove from every working-set row (value + aiColumns meta). Use keys from get_outreach_working_set.aiColumns.',
    ),
});

export type RemoveOutreachAiColumnInput = z.infer<
  typeof RemoveOutreachAiColumnInputZodSchema
>;

export const UndoChatOutreachInputZodSchema = z.object({
  threadId: z
    .string()
    .uuid()
    .optional()
    .describe(
      'Ask AI chat thread id to revert. Defaults to the current chat thread when omitted.',
    ),
});

export type UndoChatOutreachInput = z.infer<
  typeof UndoChatOutreachInputZodSchema
>;
