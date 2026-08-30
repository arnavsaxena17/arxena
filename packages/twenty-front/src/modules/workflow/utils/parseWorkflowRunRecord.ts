import { z } from 'zod';

import { type WorkflowRun } from '@/workflow/types/Workflow';
import { withDefaultWorkflowActionErrorHandlingOptions } from '@/workflow/utils/withDefaultWorkflowActionErrorHandlingOptions';
import { isDefined } from 'twenty-shared/utils';
import { workflowRunSchema } from 'twenty-shared/workflow';

type WorkflowRunRecordLike = {
  workflowVersionId?: string | null;
  workflowVersion?: { id?: string | null } | null;
  workflowId?: string | null;
  workflow?: { id?: string | null } | null;
};

const lenientWorkflowRunSchema = workflowRunSchema.extend({
  workflowVersionId: z.string().nullable(),
  name: z.string().nullable(),
});

export const parseWorkflowRunRecord = (
  rawRecord: unknown,
): WorkflowRun | undefined => {
  if (!isDefined(rawRecord) || typeof rawRecord !== 'object') {
    return undefined;
  }

  const record = rawRecord as WorkflowRunRecordLike;
  const parseResult = lenientWorkflowRunSchema.safeParse(
    withDefaultWorkflowActionErrorHandlingOptions({
      ...record,
      workflowVersionId:
        record.workflowVersionId ?? record.workflowVersion?.id ?? null,
      workflowId: record.workflowId ?? record.workflow?.id ?? null,
    }),
  );

  if (!parseResult.success) {
    return undefined;
  }

  return parseResult.data;
};
