import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useAtomFamilyStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomFamilyStateValue';
import { useSetAtomFamilyState } from '@/ui/utilities/state/jotai/hooks/useSetAtomFamilyState';
import { TEST_AI_AGENT } from '@/workflow/workflow-steps/workflow-actions/ai-agent-action/graphql/mutations/testAiAgent';
import { aiAgentTestDataFamilyState } from '@/workflow/workflow-steps/workflow-actions/ai-agent-action/states/aiAgentTestDataFamilyState';
import { type AiAgentOutputValidationReport } from '@/workflow/workflow-steps/workflow-actions/ai-agent-action/types/AiAgentTestData';
import { useMutation } from '@apollo/client/react';
import { t } from '@lingui/core/macro';
import { isObject, isString } from '@sniptt/guards';
import { useState } from 'react';
import { isDefined, parseJson } from 'twenty-shared/utils';

type TestAiAgentResponse = {
  success: boolean;
  message: string;
  result?: unknown;
  error?: string | null;
  durationMs?: number | null;
  outputValidation?: AiAgentOutputValidationReport | null;
};

type TestAiAgentMutationResult = {
  testAiAgent: TestAiAgentResponse;
};

export const useTestAiAgent = (actionId: string) => {
  const apolloCoreClient = useApolloCoreClient();
  const [isTesting, setIsTesting] = useState(false);
  const aiAgentTestData = useAtomFamilyStateValue(
    aiAgentTestDataFamilyState,
    actionId,
  );
  const setAiAgentTestData = useSetAtomFamilyState(
    aiAgentTestDataFamilyState,
    actionId,
  );

  const [mutate] = useMutation<TestAiAgentMutationResult>(TEST_AI_AGENT, {
    client: apolloCoreClient,
  });

  const showTestError = (errorMessage: string) => {
    setAiAgentTestData((prev) => ({
      ...prev,
      output: {
        data: undefined,
        duration: undefined,
        error: errorMessage,
      },
      language: 'plaintext',
    }));
  };

  const testAiAgent = async ({
    agentId,
    prompt,
    candidateId,
    workflowVersionId,
    stepId,
    outputValidation,
  }: {
    agentId: string;
    prompt: string;
    candidateId?: string;
    workflowVersionId?: string;
    stepId?: string;
    outputValidation?: {
      enabled: boolean;
      fieldKeys: string[];
      checks?: Array<{
        id: string;
        label: string;
        instructions: string;
        invalidWhen: string;
        validWhen: string;
      }>;
    };
  }) => {
    setIsTesting(true);
    const startTime = Date.now();

    try {
      const result = await mutate({
        variables: {
          input: {
            agentId,
            prompt,
            ...(isDefined(candidateId) ? { candidateId } : {}),
            ...(isDefined(workflowVersionId) ? { workflowVersionId } : {}),
            ...(isDefined(stepId) ? { stepId } : {}),
            ...(isDefined(outputValidation) ? { outputValidation } : {}),
          },
        },
      });

      const duration = Date.now() - startTime;
      const response = result?.data?.testAiAgent;

      if (!response) {
        throw new Error(t`No response from server`);
      }

      const durationMs = response.durationMs ?? duration;
      const validationReport = isDefined(response.outputValidation)
        ? response.outputValidation
        : undefined;

      if (response.success === true) {
        const resultData = isString(response.result)
          ? response.result
          : JSON.stringify(response.result, null, 2);
        const language = isObject(response.result) ? 'json' : 'plaintext';

        setAiAgentTestData((prev) => ({
          ...prev,
          output: {
            data: resultData,
            duration: durationMs,
            error: undefined,
            outputValidation: validationReport,
          },
          language,
        }));
      } else {
        const errorMessage = isString(response.error)
          ? response.error
          : response.message || t`AI agent test failed`;

        setAiAgentTestData((prev) => ({
          ...prev,
          output: {
            data: undefined,
            duration: durationMs,
            error: errorMessage,
            outputValidation: validationReport,
          },
          language: 'plaintext',
        }));
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const rawErrorMessage =
        error instanceof Error ? error.message : t`AI agent test failed`;
      const jsonParsedErrorMessage = parseJson(rawErrorMessage);
      const errorMessage = isDefined(jsonParsedErrorMessage)
        ? JSON.stringify(jsonParsedErrorMessage, null, 2)
        : rawErrorMessage;
      const language = isDefined(jsonParsedErrorMessage) ? 'json' : 'plaintext';

      setAiAgentTestData((prev) => ({
        ...prev,
        output: {
          data: undefined,
          duration,
          error: errorMessage,
        },
        language,
      }));
    } finally {
      setIsTesting(false);
    }
  };

  return {
    testAiAgent,
    showTestError,
    isTesting,
    aiAgentTestData,
  };
};
