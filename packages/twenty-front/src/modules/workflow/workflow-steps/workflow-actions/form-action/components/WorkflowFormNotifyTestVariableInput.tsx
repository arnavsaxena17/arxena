import { FormFieldInputContainer } from '@/object-record/record-field/ui/form-types/components/FormFieldInputContainer';
import { FormTextFieldInput } from '@/object-record/record-field/ui/form-types/components/FormTextFieldInput';
import { useAtomFamilyStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomFamilyStateValue';
import { useSetAtomFamilyState } from '@/ui/utilities/state/jotai/hooks/useSetAtomFamilyState';
import { useFlowOrThrow } from '@/workflow/hooks/useFlowOrThrow';
import { type WorkflowFormAction } from '@/workflow/types/Workflow';
import { workflowFormNotifyTestDataFamilyState } from '@/workflow/workflow-steps/workflow-actions/form-action/states/workflowFormNotifyTestDataFamilyState';
import {
  type WorkflowFormNotifyOnPendingSettings,
  getWorkflowFormNotifyVariablesUsed,
} from '@/workflow/workflow-steps/workflow-actions/form-action/utils/getWorkflowFormNotifyVariablesUsed';
import { useSearchVariable } from '@/workflow/workflow-variables/hooks/useSearchVariable';
import { t } from '@lingui/core/macro';
import { styled } from '@linaria/react';
import { isDefined } from 'twenty-shared/utils';
import {
  TRIGGER_STEP_ID,
  extractRawVariableNamePart,
} from 'twenty-shared/workflow';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledVariableInputsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
`;

type WorkflowFormNotifyTestVariableInputProps = {
  action: WorkflowFormAction;
  readonly?: boolean;
};

const getFallbackVariableLabel = ({
  variablePath,
  stepName,
}: {
  variablePath: string;
  stepName?: string;
}): string => {
  const fieldPath = variablePath.split('.').slice(1).join(' > ');

  if (!isDefined(stepName) || stepName.length === 0) {
    return fieldPath || variablePath;
  }

  return fieldPath.length > 0 ? `${stepName} > ${fieldPath}` : stepName;
};

const WorkflowFormNotifyTestVariableField = ({
  variablePath,
  value,
  readonly,
  onChange,
}: {
  variablePath: string;
  value: string;
  readonly?: boolean;
  onChange: (value: string) => void;
}) => {
  const flow = useFlowOrThrow();
  const stepId = extractRawVariableNamePart({
    rawVariableName: variablePath,
    part: 'stepId',
  });
  const { variablePathLabel } = useSearchVariable({
    stepId,
    rawVariableName: `{{${variablePath}}}`,
    isFullRecord: false,
  });
  const stepName =
    stepId === TRIGGER_STEP_ID
      ? flow.trigger?.name
      : flow.steps?.find((step) => step.id === stepId)?.name;
  const label =
    variablePathLabel ??
    getFallbackVariableLabel({
      variablePath,
      stepName,
    });

  return (
    <FormTextFieldInput
      label={label}
      placeholder={t`Enter test value`}
      readonly={readonly}
      defaultValue={value}
      onChange={(nextValue) => onChange(nextValue || '')}
    />
  );
};

export const WorkflowFormNotifyTestVariableInput = ({
  action,
  readonly,
}: WorkflowFormNotifyTestVariableInputProps) => {
  const workflowFormNotifyTestData = useAtomFamilyStateValue(
    workflowFormNotifyTestDataFamilyState,
    action.id,
  );
  const setWorkflowFormNotifyTestData = useSetAtomFamilyState(
    workflowFormNotifyTestDataFamilyState,
    action.id,
  );
  const notifyOnPending = (
    action.settings as { notifyOnPending?: WorkflowFormNotifyOnPendingSettings }
  ).notifyOnPending;
  const variableArray = getWorkflowFormNotifyVariablesUsed({
    fields: action.settings.input,
    notifyOnPending,
  });

  const handleVariableChange = (variablePath: string, value: string) => {
    setTestData((prev) => ({
      ...prev,
      variableValues: {
        ...prev.variableValues,
        [variablePath]: value,
      },
    }));
  };

  if (variableArray.length === 0) {
    return null;
  }

  return (
    <FormFieldInputContainer>
      <StyledVariableInputsContainer>
        {variableArray.map((variablePath) => (
          <WorkflowFormNotifyTestVariableField
            key={variablePath}
            variablePath={variablePath}
            value={testData.variableValues[variablePath] || ''}
            readonly={readonly}
            onChange={(value) => handleVariableChange(variablePath, value)}
          />
        ))}
      </StyledVariableInputsContainer>
    </FormFieldInputContainer>
  );
};
