import { LightCopyIconButton } from '@/object-record/record-field/ui/components/LightCopyIconButton';
import { FormFieldInputContainer } from '@/object-record/record-field/ui/form-types/components/FormFieldInputContainer';
import { InputHint } from '@/ui/input/components/InputHint';
import { InputLabel } from '@/ui/input/components/InputLabel';
import { parseAndValidateVariableFriendlyStringifiedJson } from '@/workflow/utils/parseAndValidateVariableFriendlyStringifiedJson';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { isNonEmptyString } from '@sniptt/guards';
import { useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { IconCode, IconHierarchy2 } from 'twenty-ui/icon';
import { CodeEditor, CoreEditorHeader, LightIconButton } from 'twenty-ui/input';
import { isTwoFirstDepths, JsonTree } from 'twenty-ui/json-visualizer';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { type JsonValue } from 'type-fest';
import { useCopyToClipboard } from '~/hooks/useCopyToClipboard';

const CODE_EDITOR_HEIGHT = 280;

type ViewMode = 'viewer' | 'code';

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

const StyledEditorContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`;

const StyledJsonTreeContainer = styled.div`
  background-color: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: 0 0 ${themeCssVariables.border.radius.md}
    ${themeCssVariables.border.radius.md};
  border-top: none;
  max-height: ${CODE_EDITOR_HEIGHT}px;
  overflow: auto;
  padding: ${themeCssVariables.spacing[2]};

  ul {
    min-width: 0;
  }
`;

export const WorkflowExpectedOutputBodyInput = ({
  label,
  defaultValue,
  readonly,
  onChange,
}: WorkflowExpectedOutputBodyInputProps) => {
  const { copyToClipboard } = useCopyToClipboard();
  const [viewMode, setViewMode] = useState<ViewMode>('viewer');
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

  const handleViewModeChange = (nextViewMode: ViewMode) => {
    if (nextViewMode === 'viewer' && isDefined(error)) {
      return;
    }

    setViewMode(nextViewMode);
  };

  return (
    <FormFieldInputContainer>
      <InputLabel>{label ?? t`Expected Output Body`}</InputLabel>
      <StyledEditorContainer>
        <CoreEditorHeader
          leftNodes={[
            <LightIconButton
              Icon={IconHierarchy2}
              active={viewMode === 'viewer'}
              title={t`JSON viewer`}
              aria-label={t`JSON viewer`}
              onClick={() => handleViewModeChange('viewer')}
            />,
            <LightIconButton
              Icon={IconCode}
              active={viewMode === 'code'}
              title={t`JSON code`}
              aria-label={t`JSON code`}
              onClick={() => handleViewModeChange('code')}
            />,
          ]}
          rightNodes={[<LightCopyIconButton copyText={draft} />]}
        />
        {viewMode === 'viewer' ? (
          <StyledJsonTreeContainer>
            <JsonTree
              value={getJsonTreeValue(defaultValue)}
              emptyArrayLabel={t`Empty Array`}
              emptyObjectLabel={t`Empty Object`}
              emptyStringLabel={t`[empty string]`}
              arrowButtonCollapsedLabel={t`Expand`}
              arrowButtonExpandedLabel={t`Collapse`}
              shouldExpandNodeInitially={isTwoFirstDepths}
              onNodeValueClick={copyToClipboard}
            />
          </StyledJsonTreeContainer>
        ) : (
          <CodeEditor
            value={draft}
            language="json"
            height={CODE_EDITOR_HEIGHT}
            variant="with-header"
            resizable={true}
            options={{
              readOnly: readonly,
              domReadOnly: readonly,
              folding: true,
              scrollBeyondLastLine: false,
              lineNumbersMinChars: 2,
            }}
            onChange={handleChange}
          />
        )}
      </StyledEditorContainer>
      {error && <InputHint danger>{error}</InputHint>}
    </FormFieldInputContainer>
  );
};
