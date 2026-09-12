import { FormSingleRecordPicker } from '@/object-record/record-field/ui/form-types/components/FormSingleRecordPicker';
import { FormTextFieldInput } from '@/object-record/record-field/ui/form-types/components/FormTextFieldInput';
import { TabList } from '@/ui/layout/tab-list/components/TabList';
import { activeTabIdComponentState } from '@/ui/layout/tab-list/states/activeTabIdComponentState';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { type WorkflowSendWhatsappMessageAction } from '@/workflow/types/Workflow';
import { workflowVisualizerWorkflowVersionIdComponentState } from '@/workflow/states/workflowVisualizerWorkflowVersionIdComponentState';
import { WorkflowStepBody } from '@/workflow/workflow-steps/components/WorkflowStepBody';
import { WorkflowStepCmdEnterButton } from '@/workflow/workflow-steps/components/WorkflowStepCmdEnterButton';
import { WorkflowStepFooter } from '@/workflow/workflow-steps/components/WorkflowStepFooter';
import {
  WORKFLOW_SEND_ACTION_TAB,
  type WorkflowSendActionTabId,
} from '@/workflow/workflow-steps/workflow-actions/send-action-test/constants/WorkflowSendActionTest';
import { WorkflowSendActionTestTab } from '@/workflow/workflow-steps/workflow-actions/send-action-test/components/WorkflowSendActionTestTab';
import { useTestWorkflowSendAction } from '@/workflow/workflow-steps/workflow-actions/send-action-test/hooks/useTestWorkflowSendAction';
import { useUnipileMessagingForm } from '@/workflow/workflow-steps/workflow-actions/unipile-messaging-action/hooks/useUnipileMessagingForm';
import { WorkflowVariablePicker } from '@/workflow/workflow-variables/components/WorkflowVariablePicker';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { isNonEmptyString } from '@sniptt/guards';
import { useEffect, useState } from 'react';
import { CoreObjectNameSingular } from 'twenty-shared/types';
import { isDefined, isValidUuid } from 'twenty-shared/utils';
import { IconPlayerPlay, IconSettings } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

type FormData = {
  workspaceMemberId: string;
  phone: string;
  body: string;
};

type WorkflowEditActionSendWhatsappMessageProps = {
  action: WorkflowSendWhatsappMessageAction;
  actionOptions:
    | {
        readonly: true;
      }
    | {
        readonly?: false;
        onActionUpdate: (action: WorkflowSendWhatsappMessageAction) => void;
      };
};

const WORKFLOW_SEND_WHATSAPP_TAB_LIST_COMPONENT_ID =
  'workflow-send-whatsapp-tab-list';

const StyledTabListContainer = styled.div`
  background-color: ${themeCssVariables.background.secondary};
  padding-left: ${themeCssVariables.spacing[2]};
`;

const StyledConfigurationTabContent = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
`;

export const WorkflowEditActionSendWhatsappMessage = ({
  action,
  actionOptions,
}: WorkflowEditActionSendWhatsappMessageProps) => {
  const { t } = useLingui();
  const activeTabId = useAtomComponentStateValue(
    activeTabIdComponentState,
    WORKFLOW_SEND_WHATSAPP_TAB_LIST_COMPONENT_ID,
  ) as WorkflowSendActionTabId | null;
  const currentTabId = activeTabId ?? WORKFLOW_SEND_ACTION_TAB.CONFIGURATION;
  const workflowVisualizerWorkflowVersionId = useAtomComponentStateValue(
    workflowVisualizerWorkflowVersionIdComponentState,
  );

  const { formData, handleFieldChange, saveAction } = useUnipileMessagingForm({
    initialFormData: {
      workspaceMemberId: action.settings.input.workspaceMemberId,
      phone: action.settings.input.phone,
      body: action.settings.input.body ?? '',
    },
    readonly: actionOptions.readonly === true,
    onSave: (nextFormData: FormData) => {
      if (actionOptions.readonly === true) {
        return;
      }

      actionOptions.onActionUpdate({
        ...action,
        settings: {
          ...action.settings,
          input: nextFormData,
        },
      });
    },
  });

  const {
    testWorkflowSendAction,
    showTestError,
    isTesting,
    sendActionTestData,
  } = useTestWorkflowSendAction(action.id);
  const [testCandidateId, setTestCandidateId] = useState<string | undefined>();
  const [testBody, setTestBody] = useState('');

  useEffect(() => {
    return () => {
      saveAction.flush();
    };
  }, [saveAction]);

  const tabs = [
    {
      id: WORKFLOW_SEND_ACTION_TAB.CONFIGURATION,
      title: t`Configuration`,
      Icon: IconSettings,
    },
    {
      id: WORKFLOW_SEND_ACTION_TAB.TEST,
      title: t`Test`,
      Icon: IconPlayerPlay,
    },
  ];

  const handleTestSend = async () => {
    if (actionOptions.readonly === true) {
      return;
    }

    if (!isNonEmptyString(testCandidateId) || !isValidUuid(testCandidateId)) {
      showTestError(t`Pick a candidate before testing`);

      return;
    }

    if (!isNonEmptyString(testBody.trim())) {
      showTestError(t`Enter a message body before testing`);

      return;
    }

    if (!isDefined(workflowVisualizerWorkflowVersionId)) {
      showTestError(t`Workflow version is missing`);

      return;
    }

    await testWorkflowSendAction({
      channel: 'WHATSAPP',
      workflowVersionId: workflowVisualizerWorkflowVersionId,
      stepId: action.id,
      candidateId: testCandidateId,
      body: testBody,
    });
  };

  return (
    <>
      <StyledTabListContainer>
        <TabList
          tabs={tabs}
          behaveAsLinks={false}
          componentInstanceId={WORKFLOW_SEND_WHATSAPP_TAB_LIST_COMPONENT_ID}
        />
      </StyledTabListContainer>
      <WorkflowStepBody>
        {currentTabId === WORKFLOW_SEND_ACTION_TAB.CONFIGURATION ? (
          <StyledConfigurationTabContent>
            <FormSingleRecordPicker
              label={t`Send as`}
              defaultValue={formData.workspaceMemberId || null}
              onChange={(value) =>
                handleFieldChange('workspaceMemberId', value ?? '')
              }
              objectNameSingulars={[CoreObjectNameSingular.WorkspaceMember]}
              disabled={actionOptions.readonly}
              VariablePicker={WorkflowVariablePicker}
            />
            <FormTextFieldInput
              label={t`Phone`}
              placeholder={t`Recipient phone number`}
              readonly={actionOptions.readonly}
              defaultValue={formData.phone}
              onChange={(value) => handleFieldChange('phone', value)}
              VariablePicker={WorkflowVariablePicker}
            />
            <FormTextFieldInput
              label={t`Body`}
              placeholder={t`Message body`}
              multiline
              readonly={actionOptions.readonly}
              defaultValue={formData.body}
              onChange={(value) => handleFieldChange('body', value)}
              VariablePicker={WorkflowVariablePicker}
            />
          </StyledConfigurationTabContent>
        ) : (
          <WorkflowSendActionTestTab
            channel="WHATSAPP"
            candidateId={testCandidateId}
            body={testBody}
            readonly={actionOptions.readonly === true}
            isTesting={isTesting}
            sendActionTestData={sendActionTestData}
            onCandidateChange={setTestCandidateId}
            onBodyChange={setTestBody}
          />
        )}
      </WorkflowStepBody>
      {!actionOptions.readonly && (
        <WorkflowStepFooter
          stepId={action.id}
          additionalActions={
            currentTabId === WORKFLOW_SEND_ACTION_TAB.TEST
              ? [
                  <WorkflowStepCmdEnterButton
                    key="test-send-whatsapp"
                    title={t`Test`}
                    onClick={handleTestSend}
                    disabled={isTesting}
                  />,
                ]
              : []
          }
        />
      )}
    </>
  );
};
