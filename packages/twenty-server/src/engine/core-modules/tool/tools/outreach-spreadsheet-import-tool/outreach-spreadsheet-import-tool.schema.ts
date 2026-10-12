import { z } from 'zod';

import { OutreachSpreadsheetMappingZodSchema } from 'src/engine/core-modules/tool/tools/outreach-spreadsheet-import-tool/outreach-spreadsheet-mapping.util';

const sheetSelection = {
  fileId: z
    .string()
    .min(1)
    .describe(
      'fileId of the attached spreadsheet, from the "[Spreadsheet attached …]" note on the user message',
    ),
  sheetName: z
    .string()
    .optional()
    .describe('Sheet to read. Defaults to the first sheet'),
  headerRow: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe('1-based header row. Detected automatically when omitted'),
};

export const InspectOutreachSpreadsheetInputZodSchema = z.object(sheetSelection);

export const ImportOutreachSpreadsheetInputZodSchema = z.object({
  ...sheetSelection,
  projectId: z
    .string()
    .min(1)
    .describe('Project.id the rows are imported into. Required.'),
  target: z
    .enum(['companies', 'people', 'both'])
    .describe(
      'companies = only the Companies tab, people = only the People tab, both = each',
    ),
  mapping: OutreachSpreadsheetMappingZodSchema.optional().describe(
    'Column mapping confirmed with the user. Defaults to the suggestion from inspect_outreach_spreadsheet',
  ),
  mode: z
    .enum(['merge', 'replace'])
    .default('merge')
    .describe(
      'merge = upsert into the existing tab lists; replace = overwrite the lists',
    ),
});

export type ImportOutreachSpreadsheetInput = z.infer<
  typeof ImportOutreachSpreadsheetInputZodSchema
>;
