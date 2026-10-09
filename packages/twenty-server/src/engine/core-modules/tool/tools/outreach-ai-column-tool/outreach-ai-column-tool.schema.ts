import { z } from 'zod';

const subjectSchema = z
  .enum(['person', 'company'])
  .default('person')
  .describe(
    'Default and almost always: person (the People tab rows; also for questions about the people\'s companies, using companyName). company only when the user is on the Companies tab.',
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
    rowLimit: z.number().int().min(1).max(10).default(10),
  })
  .refine((input) => input.description !== undefined || input.filter !== undefined, {
    message: 'Pass description (preferred) or filter',
  });

export type PreviewOutreachAiColumnInput = z.infer<
  typeof PreviewOutreachAiColumnInputZodSchema
>;

export const RunOutreachAiColumnInputZodSchema = z.object({
  projectId: z.string(),
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
});

export type RunOutreachAiColumnInput = z.infer<
  typeof RunOutreachAiColumnInputZodSchema
>;

export const AiColumnRunIdInputZodSchema = z.object({
  runId: z.string().describe('runId returned by run_ai_column'),
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
