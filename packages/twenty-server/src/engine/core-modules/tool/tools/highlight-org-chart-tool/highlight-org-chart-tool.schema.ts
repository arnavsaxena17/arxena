import { z } from 'zod';

const searchTermSchema = z.string().trim().min(1).max(80);

export const HighlightOrgChartInputZodSchema = z
  .object({
    searchTerms: z
      .array(searchTermSchema)
      .max(3)
      .optional()
      .describe(
        '1–3 phrases that match org-chart node headlines, person names, or titles (e.g. "product design").',
      ),
    stdFunction: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe(
        'Resolved std_function label to filter the tree (Title Query).',
      ),
    stdFunctionRoot: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe('Resolved std_function_root label to filter the tree.'),
    stdGrade: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe('Resolved std_grade: entry, mid, or leadership.'),
    nodeKeys: z
      .array(z.union([z.string(), z.number()]))
      .max(50)
      .optional()
      .describe(
        'Exact org-chart node keys from list_org_chart_positions. Prefer these over searchTerms when discussing specific positions.',
      ),
    clear: z
      .boolean()
      .optional()
      .describe('Clear highlights on the open org chart.'),
  })
  .refine(
    (value) =>
      value.clear === true ||
      (value.searchTerms !== undefined && value.searchTerms.length > 0) ||
      (value.nodeKeys !== undefined && value.nodeKeys.length > 0) ||
      Boolean(value.stdFunction) ||
      Boolean(value.stdFunctionRoot),
    {
      message:
        'Provide searchTerms, nodeKeys, taxonomy filters, or clear: true.',
    },
  );

export type HighlightOrgChartInput = z.infer<
  typeof HighlightOrgChartInputZodSchema
>;
