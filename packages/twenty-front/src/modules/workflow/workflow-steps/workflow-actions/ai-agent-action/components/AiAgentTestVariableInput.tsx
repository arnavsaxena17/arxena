import { FormFieldInputContainer } from '@/object-record/record-field/ui/form-types/components/FormFieldInputContainer';
import { FormTextFieldInput } from '@/object-record/record-field/ui/form-types/components/FormTextFieldInput';
import { useAtomFamilyStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomFamilyStateValue';
import { useSetAtomFamilyState } from '@/ui/utilities/state/jotai/hooks/useSetAtomFamilyState';
import { type WorkflowStep } from '@/workflow/types/Workflow';
import { getWorkflowVariablesUsedInStep } from '@/workflow/workflow-steps/utils/getWorkflowVariablesUsedInStep';
import { aiAgentTestDataFamilyState } from '@/workflow/workflow-steps/workflow-actions/ai-agent-action/states/aiAgentTestDataFamilyState';
import { t } from '@lingui/core/macro';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledVariableInputsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
`;

type AiAgentTestVariableInputProps = {
  prompt: string;
  actionId: string;
  readonly?: boolean;
};

export const AiAgentTestVariableInput = ({
  prompt,
  actionId,
  readonly,
}: AiAgentTestVariableInputProps) => {
  const aiAgentTestData = useAtomFamilyStateValue(
    aiAgentTestDataFamilyState,
    actionId,
  );
  const setAiAgentTestData = useSetAtomFamilyState(
    aiAgentTestDataFamilyState,
    actionId,
  );
  const mockStep: WorkflowStep = {
    id: 'test-step',
    name: 'Test Step',
    type: 'AI_AGENT',
    valid: true,
    settings: {
      input: {
        prompt,
      },
      outputSchema: {},
      errorHandlingOptions: {
        retryOnFailure: { value: false },
        continueOnFailure: { value: false },
      },
    },
  };

  const variablesUsed = getWorkflowVariablesUsedInStep({ step: mockStep });
  const variableArray = Array.from(variablesUsed);

  const handleVariableChange = (variablePath: string, value: string) => {
    setAiAgentTestData((prev) => ({
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
          <FormTextFieldInput
            key={variablePath}
            label={`${variablePath}`}
            placeholder={t`Enter test value`}
            readonly={readonly}
            defaultValue={aiAgentTestData.variableValues[variablePath] || ''}
            onChange={(value) =>
              handleVariableChange(variablePath, value || '')
            }
          />
        ))}
      </StyledVariableInputsContainer>
    </FormFieldInputContainer>
  );
};
