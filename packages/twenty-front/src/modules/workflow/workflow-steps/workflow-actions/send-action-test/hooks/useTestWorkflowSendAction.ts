import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useAtomFamilyStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomFamilyStateValue';
import { useSetAtomFamilyState } from '@/ui/utilities/state/jotai/hooks/useSetAtomFamilyState';
import { TEST_WORKFLOW_SEND_ACTION } from '@/workflow/workflow-steps/workflow-actions/send-action-test/graphql/mutations/testWorkflowSendAction';
import { workflowSendActionTestDataFamilyState } from '@/workflow/workflow-steps/workflow-actions/send-action-test/states/workflowSendActionTestDataFamilyState';
import { type WorkflowSendActionTestChannel } from '@/workflow/workflow-steps/workflow-actions/send-action-test/types/WorkflowSendActionTestChannel';
import { useMutation } from '@apollo/client/react';
import { t } from '@lingui/core/macro';
import { isObject, isString } from '@sniptt/guards';
import { useState } from 'react';
import { isDefined, parseJson } from 'twenty-shared/utils';

type TestWorkflowSendActionResponse = {
  success: boolean;
  message: string;
  result?: unknown;
  error?: string | null;
  durationMs?: number | null;
};

type TestWorkflowSendActionMutationResult = {
  testWorkflowSendAction: TestWorkflowSendActionResponse;
};

export const useTestWorkflowSendAction = (actionId: string) => {
  const apolloCoreClient = useApolloCoreClient();
  const [isTesting, setIsTesting] = useState(false);
  const sendActionTestData = useAtomFamilyStateValue(
    workflowSendActionTestDataFamilyState,
    actionId,
  );
  const setSendActionTestData = useSetAtomFamilyState(
    workflowSendActionTestDataFamilyState,
    actionId,
  );

  const [mutate] = useMutation<TestWorkflowSendActionMutationResult>(
    TEST_WORKFLOW_SEND_ACTION,
    {
      client: apolloCoreClient,
    },
  );

  const showTestError = (errorMessage: string) => {
    setSendActionTestData((previous) => ({
      ...previous,
      output: {
        data: undefined,
        duration: undefined,
        error: errorMessage,
      },
      language: 'plaintext',
    }));
  };

  const testWorkflowSendAction = async ({
    channel,
    workflowVersionId,
    stepId,
    candidateId,
    body,
    subject,
    connectedAccountId,
  }: {
    channel: WorkflowSendActionTestChannel;
    workflowVersionId: string;
    stepId: string;
    candidateId: string;
    body: string;
    subject?: string;
    connectedAccountId?: string;
  }) => {
    setIsTesting(true);
    const startTime = Date.now();

    try {
      const result = await mutate({
        variables: {
          input: {
            channel,
            workflowVersionId,
            stepId,
            candidateId,
            body,
            ...(isDefined(subject) ? { subject } : {}),
            ...(isDefined(connectedAccountId) ? { connectedAccountId } : {}),
          },
        },
      });

      const duration = Date.now() - startTime;
      const response = result?.data?.testWorkflowSendAction;

      if (!response) {
        throw new Error(t`No response from server`);
      }

      const durationMs = response.durationMs ?? duration;

      if (response.success === true) {
        const resultData = isString(response.result)
          ? response.result
          : JSON.stringify(response.result, null, 2);
        const language = isObject(response.result) ? 'json' : 'plaintext';

        setSendActionTestData((previous) => ({
          ...previous,
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
            : response.message || t`Send test failed`,
        );
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const rawErrorMessage =
        error instanceof Error ? error.message : t`Send test failed`;
      const jsonParsedErrorMessage = parseJson(rawErrorMessage);
      const errorMessage = isDefined(jsonParsedErrorMessage)
        ? JSON.stringify(jsonParsedErrorMessage, null, 2)
        : rawErrorMessage;
      const language = isDefined(jsonParsedErrorMessage) ? 'json' : 'plaintext';

      setSendActionTestData((previous) => ({
        ...previous,
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
    testWorkflowSendAction,
    showTestError,
    isTesting,
    sendActionTestData,
  };
};
