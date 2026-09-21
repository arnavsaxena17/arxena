import { TabList } from '@/ui/layout/tab-list/components/TabList';
import { activeTabIdComponentState } from '@/ui/layout/tab-list/states/activeTabIdComponentState';
import { type SingleTabProps } from '@/ui/layout/tab-list/types/SingleTabProps';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { workflowVisualizerWorkflowIdComponentState } from '@/workflow/states/workflowVisualizerWorkflowIdComponentState';
import { workflowVisualizerWorkflowVersionIdComponentState } from '@/workflow/states/workflowVisualizerWorkflowVersionIdComponentState';
import { type WorkflowAiAgentAction } from '@/workflow/types/Workflow';
import { WorkflowStepBody } from '@/workflow/workflow-steps/components/WorkflowStepBody';
import { WorkflowStepCmdEnterButton } from '@/workflow/workflow-steps/components/WorkflowStepCmdEnterButton';
import { WorkflowStepFooter } from '@/workflow/workflow-steps/components/WorkflowStepFooter';
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
import { isNonEmptyString } from '@sniptt/guards';
import { useEffect, useRef, useState } from 'react';
import { SettingsPath } from 'twenty-shared/types';
import { isDefined, isValidUuid } from 'twenty-shared/utils';
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
import { WorkflowAiAgentTestTab } from './WorkflowAiAgentTestTab';

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

const PROMPT_SAVE_DEBOUNCE_MS = 1_500;

export const WorkflowEditActionAiAgent = ({
  action,
  actionOptions,
}: WorkflowEditActionAiAgentProps) => {
  const { t } = useLingui();
  const componentInstanceId = `${WORKFLOW_AI_AGENT_TAB_LIST_COMPONENT_ID}-${action.id}`;
  const agentId = action.settings.input.agentId;
  const hasResolvableAgentId =
    isNonEmptyString(agentId) && isValidUuid(agentId);
  const [workflowAiAgentActionAgent, setWorkflowAiAgentActionAgent] =
    useAtomState(workflowAiAgentActionAgentState);
  const {
    data: agentData,
    loading: agentLoading,
    refetch: refetchAgent,
  } = useQuery(FindOneAgentDocument, {
    variables: { id: agentId || '' },
    skip: !hasResolvableAgentId,
  });

  useEffect(() => {
    setWorkflowAiAgentActionAgent((currentAgent) => {
      if (agentData?.findOneAgent?.id === agentId) {
        return agentData.findOneAgent;
      }

      if (isDefined(currentAgent) && currentAgent.id !== agentId) {
        return undefined;
      }

      return currentAgent;
    });
  }, [agentData, agentId, setWorkflowAiAgentActionAgent]);
  useResetWorkflowAiAgentPermissionsStateOnSidePanelClose();

  const actionPrompt = action.settings.input.prompt || '';
  const promptRef = useRef(actionPrompt);
  // Synced on flush / tab switch so Test uses the latest draft without
  // re-rendering the Prompt chrome on every keystroke.
  const [prompt, setPrompt] = useState(actionPrompt);
  const [candidateId, setCandidateId] = useState<string | undefined>(undefined);
  const actionRef = useRef(action);
  const actionOptionsRef = useRef(actionOptions);

  actionRef.current = action;
  actionOptionsRef.current = actionOptions;

  const workflowVisualizerWorkflowId = useAtomComponentStateValue(
    workflowVisualizerWorkflowIdComponentState,
  );
  const workflowVisualizerWorkflowVersionId = useAtomComponentStateValue(
    workflowVisualizerWorkflowVersionIdComponentState,
  );
  const { resolvePrompt } = useResolveAiAgentTestPromptFromLatestRun(
    workflowVisualizerWorkflowId,
  );
  const { testAiAgent, showTestError, isTesting, aiAgentTestData } =
    useTestAiAgent(action.id);

  const persistPrompt = (newPrompt: string) => {
    const currentActionOptions = actionOptionsRef.current;

    if (currentActionOptions.readonly === true) {
      return;
    }

    const currentAction = actionRef.current;
    const persistedPrompt = currentAction.settings.input.prompt || '';

    if (newPrompt === persistedPrompt) {
      return;
    }

    currentActionOptions.onActionUpdate({
      ...currentAction,
      settings: {
        ...currentAction.settings,
        input: {
          ...currentAction.settings.input,
          prompt: newPrompt,
        },
      },
    });
  };

  const savePromptDebounced = useDebouncedCallback(
    persistPrompt,
    PROMPT_SAVE_DEBOUNCE_MS,
  );

  const flushPrompt = () => {
    savePromptDebounced.cancel();
    const latestPrompt = promptRef.current;

    setPrompt(latestPrompt);
    persistPrompt(latestPrompt);
  };

  useEffect(() => {
    return () => {
      savePromptDebounced.cancel();
      persistPrompt(promptRef.current);
    };
    // Flush once on unmount with the latest ref values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAgentPromptChange = (newPrompt: string) => {
    promptRef.current = newPrompt;
    savePromptDebounced(newPrompt);
  };

  const handleAgentPromptBlur = () => {
    flushPrompt();
  };

  const handleTestAgent = async () => {
    if (actionOptions.readonly === true || !isDefined(agentId)) {
      return;
    }

    const latestPrompt = promptRef.current;

    if (isNonEmptyString(candidateId)) {
      if (!isNonEmptyString(workflowVisualizerWorkflowVersionId)) {
        showTestError(
          t`Open this step from a workflow version to test with a candidate.`,
        );

        return;
      }

      await testAiAgent({
        agentId,
        prompt: latestPrompt,
        candidateId,
        workflowVersionId: workflowVisualizerWorkflowVersionId,
        stepId: action.id,
      });

      return;
    }

    const { resolvedPrompt, missingVariablePaths } =
      await resolvePrompt(latestPrompt);

    if (missingVariablePaths.length > 0) {
      showTestError(
        t`Pick a candidate to fetch LinkedIn profile and prior messages, or run this branch once so chips can fill from a recent run.`,
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

  useEffect(() => {
    if (currentTabId === WORKFLOW_AI_AGENT_TABS.TEST) {
      setPrompt(promptRef.current);
    }

    if (currentTabId !== WORKFLOW_AI_AGENT_TABS.PROMPT) {
      flushPrompt();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTabId]);

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
  // Keep showing the skeleton until the atom is synced. Query can finish before
  // the useEffect that copies agentData into workflowAiAgentActionAgentState.
  const isWaitingForAgent =
    hasResolvableAgentId &&
    !isCurrentAgentLoaded &&
    (agentLoading || isDefined(agentData?.findOneAgent));

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

  return isWaitingForAgent ? (
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
      {!isCurrentAgentLoaded ? (
        <WorkflowStepBody>
          <Callout
            variant="warning"
            Icon={IconAlertTriangle}
            title={t`Agent is missing`}
            description={t`The prompt is still editable. Bind an agent on this step to test generation.`}
          />
        </WorkflowStepBody>
      ) : null}
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
          <WorkflowAiAgentTestTab
            action={action}
            prompt={prompt}
            candidateId={candidateId}
            readonly={actionOptions.readonly === true}
            isTesting={isTesting}
            aiAgentTestData={aiAgentTestData}
            onCandidateChange={setCandidateId}
            onPromptChange={handleAgentPromptChange}
            onPromptBlur={handleAgentPromptBlur}
            onActionUpdate={
              actionOptions.readonly === true
                ? undefined
                : actionOptions.onActionUpdate
            }
          />
        </WorkflowStepBody>
      ) : (
        <WorkflowStepBody>
          <WorkflowAiAgentPromptTab
            action={action}
            prompt={prompt}
            readonly={actionOptions.readonly === true}
            onPromptChange={handleAgentPromptChange}
            onPromptBlur={handleAgentPromptBlur}
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
