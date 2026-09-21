import { getTokenPair } from '@/apollo/utils/getTokenPair';
import { type OutputSchemaField } from '@/ai/constants/OutputFieldTypeOptions';
import { AVAILABLE_MODELS } from '@/arx-ai-filtering/right-side/constants';
import { FormFieldInputContainer } from '@/object-record/record-field/ui/form-types/components/FormFieldInputContainer';
import { FormTextFieldInput } from '@/object-record/record-field/ui/form-types/components/FormTextFieldInput';
import { InputLabel } from '@/ui/input/components/InputLabel';
import { Select } from '@/ui/input/components/Select';
import { type WorkflowAiFilteringAction } from '@/workflow/types/Workflow';
import { WorkflowOutputSchemaBuilder } from '@/workflow/workflow-steps/workflow-actions/ai-agent-action/components/WorkflowOutputSchemaBuilder';
import { WorkflowVariablePicker } from '@/workflow/workflow-variables/components/WorkflowVariablePicker';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import {
  aiFilteringFieldsToOutputSchema,
  type AiFilteringFieldLike,
} from 'twenty-shared/workflow';
import { isDefined } from 'twenty-shared/utils';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

const METADATA_OPTIONS = [
  'name',
  'title',
  'company',
  'location',
  'headline',
  'linkedinUrl',
] as const;

type WorkflowAiFilteringConfigureTabProps = {
  action: WorkflowAiFilteringAction;
  readonly: boolean;
  onActionUpdate?: (action: WorkflowAiFilteringAction) => void;
};

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
`;

const StyledChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledChipButton = styled.button<{ $active: boolean }>`
  background: ${({ $active }) =>
    $active
      ? themeCssVariables.color.blue3
      : themeCssVariables.background.transparent.light};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
`;

const toOutputSchemaFields = (
  fields: AiFilteringFieldLike[],
): OutputSchemaField[] =>
  fields.map((field) => ({
    id: field.name,
    name: field.name,
    type:
      field.type === 'boolean'
        ? 'boolean'
        : field.type === 'number'
          ? 'number'
          : 'string',
    description: field.description,
  }));

const fromOutputSchemaFields = (
  fields: OutputSchemaField[],
  previous: AiFilteringFieldLike[],
): AiFilteringFieldLike[] =>
  fields.map((field) => {
    const previousField = previous.find((entry) => entry.name === field.name);

    return {
      name: field.name,
      type:
        field.type === 'boolean'
          ? 'boolean'
          : field.type === 'number'
            ? 'number'
            : previousField?.type === 'enum'
              ? 'enum'
              : 'text',
      description: field.description,
      enumValues: previousField?.enumValues,
    };
  });

export const WorkflowAiFilteringConfigureTab = ({
  action,
  readonly,
  onActionUpdate,
}: WorkflowAiFilteringConfigureTabProps) => {
  const { t } = useLingui();
  const input = action.settings.input;
  const [isProcessingDescription, setIsProcessingDescription] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);

  const updateInput = (
    patch: Partial<WorkflowAiFilteringAction['settings']['input']>,
  ) => {
    if (readonly || !isDefined(onActionUpdate)) {
      return;
    }

    const nextInput = {
      ...input,
      ...patch,
    };
    const fields = nextInput.fields ?? [];

    onActionUpdate({
      ...action,
      settings: {
        ...action.settings,
        input: nextInput,
        outputSchema: aiFilteringFieldsToOutputSchema(fields),
      },
    });
  };

  const handleProcessDescription = async () => {
    const description = input.filterDescription?.trim();

    if (!description || readonly) {
      return;
    }

    setIsProcessingDescription(true);
    setProcessError(null);

    try {
      const tokenPair = getTokenPair();
      const token = tokenPair?.accessOrWorkspaceAgnosticToken?.token;

      const response = await fetch(
        `${REACT_APP_SERVER_BASE_URL}/candidate-sourcing/process-filter-description`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            filterDescription: description,
            otherFieldKeys: METADATA_OPTIONS.map((name) => name),
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Process failed (${response.status})`);
      }

      const payload = await response.json();
      const generated = payload?.data ?? payload;

      updateInput({
        name: generated.modelName || input.name,
        prompt: generated.prompt || input.prompt,
        fields: generated.fields || input.fields,
        selectedMetadataFields:
          generated.selectedMetadataFields || input.selectedMetadataFields,
      });
    } catch (error) {
      setProcessError(
        error instanceof Error ? error.message : 'Failed to generate filter',
      );
    } finally {
      setIsProcessingDescription(false);
    }
  };

  const selectedMetadataFields = input.selectedMetadataFields ?? [];

  return (
    <StyledContainer>
      <FormFieldInputContainer>
        <FormTextFieldInput
          label={t`Name`}
          defaultValue={input.name || ''}
          onChange={(value) => updateInput({ name: value })}
          readonly={readonly}
          placeholder={t`SeniorGtmFilter`}
        />
      </FormFieldInputContainer>

      <FormFieldInputContainer>
        <FormTextFieldInput
          label={t`Candidates`}
          defaultValue={
            typeof input.candidates === 'string'
              ? input.candidates
              : JSON.stringify(input.candidates ?? '')
          }
          onChange={(value) => updateInput({ candidates: value })}
          readonly={readonly}
          placeholder="{{searchPeople.people}}"
          VariablePicker={WorkflowVariablePicker}
          multiline
        />
      </FormFieldInputContainer>

      <FormFieldInputContainer>
        <FormTextFieldInput
          label={t`Filter description`}
          defaultValue={input.filterDescription || ''}
          onChange={(value) => updateInput({ filterDescription: value })}
          readonly={readonly}
          placeholder={t`Senior GTM decision makers only`}
          multiline
        />
      </FormFieldInputContainer>

      {!readonly && (
        <Button
          title={
            isProcessingDescription ? t`Generating…` : t`Process AI Filter`
          }
          onClick={handleProcessDescription}
          disabled={isProcessingDescription || !input.filterDescription?.trim()}
          variant="secondary"
        />
      )}

      {processError && <InputLabel>{processError}</InputLabel>}

      <FormFieldInputContainer>
        <FormTextFieldInput
          label={t`Prompt`}
          defaultValue={input.prompt || ''}
          onChange={(value) => updateInput({ prompt: value })}
          readonly={readonly}
          multiline
          placeholder={t`Decide whether each profile matches…`}
        />
      </FormFieldInputContainer>

      <FormFieldInputContainer>
        <InputLabel>{t`Model`}</InputLabel>
        <Select
          dropdownId={`ai-filtering-model-${action.id}`}
          options={AVAILABLE_MODELS.map((model) => ({
            label: model.label,
            value: model.value,
          }))}
          value={input.selectedModel || 'typesafe-ai/jev'}
          onChange={(value) => updateInput({ selectedModel: value })}
          disabled={readonly}
        />
      </FormFieldInputContainer>

      <FormFieldInputContainer>
        <InputLabel>{t`Input fields`}</InputLabel>
        <StyledChipRow>
          {METADATA_OPTIONS.map((fieldName) => {
            const active = selectedMetadataFields.includes(fieldName);

            return (
              <StyledChipButton
                key={fieldName}
                type="button"
                $active={active}
                disabled={readonly}
                onClick={() => {
                  if (readonly) {
                    return;
                  }

                  updateInput({
                    selectedMetadataFields: active
                      ? selectedMetadataFields.filter(
                          (entry) => entry !== fieldName,
                        )
                      : [...selectedMetadataFields, fieldName],
                  });
                }}
              >
                {fieldName}
              </StyledChipButton>
            );
          })}
        </StyledChipRow>
      </FormFieldInputContainer>

      <WorkflowOutputSchemaBuilder
        fields={toOutputSchemaFields(input.fields ?? [])}
        readonly={readonly}
        onChange={(fields) =>
          updateInput({
            fields: fromOutputSchemaFields(fields, input.fields ?? []),
          })
        }
      />
    </StyledContainer>
  );
};
