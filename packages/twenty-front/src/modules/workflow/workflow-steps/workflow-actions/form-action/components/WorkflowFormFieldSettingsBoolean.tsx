import { FormBooleanFieldInput } from '@/object-record/record-field/ui/form-types/components/FormBooleanFieldInput';
import { FormFieldInputContainer } from '@/object-record/record-field/ui/form-types/components/FormFieldInputContainer';
import { FormTextFieldInput } from '@/object-record/record-field/ui/form-types/components/FormTextFieldInput';
import { InputLabel } from '@/ui/input/components/InputLabel';
import { type WorkflowFormActionField } from '@/workflow/workflow-steps/workflow-actions/form-action/types/WorkflowFormActionField';
import { getDefaultFormFieldSettings } from '@/workflow/workflow-steps/workflow-actions/form-action/utils/getDefaultFormFieldSettings';
import { t } from '@lingui/core/macro';
import { styled } from '@linaria/react';
import camelCase from 'lodash.camelcase';
import { FieldMetadataType } from 'twenty-shared/types';
import { themeCssVariables } from 'twenty-ui/theme-constants';

type WorkflowFormFieldSettingsBooleanProps = {
  field: WorkflowFormActionField;
  onChange: (updatedField: WorkflowFormActionField) => void;
};

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
`;

export const WorkflowFormFieldSettingsBoolean = ({
  field,
  onChange,
}: WorkflowFormFieldSettingsBooleanProps) => {
  return (
    <StyledContainer>
      <FormFieldInputContainer>
        <InputLabel>{t`Label`}</InputLabel>
        <FormTextFieldInput
          onChange={(newLabel: string) => {
            onChange({
              ...field,
              label: newLabel,
              name: camelCase(newLabel),
            });
          }}
          defaultValue={field.label}
          placeholder={
            getDefaultFormFieldSettings(FieldMetadataType.BOOLEAN).label
          }
        />
      </FormFieldInputContainer>
      <FormBooleanFieldInput
        label={t`Default value`}
        defaultValue={typeof field.value === 'boolean' ? field.value : undefined}
        onChange={(value) => {
          onChange({
            ...field,
            value: typeof value === 'boolean' ? value : value === 'true',
          });
        }}
      />
    </StyledContainer>
  );
};
