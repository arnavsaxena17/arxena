import { useMutation } from '@apollo/client/react';
import { useState } from 'react';

import { TEST_WORKFLOW_AI_FILTERING } from '@/workflow/workflow-steps/workflow-actions/ai-filtering-action/graphql/mutations/testWorkflowAiFiltering';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';

type TestWorkflowAiFilteringMutationResult = {
  testWorkflowAiFiltering: {
    success: boolean;
    message: string;
    result?: object | null;
    error?: string | null;
    durationMs?: number | null;
  };
};

export type AiFilteringTestData = {
  success: boolean;
  message: string;
  result?: object | null;
  error?: string | null;
  durationMs?: number | null;
};

const DEFAULT_TEST_DATA: AiFilteringTestData = {
  success: false,
  message: '',
  result: null,
  error: null,
  durationMs: null,
};

export const useTestWorkflowAiFiltering = () => {
  const { enqueueErrorSnackBar } = useSnackBar();
  const [isTesting, setIsTesting] = useState(false);
  const [testData, setTestData] =
    useState<AiFilteringTestData>(DEFAULT_TEST_DATA);

  const [mutate] = useMutation<TestWorkflowAiFilteringMutationResult>(
    TEST_WORKFLOW_AI_FILTERING,
  );

  const testAiFiltering = async (input: {
    prompt: string;
    selectedModel?: string;
    name?: string;
    selectedMetadataFields?: string[];
    includeResume?: boolean;
    fields: Array<{
      name: string;
      type: string;
      description?: string;
      enumValues?: string[];
    }>;
    candidates?: unknown;
  }) => {
    setIsTesting(true);

    try {
      const response = await mutate({ variables: { input } });
      const payload = response.data?.testWorkflowAiFiltering;

      if (!payload) {
        throw new Error('No response from AI filtering test');
      }

      setTestData(payload);

      return payload;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'AI filtering test failed';

      enqueueErrorSnackBar({ message });
      setTestData({
        ...DEFAULT_TEST_DATA,
        success: false,
        message,
        error: message,
      });

      return null;
    } finally {
      setIsTesting(false);
    }
  };

  return {
    testAiFiltering,
    isTesting,
    testData,
    setTestData,
  };
};
