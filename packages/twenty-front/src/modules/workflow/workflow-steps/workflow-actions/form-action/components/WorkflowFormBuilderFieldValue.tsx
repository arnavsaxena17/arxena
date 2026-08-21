import { FormBooleanFieldInput } from '@/object-record/record-field/ui/form-types/components/FormBooleanFieldInput';
import { FormFieldInputInnerContainer } from '@/object-record/record-field/ui/form-types/components/FormFieldInputInnerContainer';
import { FormFieldInputRowContainer } from '@/object-record/record-field/ui/form-types/components/FormFieldInputRowContainer';
import { FormFieldPlaceholder } from '@/object-record/record-field/ui/form-types/components/FormFieldPlaceholder';
import { FormTextFieldInput } from '@/object-record/record-field/ui/form-types/components/FormTextFieldInput';
import { InputLabel } from '@/ui/input/components/InputLabel';
import { type WorkflowFormActionField } from '@/workflow/workflow-steps/workflow-actions/form-action/types/WorkflowFormActionField';
import { getDefaultFormFieldSettings } from '@/workflow/workflow-steps/workflow-actions/form-action/utils/getDefaultFormFieldSettings';
import { WorkflowVariablePicker } from '@/workflow/workflow-variables/components/WorkflowVariablePicker';
import { styled } from '@linaria/react';
import { isNonEmptyString } from '@sniptt/guards';
import { useContext } from 'react';
import { FieldMetadataType } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { IconChevronDown } from 'twenty-ui/icon';
import { ThemeContext, themeCssVariables } from 'twenty-ui/theme-constants';

const StyledFieldContainer = styled.div<{
  readonly?: boolean;
}>`
  align-items: center;
  background: transparent;
  border: none;
  cursor: ${({ readonly }) => (readonly ? 'default' : 'pointer')};
  display: flex;
  font-family: inherit;
  height: 100%;
  padding-left: ${themeCssVariables.spacing[2]};
  padding-right: ${themeCssVariables.spacing[2]};
  width: 100%;

  &:hover,
  &[data-open='true'] {
    background-color: ${({ readonly }) =>
      readonly
        ? 'transparent'
        : themeCssVariables.background.transparent.lighter};
  }
`;

const StyledPlaceholderContainer = styled.div`
  width: 100%;
`;

type WorkflowFormBuilderFieldValueProps = {
  field: WorkflowFormActionField;
  readonly: boolean;
  isSelected: boolean;
  onChange: (field: WorkflowFormActionField) => void;
  onOpenSettings: () => void;
};

const stringDefaultValue = (field: WorkflowFormActionField): string => {
  if (typeof field.value === 'string') {
    return field.value;
  }

  if (typeof field.value === 'number' || typeof field.value === 'boolean') {
    return String(field.value);
  }

  return '';
};

export const WorkflowFormBuilderFieldValue = ({
  field,
  readonly,
  isSelected,
  onChange,
  onOpenSettings,
}: WorkflowFormBuilderFieldValueProps) => {
  const { theme } = useContext(ThemeContext);

  if (field.type === FieldMetadataType.BOOLEAN) {
    return (
      <FormBooleanFieldInput
        label={field.label}
        defaultValue={typeof field.value === 'boolean' ? field.value : undefined}
        readonly={readonly}
        onChange={(value) => {
          onChange({
            ...field,
            value: typeof value === 'boolean' ? value : value === 'true',
          });
        }}
      />
    );
  }

  if (
    field.type === FieldMetadataType.TEXT ||
    field.type === FieldMetadataType.NUMBER
  ) {
    return (
      <FormTextFieldInput
        label={field.label}
        defaultValue={stringDefaultValue(field)}
        placeholder={
          field.placeholder ??
          getDefaultFormFieldSettings(field.type).placeholder
        }
        readonly={readonly}
        multiline={field.type === FieldMetadataType.TEXT}
        VariablePicker={readonly ? undefined : WorkflowVariablePicker}
        onChange={(value) => {
          onChange({
            ...field,
            value,
          });
        }}
      />
    );
  }

  return (
    <>
      <InputLabel>{field.label || ''}</InputLabel>
      <FormFieldInputRowContainer>
        <FormFieldInputInnerContainer
          formFieldInputInstanceId={field.id}
          hasRightElement={false}
          onClick={onOpenSettings}
        >
          <StyledFieldContainer readonly={readonly} data-open={isSelected}>
            <StyledPlaceholderContainer>
              <FormFieldPlaceholder>
                {isDefined(field.placeholder) &&
                isNonEmptyString(field.placeholder)
                  ? field.placeholder
                  : getDefaultFormFieldSettings(field.type).placeholder}
              </FormFieldPlaceholder>
            </StyledPlaceholderContainer>
            {(field.type === 'RECORD' ||
              field.type === 'SELECT' ||
              field.type === 'MULTI_SELECT') && (
              <IconChevronDown
                size={theme.icon.size.md}
                color={themeCssVariables.font.color.tertiary}
              />
            )}
          </StyledFieldContainer>
        </FormFieldInputInnerContainer>
      </FormFieldInputRowContainer>
    </>
  );
};
