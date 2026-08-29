import { useLazyFindManyRecords } from '@/object-record/hooks/useLazyFindManyRecords';
import {
  buildVariableContextFromStepInfos,
  extractWorkflowVariablePaths,
  resolveAiAgentTestPrompt,
} from '@/workflow/workflow-steps/workflow-actions/ai-agent-action/utils/resolveAiAgentTestPrompt';
import { useCallback } from 'react';
import { CoreObjectNameSingular } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

const RECENT_RUN_LIMIT = 20;

type WorkflowRunWithStepInfos = {
  id: string;
  status?: string;
  state?: {
    stepInfos?: Record<string, { result?: unknown } | undefined>;
  } | null;
};

export const useResolveAiAgentTestPromptFromLatestRun = (
  workflowId: string | undefined,
) => {
  const { findManyRecordsLazy } = useLazyFindManyRecords({
    objectNameSingular: CoreObjectNameSingular.WorkflowRun,
    filter: isDefined(workflowId)
      ? { workflowId: { eq: workflowId } }
      : undefined,
    orderBy: [{ createdAt: 'DescNullsFirst' }],
    limit: RECENT_RUN_LIMIT,
    recordGqlFields: {
      id: true,
      status: true,
      state: true,
    },
  });

  const resolvePrompt = useCallback(
    async (prompt: string) => {
      const variablePaths = extractWorkflowVariablePaths(prompt);

      if (variablePaths.length === 0) {
        return {
          resolvedPrompt: prompt,
          missingVariablePaths: [] as string[],
        };
      }

      if (!isDefined(workflowId)) {
        return {
          resolvedPrompt: prompt,
          missingVariablePaths: variablePaths,
        };
      }

      const { records } = await findManyRecordsLazy();
      const runs = (records ?? []) as WorkflowRunWithStepInfos[];

      let missingVariablePaths = variablePaths;

      for (const run of runs) {
        const context = buildVariableContextFromStepInfos(
          run.state?.stepInfos,
        );
        const resolved = resolveAiAgentTestPrompt({ prompt, context });

        if (resolved.missingVariablePaths.length === 0) {
          return resolved;
        }

        missingVariablePaths = resolved.missingVariablePaths;
      }

      return {
        resolvedPrompt: prompt,
        missingVariablePaths,
      };
    },
    [findManyRecordsLazy, workflowId],
  );

  return { resolvePrompt };
};
