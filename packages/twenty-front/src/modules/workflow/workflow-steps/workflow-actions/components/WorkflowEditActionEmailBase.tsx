import { type ConnectedAccount } from '@/accounts/types/ConnectedAccount';
import { getMissingDraftEmailScopes } from '@/accounts/utils/hasMissingDraftEmailScopes';
import { WorkflowSendEmailAttachments } from '@/advanced-text-editor/components/WorkflowSendEmailAttachments';
import { FormAdvancedTextFieldInput } from '@/object-record/record-field/ui/form-types/components/FormAdvancedTextFieldInput';
import { FormMultiTextFieldInput } from '@/object-record/record-field/ui/form-types/components/FormMultiTextFieldInput';
import { FormSelectFieldInput } from '@/object-record/record-field/ui/form-types/components/FormSelectFieldInput';
import { FormTextFieldInput } from '@/object-record/record-field/ui/form-types/components/FormTextFieldInput';
import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useMyConnectedAccounts } from '@/settings/accounts/hooks/useMyConnectedAccounts';
import { useTriggerApisOAuth } from '@/settings/accounts/hooks/useTriggerApiOAuth';
import { useSidePanelMenu } from '@/side-panel/hooks/useSidePanelMenu';
import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { GenericDropdownContentWidth } from '@/ui/layout/dropdown/constants/GenericDropdownContentWidth';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import { TabList } from '@/ui/layout/tab-list/components/TabList';
import { activeTabIdComponentState } from '@/ui/layout/tab-list/states/activeTabIdComponentState';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { WORKFLOW_STEP_CONNECTED_ACCOUNT_HANDLE } from '@/workflow/graphql/queries/workflowStepConnectedAccountHandle';
import { useWorkflowWithCurrentVersion } from '@/workflow/hooks/useWorkflowWithCurrentVersion';
import { workflowVisualizerWorkflowIdComponentState } from '@/workflow/states/workflowVisualizerWorkflowIdComponentState';
import { workflowVisualizerWorkflowVersionIdComponentState } from '@/workflow/states/workflowVisualizerWorkflowVersionIdComponentState';
import { type WorkflowEmailAction } from '@/workflow/types/WorkflowEmailAction';
import { isStandaloneVariableString } from '@/workflow/utils/isStandaloneVariableString';
import { WorkflowStepBody } from '@/workflow/workflow-steps/components/WorkflowStepBody';
import { WorkflowStepCmdEnterButton } from '@/workflow/workflow-steps/components/WorkflowStepCmdEnterButton';
import { WorkflowStepFooter } from '@/workflow/workflow-steps/components/WorkflowStepFooter';
import { useEmailForm } from '@/workflow/workflow-steps/workflow-actions/hooks/useEmailForm';
import { WorkflowSendActionTestTab } from '@/workflow/workflow-steps/workflow-actions/send-action-test/components/WorkflowSendActionTestTab';
import {
  WORKFLOW_SEND_ACTION_TAB,
  type WorkflowSendActionTabId,
} from '@/workflow/workflow-steps/workflow-actions/send-action-test/constants/WorkflowSendActionTest';
import { useTestWorkflowSendAction } from '@/workflow/workflow-steps/workflow-actions/send-action-test/hooks/useTestWorkflowSendAction';
import { WorkflowVariablePicker } from '@/workflow/workflow-variables/components/WorkflowVariablePicker';
import { useQuery } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { isNonEmptyString } from '@sniptt/guards';
import { useEffect, useState } from 'react';
import { ConnectedAccountProvider, SettingsPath } from 'twenty-shared/types';
import { isDefined, isValidUuid } from 'twenty-shared/utils';
import { Callout } from 'twenty-ui/feedback';
import { IconPlayerPlay, IconPlus, IconSettings } from 'twenty-ui/icon';
import { Button, type SelectOption } from 'twenty-ui/input';
import { MenuItem } from 'twenty-ui/navigation';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useNavigateSettings } from '~/hooks/useNavigateSettings';

const EMAIL_EDITOR_MIN_HEIGHT = 340;

const EMAIL_EDITOR_MAX_WIDTH = 600;

const WORKFLOW_SEND_EMAIL_TAB_LIST_COMPONENT_ID =
  'workflow-send-email-tab-list';

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

type WorkflowEditActionEmailBaseProps = {
  action: WorkflowEmailAction;
  actionOptions:
    | {
        readonly: true;
      }
    | {
        readonly?: false;
        onActionUpdate: (action: WorkflowEmailAction) => void;
      };
};

export const WorkflowEditActionEmailBase = ({
  action,
  actionOptions,
}: WorkflowEditActionEmailBaseProps) => {
  const { t } = useLingui();
  const { triggerApisOAuth } = useTriggerApisOAuth();
  const canTestSend = action.type === 'SEND_EMAIL';
  const activeTabId = useAtomComponentStateValue(
    activeTabIdComponentState,
    WORKFLOW_SEND_EMAIL_TAB_LIST_COMPONENT_ID,
  ) as WorkflowSendActionTabId | null;
  const currentTabId = activeTabId ?? WORKFLOW_SEND_ACTION_TAB.CONFIGURATION;

  const workflowVisualizerWorkflowId = useAtomComponentStateValue(
    workflowVisualizerWorkflowIdComponentState,
  );
  const workflowVisualizerWorkflowVersionId = useAtomComponentStateValue(
    workflowVisualizerWorkflowVersionIdComponentState,
  );

  const workflow = useWorkflowWithCurrentVersion(workflowVisualizerWorkflowId);

  const redirectUrl = `/object/workflow/${workflowVisualizerWorkflowId}`;

  const { formData, handleFieldChange, saveAction } = useEmailForm({
    action,
    onActionUpdate:
      actionOptions.readonly === true
        ? undefined
        : actionOptions.onActionUpdate,
    readonly: actionOptions.readonly === true,
  });

  const {
    testWorkflowSendAction,
    showTestError,
    isTesting,
    sendActionTestData,
  } = useTestWorkflowSendAction(action.id);
  const [testCandidateId, setTestCandidateId] = useState<string | undefined>();
  const [testBody, setTestBody] = useState('');
  const [testSubject, setTestSubject] = useState('');

  const [visibleAdvancedFields, setVisibleAdvancedFields] = useState<{
    cc: boolean;
    bcc: boolean;
    inReplyTo: boolean;
  }>(() => {
    const inputRecipients = action.settings.input.recipients;

    return {
      cc: Boolean(inputRecipients?.cc),
      bcc: Boolean(inputRecipients?.bcc),
      inReplyTo: Boolean(action.settings.input.inReplyTo),
    };
  });

  const { closeDropdown } = useCloseDropdown();

  const advancedOptionsDropdownId = `${action.id}-email-advanced-options`;

  const hasAvailableAdvancedOptions =
    !visibleAdvancedFields.cc ||
    !visibleAdvancedFields.bcc ||
    !visibleAdvancedFields.inReplyTo;

  const handleReauthorize = async () => {
    if (!isDefined(missingScopes)) {
      return;
    }

    await triggerApisOAuth(missingScopes.provider, {
      redirectLocation: redirectUrl,
      loginHint: missingScopes.loginHint,
    });
  };

  const handleConnectedAccountChange = (connectedAccountId: string | null) => {
    handleFieldChange('connectedAccountId', connectedAccountId);
  };

  const apolloCoreClient = useApolloCoreClient();

  const navigate = useNavigateSettings();

  const { closeSidePanelMenu } = useSidePanelMenu();

  const { accounts: myAccounts, loading: myAccountsLoading } =
    useMyConnectedAccounts();

  const configuredAccountId = formData.connectedAccountId;
  const isSenderVariable = isStandaloneVariableString(configuredAccountId);
  const isConfiguredAccountMine = myAccounts.some(
    (account) => account.id === configuredAccountId,
  );

  const { data: otherAccountData, loading: otherAccountLoading } = useQuery<{
    workflowStepConnectedAccountHandle: Pick<
      ConnectedAccount,
      'id' | 'handle' | 'provider'
    > | null;
  }>(WORKFLOW_STEP_CONNECTED_ACCOUNT_HANDLE, {
    client: apolloCoreClient,
    variables: { connectedAccountId: configuredAccountId },
    skip:
      !isDefined(configuredAccountId) ||
      configuredAccountId === '' ||
      isSenderVariable ||
      isConfiguredAccountMine,
  });

  const loading = myAccountsLoading || otherAccountLoading;

  const otherAccount =
    otherAccountData?.workflowStepConnectedAccountHandle ?? null;

  const ownAccount = myAccounts.find(
    (account) => account.id === configuredAccountId,
  );

  const missingDraftScopes =
    action.type === 'DRAFT_EMAIL' && isDefined(ownAccount)
      ? getMissingDraftEmailScopes(ownAccount)
      : [];

  const missingScopes =
    isDefined(ownAccount) &&
    ownAccount.provider !== ConnectedAccountProvider.IMAP_SMTP_CALDAV &&
    missingDraftScopes.length > 0
      ? {
          provider: ownAccount.provider,
          loginHint: ownAccount.handle,
        }
      : null;

  const connectedAccountOptions: SelectOption<string>[] = [];

  myAccounts.forEach((account) => {
    if (
      account.provider === ConnectedAccountProvider.IMAP_SMTP_CALDAV &&
      !isDefined(account.connectionParameters?.SMTP)
    ) {
      return;
    }

    connectedAccountOptions.push({
      label: account.handle,
      value: account.id,
    });
  });

  if (isDefined(otherAccount)) {
    connectedAccountOptions.push({
      label: otherAccount.handle,
      value: otherAccount.id,
    });
  }

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
    if (actionOptions.readonly === true || !canTestSend) {
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

    if (!isNonEmptyString(testSubject.trim())) {
      showTestError(t`Enter a subject before testing`);

      return;
    }

    if (!isDefined(workflowVisualizerWorkflowVersionId)) {
      showTestError(t`Workflow version is missing`);

      return;
    }

    const connectedAccountId =
      isNonEmptyString(formData.connectedAccountId) &&
      !isStandaloneVariableString(formData.connectedAccountId)
        ? formData.connectedAccountId
        : undefined;

    await testWorkflowSendAction({
      channel: 'EMAIL',
      workflowVersionId: workflowVisualizerWorkflowVersionId,
      stepId: action.id,
      candidateId: testCandidateId,
      body: testBody,
      subject: testSubject,
      connectedAccountId,
    });
  };

  const isTestTab =
    canTestSend && currentTabId === WORKFLOW_SEND_ACTION_TAB.TEST;

  return (
    !loading && (
      <>
        {canTestSend && (
          <StyledTabListContainer>
            <TabList
              tabs={tabs}
              behaveAsLinks={false}
              componentInstanceId={WORKFLOW_SEND_EMAIL_TAB_LIST_COMPONENT_ID}
            />
          </StyledTabListContainer>
        )}
        <WorkflowStepBody>
          {isTestTab ? (
            <WorkflowSendActionTestTab
              channel="EMAIL"
              candidateId={testCandidateId}
              body={testBody}
              subject={testSubject}
              readonly={actionOptions.readonly === true}
              isTesting={isTesting}
              sendActionTestData={sendActionTestData}
              onCandidateChange={setTestCandidateId}
              onBodyChange={setTestBody}
              onSubjectChange={setTestSubject}
            />
          ) : (
            <StyledConfigurationTabContent>
              <FormSelectFieldInput
                key={`connected-account-${formData.connectedAccountId ?? 'none'}`}
                label={t`Account`}
                hint={t`Pick a connected account or set a workspace member as variable`}
                defaultValue={formData.connectedAccountId}
                options={connectedAccountOptions}
                onChange={handleConnectedAccountChange}
                VariablePicker={WorkflowVariablePicker}
                readonly={actionOptions.readonly}
                callToActionButton={{
                  onClick: () => {
                    closeSidePanelMenu();
                    navigate(SettingsPath.NewAccount);
                  },
                  Icon: IconPlus,
                  text: t`Add account`,
                }}
              />
              {isDefined(missingScopes) && (
                <>
                  <Callout
                    variant={'error'}
                    title={t`Missing email draft permission.`}
                    description={t`This account is connected, but we don't have permission to draft emails on your behalf yet. You'll be redirected to approve this access.`}
                    action={{
                      label: t`Reauthorize`,
                      onClick: handleReauthorize,
                    }}
                  />
                </>
              )}
              <FormMultiTextFieldInput
                label={t`To`}
                placeholder={t`Enter emails, comma-separated`}
                readonly={actionOptions.readonly}
                defaultValue={formData.recipients.to}
                onChange={(value) => {
                  handleFieldChange('recipients', {
                    ...formData.recipients,
                    to: value,
                  });
                }}
                VariablePicker={WorkflowVariablePicker}
              />
              {visibleAdvancedFields.cc && (
                <FormMultiTextFieldInput
                  label={t`CC`}
                  placeholder={t`Enter CC emails, comma-separated`}
                  readonly={actionOptions.readonly}
                  defaultValue={formData.recipients.cc}
                  onChange={(value) => {
                    handleFieldChange('recipients', {
                      ...formData.recipients,
                      cc: value,
                    });
                  }}
                  VariablePicker={WorkflowVariablePicker}
                />
              )}
              {visibleAdvancedFields.bcc && (
                <FormMultiTextFieldInput
                  label={t`BCC`}
                  placeholder={t`Enter BCC emails, comma-separated`}
                  readonly={actionOptions.readonly}
                  defaultValue={formData.recipients.bcc}
                  onChange={(value) => {
                    handleFieldChange('recipients', {
                      ...formData.recipients,
                      bcc: value,
                    });
                  }}
                  VariablePicker={WorkflowVariablePicker}
                />
              )}
              {visibleAdvancedFields.inReplyTo && (
                <FormTextFieldInput
                  label={t`In-Reply-To`}
                  placeholder={t`Enter Message-ID to reply to`}
                  readonly={actionOptions.readonly}
                  defaultValue={formData.inReplyTo}
                  onChange={(value) => {
                    handleFieldChange('inReplyTo', value);
                  }}
                  VariablePicker={WorkflowVariablePicker}
                />
              )}
              {!actionOptions.readonly && hasAvailableAdvancedOptions && (
                <Dropdown
                  dropdownId={advancedOptionsDropdownId}
                  dropdownPlacement="bottom-start"
                  clickableComponent={
                    <Button
                      title={t`Advanced options`}
                      variant="secondary"
                      accent="default"
                      size="small"
                    />
                  }
                  dropdownComponents={
                    <DropdownContent
                      widthInPixels={GenericDropdownContentWidth.Medium}
                    >
                      <DropdownMenuItemsContainer>
                        {!visibleAdvancedFields.cc && (
                          <MenuItem
                            text={t`Add CC`}
                            onClick={() => {
                              setVisibleAdvancedFields((prev) => ({
                                ...prev,
                                cc: true,
                              }));
                              closeDropdown(advancedOptionsDropdownId);
                            }}
                          />
                        )}
                        {!visibleAdvancedFields.bcc && (
                          <MenuItem
                            text={t`Add BCC`}
                            onClick={() => {
                              setVisibleAdvancedFields((prev) => ({
                                ...prev,
                                bcc: true,
                              }));
                              closeDropdown(advancedOptionsDropdownId);
                            }}
                          />
                        )}
                        {!visibleAdvancedFields.inReplyTo && (
                          <MenuItem
                            text={t`Add In-Reply-To`}
                            onClick={() => {
                              setVisibleAdvancedFields((prev) => ({
                                ...prev,
                                inReplyTo: true,
                              }));
                              closeDropdown(advancedOptionsDropdownId);
                            }}
                          />
                        )}
                      </DropdownMenuItemsContainer>
                    </DropdownContent>
                  }
                />
              )}
              <FormTextFieldInput
                label={t`Subject`}
                placeholder={t`Enter email subject`}
                readonly={actionOptions.readonly}
                defaultValue={formData.subject}
                onChange={(subject) => {
                  handleFieldChange('subject', subject);
                }}
                VariablePicker={WorkflowVariablePicker}
              />
              <FormAdvancedTextFieldInput
                label={t`Body`}
                readonly={actionOptions.readonly}
                defaultValue={formData.body}
                onChange={(body: string) => {
                  handleFieldChange('body', body);
                }}
                VariablePicker={WorkflowVariablePicker}
                enableFullScreen={true}
                fullScreenBreadcrumbs={[
                  {
                    children: workflow?.name?.trim() || t`Untitled Workflow`,
                    href: '#',
                  },
                  {
                    children: isDefined(action.name) ? action.name : t`Email`,
                    href: '#',
                  },
                  {
                    children: t`Email Editor`,
                  },
                ]}
                minHeight={EMAIL_EDITOR_MIN_HEIGHT}
                maxWidth={EMAIL_EDITOR_MAX_WIDTH}
              />
              <WorkflowSendEmailAttachments
                label={t`Attachments`}
                files={formData.files}
                readonly={actionOptions.readonly}
                onChange={(files) => {
                  handleFieldChange('files', files);
                }}
                VariablePicker={WorkflowVariablePicker}
              />
            </StyledConfigurationTabContent>
          )}
        </WorkflowStepBody>
        {!actionOptions.readonly && (
          <WorkflowStepFooter
            stepId={action.id}
            additionalActions={
              isTestTab
                ? [
                    <WorkflowStepCmdEnterButton
                      key="test-send-email"
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
    )
  );
};
