import { z } from 'zod';

import {
  OUTREACH_LIST_MAX_ROWS,
  OUTREACH_LIST_PEEK_MAX_ROWS,
} from 'src/engine/core-modules/outreach-list/outreach-list.constants';

export const OUTREACH_LIST_ACTIONS = [
  'list',
  'summary',
  'peek',
  'export',
  'dedupe',
  'attach',
  'save_to_crm',
  'delete',
] as const;

export const OutreachListToolInputZodSchema = z.object({
  action: z.enum(OUTREACH_LIST_ACTIONS),
  listId: z
    .string()
    .optional()
    .describe('List id from a search result. Not needed for action list'),
  offset: z
    .number()
    .min(0)
    .optional()
    .describe('peek / attach / save_to_crm: first row index'),
  limit: z
    .number()
    .min(1)
    .max(OUTREACH_LIST_MAX_ROWS)
    .optional()
    .describe(
      `peek: at most ${OUTREACH_LIST_PEEK_MAX_ROWS} rows. attach and save_to_crm: rows per call, at most ${OUTREACH_LIST_MAX_ROWS}`,
    ),
  against: z
    .enum(['crm', 'lists'])
    .optional()
    .describe(
      'dedupe: compare with existing CRM records or with the other lists',
    ),
  remove: z
    .boolean()
    .optional()
    .describe('dedupe: drop the matching rows instead of only flagging them'),
  projectId: z
    .string()
    .optional()
    .describe(
      'attach and save_to_crm: the project to tag the rows to. Ask the user when unknown',
    ),
});

export type OutreachListToolInput = z.infer<
  typeof OutreachListToolInputZodSchema
>;
