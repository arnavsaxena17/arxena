import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { type WorkflowFormAction } from '@/workflow/types/Workflow';
import { useAtomFamilyStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomFamilyStateValue';
import { useSetAtomFamilyState } from '@/ui/utilities/state/jotai/hooks/useSetAtomFamilyState';
import { TEST_WORKFLOW_FORM_NOTIFY } from '@/workflow/workflow-steps/workflow-actions/form-action/graphql/mutations/testWorkflowFormNotify';
import { WORKFLOW_FORM_NOTIFY_TEST } from '@/workflow/workflow-steps/workflow-actions/form-action/graphql/queries/workflowFormNotifyTest';
import { workflowFormNotifyTestDataFamilyState } from '@/workflow/workflow-steps/workflow-actions/form-action/states/workflowFormNotifyTestDataFamilyState';
import { type WorkflowFormNotifyTestOutput } from '@/workflow/workflow-steps/workflow-actions/form-action/types/WorkflowFormNotifyTestData';
import { type WorkflowFormNotifyOnPendingSettings } from '@/workflow/workflow-steps/workflow-actions/form-action/utils/getWorkflowFormNotifyVariablesUsed';
import { useMutation } from '@apollo/client/react';
import { t } from '@lingui/core/macro';
import { useCallback, useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

type TestWorkflowFormNotifyPayload = WorkflowFormNotifyTestOutput & {
  testId: string;
  status: string;
};

type TestWorkflowFormNotifyMutationResult = {
  testWorkflowFormNotify: TestWorkflowFormNotifyPayload;
};

type WorkflowFormNotifyTestQueryResult = {
  workflowFormNotifyTest: TestWorkflowFormNotifyPayload;
};

export const useTestWorkflowFormNotify = (actionId: string) => {
  const apolloCoreClient = useApolloCoreClient();
  const [isSending, setIsSending] = useState(false);
  const pollTimeoutAtRef = useRef<number | null>(null);
  const workflowFormNotifyTestData = useAtomFamilyStateValue(
    workflowFormNotifyTestDataFamilyState,
    actionId,
  );
  const setWorkflowFormNotifyTestData = useSetAtomFamilyState(
    workflowFormNotifyTestDataFamilyState,
    actionId,
  );

  const [mutate] = useMutation<TestWorkflowFormNotifyMutationResult>(
    TEST_WORKFLOW_FORM_NOTIFY,
    {
      client: apolloCoreClient,
    },
  );

  const applyOutput = useCallback(
    (output: WorkflowFormNotifyTestOutput, duration?: number) => {
      setTestData((prev) => ({
        ...prev,
        language: 'json',
        output: {
          ...prev.output,
          ...output,
          duration: duration ?? prev.output.duration,
        },
      }));
    },
    [],
  );

  const pollTest = useCallback(
    async (testId: string) => {
      const result = await apolloCoreClient.query<WorkflowFormNotifyTestQueryResult>(
        {
          query: WORKFLOW_FORM_NOTIFY_TEST,
          variables: { testId },
          fetchPolicy: 'network-only',
        },
      );

      return result.data?.workflowFormNotifyTest;
    },
    [apolloCoreClient],
  );

  const testId = testData.output.testId;
  const outputStatus = testData.output.status;

  useEffect(() => {
    if (!testId || outputStatus !== 'waiting') {
      return;
    }

    if (pollTimeoutAtRef.current === null) {
      pollTimeoutAtRef.current = Date.now() + POLL_TIMEOUT_MS;
    }

    const intervalId = window.setInterval(async () => {
      if (
        pollTimeoutAtRef.current !== null &&
        Date.now() > pollTimeoutAtRef.current
      ) {
        applyOutput({
          testId,
          status: 'expired',
          error: t`Timed out waiting for a WhatsApp / form reply`,
        });
        pollTimeoutAtRef.current = null;

        return;
      }

      try {
        const next = await pollTest(testId);

        if (!next) {
          return;
        }

        applyOutput(next);

        if (next.status !== 'waiting') {
          pollTimeoutAtRef.current = null;
        }
      } catch {
        // Keep polling until timeout
      }
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [applyOutput, outputStatus, pollTest, testId]);

  const testWorkflowFormNotify = async (action: WorkflowFormAction) => {
    setIsSending(true);
    pollTimeoutAtRef.current = Date.now() + POLL_TIMEOUT_MS;
    const startTime = Date.now();
    const notifyOnPending = (
      action.settings as {
        notifyOnPending?: WorkflowFormNotifyOnPendingSettings;
      }
    ).notifyOnPending;

    try {
      const result = await mutate({
        variables: {
          input: {
            stepId: action.id,
            fields: action.settings.input,
            notifyOnPending: notifyOnPending ?? {},
            variableValues: testData.variableValues,
          },
        },
      });

      const duration = Date.now() - startTime;
      const response = result?.data?.testWorkflowFormNotify;

      if (!response) {
        throw new Error(t`No response from server`);
      }

      applyOutput(response, duration);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : t`Form WhatsApp test failed`;

      applyOutput(
        {
          status: 'failed',
          error: errorMessage,
        },
        duration,
      );
      pollTimeoutAtRef.current = null;
    } finally {
      setIsSending(false);
    }
  };

  return {
    testWorkflowFormNotify,
    isSending,
    isWaiting: testData.output.status === 'waiting',
    testData,
  };
};
