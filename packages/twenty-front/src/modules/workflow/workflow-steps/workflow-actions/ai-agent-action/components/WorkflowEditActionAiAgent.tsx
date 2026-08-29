import { TabList } from '@/ui/layout/tab-list/components/TabList';
import { activeTabIdComponentState } from '@/ui/layout/tab-list/states/activeTabIdComponentState';
import { type SingleTabProps } from '@/ui/layout/tab-list/types/SingleTabProps';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { workflowVisualizerWorkflowIdComponentState } from '@/workflow/states/workflowVisualizerWorkflowIdComponentState';
import { type WorkflowAiAgentAction } from '@/workflow/types/Workflow';
import { WorkflowStepBody } from '@/workflow/workflow-steps/components/WorkflowStepBody';
import { WorkflowStepCmdEnterButton } from '@/workflow/workflow-steps/components/WorkflowStepCmdEnterButton';
import { WorkflowStepFooter } from '@/workflow/workflow-steps/components/WorkflowStepFooter';
import { AiAgentExecutionResult } from '@/workflow/workflow-steps/workflow-actions/ai-agent-action/components/AiAgentExecutionResult';
import { WorkflowAiAgentPermissionsTab } from '@/workflow/workflow-steps/workflow-actions/ai-agent-action/components/WorkflowAiAgentPermissionsTab';
import { WORKFLOW_AI_AGENT_TAB_LIST_COMPONENT_ID } from '@/workflow/workflow-steps/workflow-actions/ai-agent-action/constants/WorkflowAiAgentTabListComponentId';
import { WORKFLOW_AI_AGENT_TABS } from '@/workflow/workflow-steps/workflow-actions/ai-agent-action/constants/WorkflowAiAgentTabs';
import { useResetWorkflowAiAgentPermissionsStateOnSidePanelClose } from '@/workflow/workflow-steps/workflow-actions/ai-agent-action/hooks/useResetWorkflowAiAgentPermissionsStateOnSidePanelClose';
import { useResolveAiAgentTestPromptFromLatestRun } from '@/workflow/workflow-steps/workflow-actions/ai-agent-action/hooks/useResolveAiAgentTestPromptFromLatestRun';
import { useTestAiAgent } from '@/workflow/workflow-steps/workflow-actions/ai-agent-action/hooks/useTestAiAgent';
import { workflowAiAgentActionAgentState } from '@/workflow/workflow-steps/workflow-actions/ai-agent-action/states/workflowAiAgentActionAgentState';
import { workflowAiAgentPermissionsIsAddingPermissionState } from '@/workflow/workflow-steps/workflow-actions/ai-agent-action/states/workflowAiAgentPermissionsIsAddingPermissionState';
import { useQuery } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { SettingsPath } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { Callout } from 'twenty-ui/feedback';
import {
  IconAlertTriangle,
  IconLock,
  IconPlayerPlay,
  IconSparkles,
} from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useDebouncedCallback } from 'use-debounce';
import {
  FindOneAgentDocument,
  GetRolesDocument,
} from '~/generated-metadata/graphql';
import { useNavigateSettings } from '~/hooks/useNavigateSettings';
import { SidePanelSkeletonLoader } from '~/loading/components/SidePanelSkeletonLoader';
import { WorkflowAiAgentPromptTab } from './WorkflowAiAgentPromptTab';

export type WorkflowAiAgentTabId =
  (typeof WORKFLOW_AI_AGENT_TABS)[keyof typeof WORKFLOW_AI_AGENT_TABS];

type WorkflowEditActionAiAgentProps = {
  action: WorkflowAiAgentAction;
  actionOptions:
    | { readonly: true }
    | {
        readonly?: false;
        onActionUpdate: (action: WorkflowAiAgentAction) => void;
      };
};

const StyledTabListContainer = styled.div`
  background-color: ${themeCssVariables.background.secondary};
  padding-left: ${themeCssVariables.spacing[2]};
`;

const StyledTestTabContent = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  height: 100%;
  min-height: 400px;
`;

export const WorkflowEditActionAiAgent = ({
  action,
  actionOptions,
}: WorkflowEditActionAiAgentProps) => {
  const { t } = useLingui();
  const componentInstanceId = `${WORKFLOW_AI_AGENT_TAB_LIST_COMPONENT_ID}-${action.id}`;
  const agentId = action.settings.input.agentId;
  const [workflowAiAgentActionAgent, setWorkflowAiAgentActionAgent] =
    useAtomState(workflowAiAgentActionAgentState);
  const {
    data: agentData,
    loading: agentLoading,
    refetch: refetchAgent,
  } = useQuery(FindOneAgentDocument, {
    variables: { id: agentId || '' },
    skip: !agentId,
  });

  useEffect(() => {
    if (agentData?.findOneAgent) {
      setWorkflowAiAgentActionAgent(agentData.findOneAgent);
    }
  }, [agentData, setWorkflowAiAgentActionAgent]);
  useResetWorkflowAiAgentPermissionsStateOnSidePanelClose();

  const actionPrompt = action.settings.input.prompt || '';
  const [prompt, setPrompt] = useState(actionPrompt);
  const workflowVisualizerWorkflowId = useAtomComponentStateValue(
    workflowVisualizerWorkflowIdComponentState,
  );
  const { resolvePrompt } = useResolveAiAgentTestPromptFromLatestRun(
    workflowVisualizerWorkflowId,
  );
  const { testAiAgent, showTestError, isTesting, aiAgentTestData } =
    useTestAiAgent(action.id);

  const savePrompt = useDebouncedCallback((newPrompt: string) => {
    if (actionOptions.readonly === true) {
      return;
    }

    actionOptions.onActionUpdate({
      ...action,
      settings: {
        ...action.settings,
        input: {
          ...action.settings.input,
          prompt: newPrompt,
        },
      },
    });
  }, 500);

  const handleAgentPromptChange = (newPrompt: string) => {
    setPrompt(newPrompt);
    savePrompt(newPrompt);
  };

  const handleTestAgent = async () => {
    if (actionOptions.readonly === true || !isDefined(agentId)) {
      return;
    }

    const { resolvedPrompt, missingVariablePaths } =
      await resolvePrompt(prompt);

    if (missingVariablePaths.length > 0) {
      showTestError(
        t`This prompt uses values from previous steps. Test fills those chips from a recent workflow run that produced them. Run this branch once, or temporarily replace the chips with sample text.`,
      );
      return;
    }

    await testAiAgent({
      agentId,
      prompt: resolvedPrompt,
    });
  };

  const tabs: SingleTabProps[] = [
    {
      id: WORKFLOW_AI_AGENT_TABS.PROMPT,
      title: t`Prompt`,
      Icon: IconSparkles,
    },
    {
      id: WORKFLOW_AI_AGENT_TABS.PERMISSIONS,
      title: t`Permissions`,
      Icon: IconLock,
    },
    {
      id: WORKFLOW_AI_AGENT_TABS.TEST,
      title: t`Test`,
      Icon: IconPlayerPlay,
    },
  ];

  const activeTabId = useAtomComponentStateValue(
    activeTabIdComponentState,
    componentInstanceId,
  );
  const currentTabId =
    (activeTabId as WorkflowAiAgentTabId) ?? WORKFLOW_AI_AGENT_TABS.PROMPT;

  const navigateSettings = useNavigateSettings();
  const { data: rolesData } = useQuery(GetRolesDocument);

  const [
    workflowAiAgentPermissionsIsAddingPermission,
    setWorkflowAiAgentPermissionsIsAddingPermission,
  ] = useAtomState(workflowAiAgentPermissionsIsAddingPermissionState);

  const role = rolesData?.getRoles.find(
    (item) => item.id === workflowAiAgentActionAgent?.roleId,
  );

  const isCurrentAgentLoaded =
    isDefined(workflowAiAgentActionAgent) &&
    workflowAiAgentActionAgent.id === agentId;

  const handleViewRole = () => {
    if (isDefined(role?.id)) {
      navigateSettings(SettingsPath.RoleDetail, { roleId: role.id });
    }
  };

  const getFooterActions = () => {
    if (currentTabId === WORKFLOW_AI_AGENT_TABS.TEST) {
      return [
        <WorkflowStepCmdEnterButton
          key="test-agent"
          title={t`Test`}
          onClick={handleTestAgent}
          disabled={isTesting || !isDefined(agentId)}
        />,
      ];
    }

    if (currentTabId !== WORKFLOW_AI_AGENT_TABS.PERMISSIONS) {
      return [];
    }

    if (workflowAiAgentPermissionsIsAddingPermission) {
      return [
        <WorkflowStepCmdEnterButton
          key="view-role"
          title={t`View role`}
          onClick={handleViewRole}
          disabled={!isDefined(role?.id)}
        />,
      ];
    }

    if (isDefined(actionOptions.readonly)) {
      return [];
    }

    return [
      <WorkflowStepCmdEnterButton
        key="add-permission"
        title={t`Add permission`}
        onClick={() => setWorkflowAiAgentPermissionsIsAddingPermission(true)}
      />,
    ];
  };

  return agentLoading || !isCurrentAgentLoaded ? (
    <SidePanelSkeletonLoader />
  ) : (
    <>
      <StyledTabListContainer>
        <TabList
          tabs={tabs}
          componentInstanceId={componentInstanceId}
          behaveAsLinks={false}
        />
      </StyledTabListContainer>
      {currentTabId === WORKFLOW_AI_AGENT_TABS.PERMISSIONS ? (
        <WorkflowStepBody paddingBlock="0" paddingInline="0">
          <WorkflowAiAgentPermissionsTab
            action={action}
            readonly={actionOptions.readonly === true}
            isAgentLoading={agentLoading}
            refetchAgent={refetchAgent}
          />
        </WorkflowStepBody>
      ) : currentTabId === WORKFLOW_AI_AGENT_TABS.TEST ? (
        <WorkflowStepBody>
          <StyledTestTabContent>
            <Callout
              variant={'warning'}
              Icon={IconAlertTriangle}
              title={t`Runs the agent with its tools`}
              description={t`Use the same prompt, model, and output as this step. Variable chips are filled from a recent workflow run. Record changes and credit usage are real.`}
            />
            <WorkflowAiAgentPromptTab
              action={action}
              prompt={prompt}
              readonly={actionOptions.readonly === true}
              modelSelectDropdownId={`select-agent-model-test-${action.id}`}
              onPromptChange={handleAgentPromptChange}
              onActionUpdate={
                actionOptions.readonly === true
                  ? undefined
                  : actionOptions.onActionUpdate
              }
            />
            <AiAgentExecutionResult
              aiAgentTestData={aiAgentTestData}
              isTesting={isTesting}
            />
          </StyledTestTabContent>
        </WorkflowStepBody>
      ) : (
        <WorkflowStepBody>
          <WorkflowAiAgentPromptTab
            action={action}
            prompt={prompt}
            readonly={actionOptions.readonly === true}
            onPromptChange={handleAgentPromptChange}
            onActionUpdate={
              actionOptions.readonly === true
                ? undefined
                : actionOptions.onActionUpdate
            }
          />
        </WorkflowStepBody>
      )}
      {!actionOptions.readonly && (
        <WorkflowStepFooter
          additionalActions={getFooterActions()}
          stepId={action.id}
        />
      )}
    </>
  );
};
