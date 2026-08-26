import { FormFieldInputContainer } from '@/object-record/record-field/ui/form-types/components/FormFieldInputContainer';
import { InputHint } from '@/ui/input/components/InputHint';
import { InputLabel } from '@/ui/input/components/InputLabel';
import { parseAndValidateVariableFriendlyStringifiedJson } from '@/workflow/utils/parseAndValidateVariableFriendlyStringifiedJson';
import { WorkflowJsonViewSwitcher } from '@/workflow/workflow-steps/components/WorkflowJsonViewSwitcher';
import { t } from '@lingui/core/macro';
import { isNonEmptyString } from '@sniptt/guards';
import { useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { type JsonValue } from 'type-fest';

const CODE_EDITOR_HEIGHT = 280;

type WorkflowExpectedOutputBodyInputProps = {
  label?: string;
  placeholder?: string;
  defaultValue: object | undefined;
  readonly?: boolean;
  onChange: (parsedValue: Record<string, unknown>) => void;
};

const stringifyExpectedOutput = (value: object | undefined) => {
  if (isDefined(value) && Object.keys(value).length > 0) {
    return JSON.stringify(value, null, 2);
  }

  return '{}';
};

const getJsonTreeValue = (value: object | undefined): JsonValue => {
  if (!isDefined(value) || Object.keys(value).length === 0) {
    return {};
  }

  return value as JsonValue;
};

export const WorkflowExpectedOutputBodyInput = ({
  label,
  defaultValue,
  readonly,
  onChange,
}: WorkflowExpectedOutputBodyInputProps) => {
  const [draft, setDraft] = useState(() =>
    stringifyExpectedOutput(defaultValue),
  );
  const [error, setError] = useState<string | undefined>();

  const handleChange = (value: string) => {
    setDraft(value);

    if (readonly === true) {
      return;
    }

    const parsingResult = parseAndValidateVariableFriendlyStringifiedJson(
      isNonEmptyString(value) ? value : '{}',
    );

    if (!parsingResult.isValid) {
      setError(parsingResult.error);

      return;
    }

    setError(undefined);
    onChange(parsingResult.data);
  };

  return (
    <FormFieldInputContainer>
      <InputLabel>{label ?? t`Expected Output Body`}</InputLabel>
      <WorkflowJsonViewSwitcher
        value={getJsonTreeValue(defaultValue)}
        jsonString={draft}
        readonly={readonly === true}
        height={CODE_EDITOR_HEIGHT}
        onJsonChange={handleChange}
      />
      {error && <InputHint danger>{error}</InputHint>}
    </FormFieldInputContainer>
  );
};
