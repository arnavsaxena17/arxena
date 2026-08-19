import { logicFunctionsSelector } from '@/logic-functions/states/logicFunctionsSelector';
import { ToolMenuItem } from '@/side-panel/pages/workflow/action/components/ToolMenuItem';
import { WorkflowActionMenuItems } from '@/side-panel/pages/workflow/action/components/WorkflowActionMenuItems';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { type WorkflowActionType } from '@/workflow/types/Workflow';
import { SidePanelStepListContainer } from '@/workflow/workflow-steps/components/SidePanelWorkflowSelectStepContainer';
import { SidePanelWorkflowSelectStepTitle } from '@/workflow/workflow-steps/components/SidePanelWorkflowSelectStepTitle';
import { AI_ACTIONS } from '@/workflow/workflow-steps/workflow-actions/constants/AiActions';
import { CORE_ACTIONS } from '@/workflow/workflow-steps/workflow-actions/constants/CoreActions';
import { FLOW_ACTIONS } from '@/workflow/workflow-steps/workflow-actions/constants/FlowActions';
import { HUMAN_INPUT_ACTIONS } from '@/workflow/workflow-steps/workflow-actions/constants/HumanInputActions';
import { RECORD_ACTIONS } from '@/workflow/workflow-steps/workflow-actions/constants/RecordActions';
import { useLingui } from '@lingui/react/macro';
import { CODE_STEP_LOGIC_FUNCTION_NAME } from 'twenty-shared/logic-function';
import { isDefined } from 'twenty-shared/utils';

export type WorkflowActionSelection = {
  type: WorkflowActionType;
  defaultSettings?: Record<string, unknown>;
};

export const SidePanelWorkflowSelectAction = ({
  onActionSelected,
}: {
  onActionSelected: (selection: WorkflowActionSelection) => void;
}) => {
  const { t } = useLingui();

  const logicFunctions = useAtomStateValue(logicFunctionsSelector);

  // Include workspace-seeded first-party LFs (e.g. search-people-for-company).
  // They live on the workspace custom application, so excluding that app hid them.
  // CODE-step logic functions also have trigger settings but are added via Core.
  const toolFunctions = logicFunctions.filter(
    (fn) =>
      isDefined(fn.workflowActionTriggerSettings) &&
      fn.name !== CODE_STEP_LOGIC_FUNCTION_NAME,
  );

  const handleActionClick = (actionType: WorkflowActionType) => {
    onActionSelected({ type: actionType });
  };

  const handleFunctionClick = (logicFunctionId: string) => {
    onActionSelected({
      type: 'LOGIC_FUNCTION',
      defaultSettings: {
        input: { logicFunctionId, logicFunctionInput: {} },
      },
    });
  };

  return (
    <SidePanelStepListContainer>
      <SidePanelWorkflowSelectStepTitle>
        {t`Data`}
      </SidePanelWorkflowSelectStepTitle>
      <WorkflowActionMenuItems
        actions={RECORD_ACTIONS}
        onClick={handleActionClick}
      />

      <SidePanelWorkflowSelectStepTitle>
        {t`AI`}
      </SidePanelWorkflowSelectStepTitle>
      <WorkflowActionMenuItems
        actions={AI_ACTIONS}
        onClick={handleActionClick}
      />

      <SidePanelWorkflowSelectStepTitle>
        {t`Flow`}
      </SidePanelWorkflowSelectStepTitle>
      <WorkflowActionMenuItems
        actions={FLOW_ACTIONS}
        onClick={handleActionClick}
      />

      <SidePanelWorkflowSelectStepTitle>
        {t`Core`}
      </SidePanelWorkflowSelectStepTitle>
      <WorkflowActionMenuItems
        actions={CORE_ACTIONS}
        onClick={handleActionClick}
      />

      <SidePanelWorkflowSelectStepTitle>
        {t`Human in the Loop`}
      </SidePanelWorkflowSelectStepTitle>
      <WorkflowActionMenuItems
        actions={HUMAN_INPUT_ACTIONS}
        onClick={handleActionClick}
      />

      {toolFunctions.length > 0 && (
        <>
          <SidePanelWorkflowSelectStepTitle>
            {t`Other`}
          </SidePanelWorkflowSelectStepTitle>
          {toolFunctions.map((fn) => (
            <ToolMenuItem
              key={fn.id}
              logicFunction={fn}
              onClick={() => handleFunctionClick(fn.id)}
            />
          ))}
        </>
      )}
    </SidePanelStepListContainer>
  );
};
