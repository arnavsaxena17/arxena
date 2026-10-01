import { type OutputSchemaField } from '@/ai/constants/OutputFieldTypeOptions';
import { InputLabel } from '@/ui/input/components/InputLabel';
import { WorkflowAiAgentOutputValidationCheckCard } from '@/workflow/workflow-steps/workflow-actions/ai-agent-action/components/WorkflowAiAgentOutputValidationCheckCard';
import { type WorkflowAiAgentAction } from '@/workflow/types/Workflow';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import {
  DEFAULT_AI_AGENT_OUTPUT_VALIDATION_CHECKS,
  type WorkflowAiAgentOutputValidationCheck,
} from 'twenty-shared/workflow';
import { IconPlus } from 'twenty-ui/icon';
import { Checkbox, Toggle } from 'twenty-ui/input';
import { MenuItem } from 'twenty-ui/navigation';
import { themeCssVariables } from 'twenty-ui/theme-constants';

type WorkflowAiAgentOutputValidationConfigProps = {
  action: WorkflowAiAgentAction;
  fields: OutputSchemaField[];
  readonly?: boolean;
  onActionUpdate?: (action: WorkflowAiAgentAction) => void;
};

type OutputValidationSettings = {
  enabled: boolean;
  fieldKeys: string[];
  checks?: WorkflowAiAgentOutputValidationCheck[];
};

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledToggleRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
`;

const StyledDescription = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledFieldBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[0.5]};
`;

const StyledFieldRow = styled.label`
  align-items: center;
  color: ${themeCssVariables.font.color.primary};
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledFieldSummary = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  padding-left: ${themeCssVariables.spacing[5]};
`;

const stringFieldNames = (fields: OutputSchemaField[]): string[] =>
  fields
    .filter((field) => field.type === 'string' && isNonEmptyString(field.name))
    .map((field) => field.name);

const checkLabel = (check: WorkflowAiAgentOutputValidationCheck): string =>
  check.label.trim() === '' ? 'Untitled check' : check.label;

const createCheck = (): WorkflowAiAgentOutputValidationCheck => ({
  id: `check-${crypto.randomUUID()}`,
  label: '',
  instructions: '',
  invalidWhen: '',
  validWhen: '',
});

export const WorkflowAiAgentOutputValidationConfig = ({
  action,
  fields,
  readonly = false,
  onActionUpdate,
}: WorkflowAiAgentOutputValidationConfigProps) => {
  const textFields = stringFieldNames(fields);
  const outputValidation = action.settings.input.outputValidation;
  const enabled = outputValidation?.enabled === true;
  const selectedFieldKeys = outputValidation?.fieldKeys ?? [];
  const visibleChecks =
    outputValidation?.checks ?? DEFAULT_AI_AGENT_OUTPUT_VALIDATION_CHECKS;

  const updateValidation = (next: OutputValidationSettings) => {
    if (readonly || !onActionUpdate) {
      return;
    }

    onActionUpdate({
      ...action,
      settings: {
        ...action.settings,
        input: {
          ...action.settings.input,
          outputValidation: next,
        },
      },
    });
  };

  const handleEnabledChange = (nextEnabled: boolean) => {
    const fieldKeys = nextEnabled
      ? selectedFieldKeys.filter((fieldKey) => textFields.includes(fieldKey))
      : selectedFieldKeys;

    updateValidation({
      enabled: nextEnabled,
      fieldKeys: nextEnabled && fieldKeys.length === 0 ? textFields : fieldKeys,
      ...(isDefined(outputValidation?.checks)
        ? { checks: outputValidation.checks }
        : {}),
    });
  };

  const handleFieldToggle = (fieldName: string, checked: boolean) => {
    const fieldKeys = checked
      ? [...selectedFieldKeys, fieldName]
      : selectedFieldKeys.filter((fieldKey) => fieldKey !== fieldName);

    updateValidation({
      enabled: true,
      fieldKeys,
      ...(isDefined(outputValidation?.checks)
        ? { checks: outputValidation.checks }
        : {}),
    });
  };

  const persistChecks = (checks: WorkflowAiAgentOutputValidationCheck[]) => {
    updateValidation({
      enabled: true,
      fieldKeys: selectedFieldKeys,
      checks,
    });
  };

  const handleCheckChange = (
    checkId: string,
    patch: Partial<WorkflowAiAgentOutputValidationCheck>,
  ) => {
    persistChecks(
      visibleChecks.map((check) =>
        check.id === checkId ? { ...check, ...patch } : check,
      ),
    );
  };

  return (
    <StyledContainer>
      <StyledToggleRow>
        <InputLabel>{t`Validate outputs with Jev`}</InputLabel>
        <Toggle
          value={enabled}
          onChange={handleEnabledChange}
          disabled={readonly}
          aria-label={t`Validate outputs with Jev`}
          toggleSize="small"
        />
      </StyledToggleRow>
      <StyledDescription>
        {t`Each selected field is judged with the checks below. Jev rejects the draft when its yes score is 0.50 or higher. Reject when is a yes. Allow when is a no. Template tokens are always rejected in code. A failed field is rewritten, up to three drafts.`}
      </StyledDescription>
      {enabled && textFields.length === 0 ? (
        <StyledDescription>
          {t`Add a text output field to choose what Jev checks.`}
        </StyledDescription>
      ) : null}
      {enabled
        ? textFields.map((fieldName) => {
            const selected = selectedFieldKeys.includes(fieldName);

            return (
              <StyledFieldBlock key={fieldName}>
                <StyledFieldRow>
                  <Checkbox
                    checked={selected}
                    onCheckedChange={(checked) =>
                      handleFieldToggle(fieldName, checked === true)
                    }
                    disabled={readonly}
                    aria-label={fieldName}
                  />
                  {fieldName}
                </StyledFieldRow>
                {selected ? (
                  <StyledFieldSummary>
                    {[
                      ...visibleChecks.map((check) => checkLabel(check)),
                      t`template tokens`,
                    ].join(', ')}
                  </StyledFieldSummary>
                ) : null}
              </StyledFieldBlock>
            );
          })
        : null}
      {enabled ? (
        <>
          <InputLabel>{t`Checks`}</InputLabel>
          {visibleChecks.map((check) => (
            <WorkflowAiAgentOutputValidationCheckCard
              key={check.id}
              check={check}
              readonly={readonly}
              onChange={(patch) => handleCheckChange(check.id, patch)}
              onRemove={() =>
                persistChecks(
                  visibleChecks.filter(
                    (visibleCheck) => visibleCheck.id !== check.id,
                  ),
                )
              }
            />
          ))}
          {readonly ? null : (
            <MenuItem
              LeftIcon={IconPlus}
              text={t`Add check`}
              onClick={() => persistChecks([...visibleChecks, createCheck()])}
            />
          )}
        </>
      ) : null}
    </StyledContainer>
  );
};
