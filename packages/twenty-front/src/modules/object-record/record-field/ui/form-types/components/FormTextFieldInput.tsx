import { t } from '@lingui/core/macro';
import { FormFieldInputContainer } from '@/object-record/record-field/ui/form-types/components/FormFieldInputContainer';
import { FormFieldInputInnerContainer } from '@/object-record/record-field/ui/form-types/components/FormFieldInputInnerContainer';
import {
  FormFieldInputRowContainer,
  LINE_HEIGHT,
} from '@/object-record/record-field/ui/form-types/components/FormFieldInputRowContainer';
import { TextVariableEditor } from '@/object-record/record-field/ui/form-types/components/TextVariableEditor';
import { useTextVariableEditor } from '@/object-record/record-field/ui/form-types/hooks/useTextVariableEditor';
import { type VariablePickerComponent } from '@/object-record/record-field/ui/form-types/types/VariablePickerComponent';
import { InputHint } from '@/ui/input/components/InputHint';
import { InputLabel } from '@/ui/input/components/InputLabel';
import { parseEditorContent } from '@/workflow/workflow-variables/utils/parseEditorContent';
import { useId } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { ResizeHandle, useResizeHandle } from 'twenty-ui/layout';

type FormTextFieldInputProps = {
  label?: string;
  error?: string;
  hint?: string;
  defaultValue: string | undefined | null;
  onChange: (value: string) => void;
  onBlur?: () => void;
  multiline?: boolean;
  readonly?: boolean;
  placeholder?: string;
  resizable?: boolean;
  VariablePicker?: VariablePickerComponent;
};

const RESIZABLE_INPUT_MIN_HEIGHT = 3 * LINE_HEIGHT;
const RESIZABLE_INPUT_DEFAULT_HEIGHT = 5 * LINE_HEIGHT;
const RESIZABLE_INPUT_MAX_HEIGHT = 640;

export const FormTextFieldInput = ({
  label,
  error,
  hint,
  defaultValue,
  placeholder,
  onChange,
  onBlur,
  multiline,
  readonly,
  resizable = false,
  VariablePicker,
}: FormTextFieldInputProps) => {
  const instanceId = useId();
  const {
    size: resizableHeight,
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd,
  } = useResizeHandle({
    initialSize: RESIZABLE_INPUT_DEFAULT_HEIGHT,
    minSize: RESIZABLE_INPUT_MIN_HEIGHT,
    maxSize: RESIZABLE_INPUT_MAX_HEIGHT,
  });

  const editor = useTextVariableEditor({
    placeholder: placeholder ?? t`Enter text`,
    multiline,
    readonly,
    defaultValue,
    onUpdate: (editor) => {
      const jsonContent = editor.getJSON();
      const parsedContent = parseEditorContent(jsonContent);

      onChange(parsedContent);
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
    <FormFieldInputContainer>
      {label ? <InputLabel>{label}</InputLabel> : null}

      <FormFieldInputRowContainer
        multiline={multiline}
        height={resizable ? resizableHeight : undefined}
      >
        <FormFieldInputInnerContainer
          formFieldInputInstanceId={instanceId}
          hasRightElement={isDefined(VariablePicker) && !readonly}
          multiline={multiline}
          fillHeight={resizable}
          onBlur={onBlur}
        >
          <TextVariableEditor
            editor={editor}
            multiline={multiline}
            readonly={readonly}
          />
        </FormFieldInputInnerContainer>

        {VariablePicker && !readonly ? (
          <VariablePicker
            instanceId={instanceId}
            multiline={multiline}
            onVariableSelect={handleVariableTagInsert}
          />
        ) : null}
      </FormFieldInputRowContainer>
      {resizable ? (
        <ResizeHandle
          onPointerDown={handleResizeStart}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
        />
      ) : null}
      {hint && <InputHint>{hint}</InputHint>}
      {error && <InputHint danger>{error}</InputHint>}
    </FormFieldInputContainer>
  );
};
