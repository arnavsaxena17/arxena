import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useAtomFamilyStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomFamilyStateValue';
import { useSetAtomFamilyState } from '@/ui/utilities/state/jotai/hooks/useSetAtomFamilyState';
import { TEST_AI_AGENT } from '@/workflow/workflow-steps/workflow-actions/ai-agent-action/graphql/mutations/testAiAgent';
import { aiAgentTestDataFamilyState } from '@/workflow/workflow-steps/workflow-actions/ai-agent-action/states/aiAgentTestDataFamilyState';
import { useMutation } from '@apollo/client/react';
import { t } from '@lingui/core/macro';
import { isObject, isString } from '@sniptt/guards';
import { useState } from 'react';
import { isDefined, parseJson, resolveInput } from 'twenty-shared/utils';

type TestAiAgentResponse = {
  success: boolean;
  message: string;
  result?: unknown;
  error?: string | null;
  durationMs?: number | null;
};

type TestAiAgentMutationResult = {
  testAiAgent: TestAiAgentResponse;
};

const convertFlatVariablesToNestedContext = (flatVariables: {
  [variablePath: string]: string;
}): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(flatVariables)) {
    const parts = key.split('.');
    let current = result;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
  }

  return result;
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

  const testAiAgent = async ({
    agentId,
    prompt,
    variableValues,
  }: {
    agentId: string;
    prompt: string;
    variableValues: { [variablePath: string]: string };
  }) => {
    setIsTesting(true);
    const startTime = Date.now();

    try {
      const nestedVariableContext =
        convertFlatVariablesToNestedContext(variableValues);
      const substitutedPrompt = resolveInput(
        prompt,
        nestedVariableContext,
      ) as string;

      const result = await mutate({
        variables: {
          input: {
            agentId,
            prompt: substitutedPrompt,
          },
        },
      });

      const duration = Date.now() - startTime;
      const response = result?.data?.testAiAgent;

      if (!response) {
        throw new Error(t`No response from server`);
      }

      const durationMs = response.durationMs ?? duration;

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
          },
          language,
        }));
      } else {
        throw new Error(
          isString(response.error)
            ? response.error
            : response.message || t`AI agent test failed`,
        );
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
    isTesting,
    aiAgentTestData,
  };
};
