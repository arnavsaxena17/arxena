import { t } from '@lingui/core/macro';
import { FormFieldInputContainer } from '@/object-record/record-field/ui/form-types/components/FormFieldInputContainer';
import { FormFieldInputInnerContainer } from '@/object-record/record-field/ui/form-types/components/FormFieldInputInnerContainer';
import { FormFieldInputRowContainer } from '@/object-record/record-field/ui/form-types/components/FormFieldInputRowContainer';
import { TextVariableEditor } from '@/object-record/record-field/ui/form-types/components/TextVariableEditor';
import { useTextVariableEditor } from '@/object-record/record-field/ui/form-types/hooks/useTextVariableEditor';
import { type VariablePickerComponent } from '@/object-record/record-field/ui/form-types/types/VariablePickerComponent';
import { InputHint } from '@/ui/input/components/InputHint';
import { InputLabel } from '@/ui/input/components/InputLabel';
import { isString } from '@sniptt/guards';
import { useId } from 'react';
import { isDefined, isPlainObject } from 'twenty-shared/utils';
import { type JsonValue } from 'type-fest';
import { turnIntoEmptyStringIfWhitespacesOnly } from '~/utils/string/turnIntoEmptyStringIfWhitespacesOnly';

type FormRawJsonFieldInputProps = {
  label?: string;
  error?: string;
  // UPDATE_RECORD / CREATE_RECORD can persist RAW_JSON as an object
  defaultValue: JsonValue | undefined;
  onChange: (value: string | null) => void;
  onBlur?: () => void;
  readonly?: boolean;
  VariablePicker?: VariablePickerComponent;
  placeholder?: string;
  className?: string;
};

export const FormRawJsonFieldInput = ({
  label,
  error,
  defaultValue,
  placeholder,
  onChange,
  onBlur,
  readonly,
  VariablePicker,
  className,
}: FormRawJsonFieldInputProps) => {
  const instanceId = useId();

  // Editor expects a string; workflow steps often store RAW_JSON as objects
  const stringDefaultValue = isString(defaultValue)
    ? defaultValue
    : Array.isArray(defaultValue) || isPlainObject(defaultValue)
      ? JSON.stringify(defaultValue, null, 2)
      : isDefined(defaultValue)
        ? `${defaultValue}`
        : undefined;

  const editor = useTextVariableEditor({
    placeholder: placeholder ?? t`Enter a JSON object`,
    multiline: true,
    readonly,
    defaultValue: stringDefaultValue,
    onUpdate: (editor) => {
      const text = turnIntoEmptyStringIfWhitespacesOnly(editor.getText());

      if (text === '') {
        onChange(null);

        return;
      }

      onChange(text);
    },
  });

  const handleVariableTagInsert = (variableName: string) => {
    if (!isDefined(editor)) {
      throw new Error(
        'Expected the editor to be defined when a variable is selected',
      );
    }

    editor.commands.insertVariableTag(variableName);
  };

  if (!isDefined(editor)) {
    return null;
  }

  return (
    <FormFieldInputContainer className={className}>
      {label ? <InputLabel>{label}</InputLabel> : null}

      <FormFieldInputRowContainer multiline>
        <FormFieldInputInnerContainer
          formFieldInputInstanceId={instanceId}
          hasRightElement={isDefined(VariablePicker) && !readonly}
          multiline
          onBlur={onBlur}
        >
          <TextVariableEditor editor={editor} multiline readonly={readonly} />
        </FormFieldInputInnerContainer>

        {VariablePicker && !readonly && (
          <VariablePicker
            instanceId={instanceId}
            multiline
            onVariableSelect={handleVariableTagInsert}
          />
        )}
      </FormFieldInputRowContainer>
      {error && <InputHint danger>{error}</InputHint>}
    </FormFieldInputContainer>
  );
};
