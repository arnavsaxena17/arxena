import { TabList } from '@/ui/layout/tab-list/components/TabList';
import { activeTabIdComponentState } from '@/ui/layout/tab-list/states/activeTabIdComponentState';
import { type SingleTabProps } from '@/ui/layout/tab-list/types/SingleTabProps';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { type WorkflowAiFilteringAction } from '@/workflow/types/Workflow';
import { WorkflowStepBody } from '@/workflow/workflow-steps/components/WorkflowStepBody';
import { WorkflowStepFooter } from '@/workflow/workflow-steps/components/WorkflowStepFooter';
import { WorkflowAiFilteringConfigureTab } from '@/workflow/workflow-steps/workflow-actions/ai-filtering-action/components/WorkflowAiFilteringConfigureTab';
import { WorkflowAiFilteringTestTab } from '@/workflow/workflow-steps/workflow-actions/ai-filtering-action/components/WorkflowAiFilteringTestTab';
import {
  WORKFLOW_AI_FILTERING_TAB_LIST_COMPONENT_ID,
  WORKFLOW_AI_FILTERING_TABS,
} from '@/workflow/workflow-steps/workflow-actions/ai-filtering-action/constants/WorkflowAiFilteringTabs';
import { useTestWorkflowAiFiltering } from '@/workflow/workflow-steps/workflow-actions/ai-filtering-action/hooks/useTestWorkflowAiFiltering';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { IconPlayerPlay, IconSettings } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { WorkflowStepCmdEnterButton } from '@/workflow/workflow-steps/components/WorkflowStepCmdEnterButton';

type WorkflowEditActionAiFilteringProps = {
  action: WorkflowAiFilteringAction;
  actionOptions:
    | { readonly: true }
    | {
        readonly?: false;
        onActionUpdate: (action: WorkflowAiFilteringAction) => void;
      };
};

type WorkflowAiFilteringTabId =
  (typeof WORKFLOW_AI_FILTERING_TABS)[keyof typeof WORKFLOW_AI_FILTERING_TABS];

const StyledTabListContainer = styled.div`
  background-color: ${themeCssVariables.background.secondary};
  padding-left: ${themeCssVariables.spacing[2]};
`;

const isJevCompatibleField = (field: {
  type: string;
  enumValues?: string[];
}): boolean => {
  const fieldType = field.type.toLowerCase();

  if (fieldType === 'boolean') {
    return true;
  }

  if (fieldType === 'enum') {
    return Array.isArray(field.enumValues) && field.enumValues.length >= 2;
  }

  return false;
};

export const WorkflowEditActionAiFiltering = ({
  action,
  actionOptions,
}: WorkflowEditActionAiFilteringProps) => {
  const { t } = useLingui();
  const readonly = actionOptions.readonly === true;
  const componentInstanceId = `${WORKFLOW_AI_FILTERING_TAB_LIST_COMPONENT_ID}-${action.id}`;
  const activeTabId = useAtomComponentStateValue(
    activeTabIdComponentState,
    componentInstanceId,
  );
  const currentTabId =
    (activeTabId as WorkflowAiFilteringTabId) ??
    WORKFLOW_AI_FILTERING_TABS.CONFIGURE;

  const { testAiFiltering, isTesting, testData } = useTestWorkflowAiFiltering();

  const input = action.settings.input;
  const fields = input.fields ?? [];
  const selectedModel = input.selectedModel || 'typesafe-ai/jev';
  const isJevModel =
    selectedModel === 'typesafe-ai/jev' || selectedModel === 'jev';
  const hasPrompt = Boolean(input.prompt?.trim());
  const hasFields = fields.length > 0;
  const jevFieldsOk = fields.every(isJevCompatibleField);
  const jevHint =
    isJevModel && hasFields && !jevFieldsOk
      ? t`Jev requires all structured fields to be boolean or enum with at least 2 values. Switch field types or pick an OpenAI model.`
      : null;
  const canTest =
    hasPrompt && hasFields && (!isJevModel || jevFieldsOk) && !readonly;

  const tabs: SingleTabProps[] = [
    {
      id: WORKFLOW_AI_FILTERING_TABS.CONFIGURE,
      title: t`Configure`,
      Icon: IconSettings,
    },
    {
      id: WORKFLOW_AI_FILTERING_TABS.TEST,
      title: t`Test`,
      Icon: IconPlayerPlay,
    },
  ];

  const handleTest = async () => {
    if (!canTest) {
      return;
    }

    await testAiFiltering({
      prompt: input.prompt || '',
      selectedModel: isJevModel ? 'typesafe-ai/jev' : selectedModel,
      name: input.name,
      selectedMetadataFields: input.selectedMetadataFields,
      includeResume: input.includeResume,
      fields,
    });
  };

  return (
    <>
      <StyledTabListContainer>
        <TabList
          tabs={tabs}
          componentInstanceId={componentInstanceId}
          behaveAsLinks={false}
        />
      </StyledTabListContainer>
      <WorkflowStepBody>
        {currentTabId === WORKFLOW_AI_FILTERING_TABS.TEST ? (
          <WorkflowAiFilteringTestTab
            isTesting={isTesting}
            testData={testData}
            canTest={canTest}
            jevHint={jevHint}
          />
        ) : (
          <WorkflowAiFilteringConfigureTab
            action={action}
            readonly={readonly}
            onActionUpdate={readonly ? undefined : actionOptions.onActionUpdate}
          />
        )}
      </WorkflowStepBody>
      <WorkflowStepFooter
        stepId={action.id}
        additionalActions={
          currentTabId === WORKFLOW_AI_FILTERING_TABS.TEST
            ? [
                <WorkflowStepCmdEnterButton
                  key="test-ai-filtering"
                  title={t`Test`}
                  onClick={handleTest}
                  disabled={!canTest || isTesting}
                />,
              ]
            : undefined
        }
      />
    </>
  );
};
