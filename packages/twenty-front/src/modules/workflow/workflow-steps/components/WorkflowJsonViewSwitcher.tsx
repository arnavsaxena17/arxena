import { LightCopyIconButton } from '@/object-record/record-field/ui/components/LightCopyIconButton';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useState, type ReactNode } from 'react';
import { IconCode, IconHierarchy2 } from 'twenty-ui/icon';
import { CodeEditor, CoreEditorHeader, LightIconButton } from 'twenty-ui/input';
import {
  type GetJsonNodeHighlighting,
  isTwoFirstDepths,
  JsonTree,
  type ShouldExpandNodeInitiallyProps,
} from 'twenty-ui/json-visualizer';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { type JsonValue } from 'type-fest';
import { useCopyToClipboard } from '~/hooks/useCopyToClipboard';

const DEFAULT_CODE_EDITOR_HEIGHT = 450;

type ViewMode = 'viewer' | 'code';

type WorkflowJsonViewSwitcherProps = {
  value: JsonValue;
  jsonString?: string;
  readonly?: boolean;
  height?: number;
  tree?: ReactNode;
  getNodeHighlighting?: GetJsonNodeHighlighting;
  shouldExpandNodeInitially?: (
    params: ShouldExpandNodeInitiallyProps,
  ) => boolean;
  onJsonChange?: (jsonString: string) => void;
};

const stringifyJsonValue = (value: JsonValue) => {
  if (value === null) {
    return 'null';
  }

  return JSON.stringify(value, null, 2);
};

const StyledEditorContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  width: 100%;
`;

const StyledJsonTreeContainer = styled.div`
  background-color: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: 0 0 ${themeCssVariables.border.radius.md}
    ${themeCssVariables.border.radius.md};
  border-top: none;
  overflow: auto;
  padding: ${themeCssVariables.spacing[2]};

  ul {
    min-width: 0;
  }
`;

export const WorkflowJsonViewSwitcher = ({
  value,
  jsonString,
  readonly = true,
  height = DEFAULT_CODE_EDITOR_HEIGHT,
  tree,
  getNodeHighlighting,
  shouldExpandNodeInitially = isTwoFirstDepths,
  onJsonChange,
}: WorkflowJsonViewSwitcherProps) => {
  const { copyToClipboard } = useCopyToClipboard();
  const [viewMode, setViewMode] = useState<ViewMode>('viewer');
  const prettyJson = jsonString ?? stringifyJsonValue(value);

  return (
    <StyledEditorContainer>
      <CoreEditorHeader
        leftNodes={[
          <LightIconButton
            Icon={IconHierarchy2}
            active={viewMode === 'viewer'}
            title={t`JSON viewer`}
            aria-label={t`JSON viewer`}
            onClick={() => setViewMode('viewer')}
          />,
          <LightIconButton
            Icon={IconCode}
            active={viewMode === 'code'}
            title={t`JSON code`}
            aria-label={t`JSON code`}
            onClick={() => setViewMode('code')}
          />,
        ]}
        rightNodes={[<LightCopyIconButton copyText={prettyJson} />]}
      />
      {viewMode === 'viewer' ? (
        <StyledJsonTreeContainer style={{ maxHeight: height }}>
          {tree ?? (
            <JsonTree
              value={value}
              emptyArrayLabel={t`Empty Array`}
              emptyObjectLabel={t`Empty Object`}
              emptyStringLabel={t`[empty string]`}
              arrowButtonCollapsedLabel={t`Expand`}
              arrowButtonExpandedLabel={t`Collapse`}
              shouldExpandNodeInitially={shouldExpandNodeInitially}
              getNodeHighlighting={getNodeHighlighting}
              onNodeValueClick={copyToClipboard}
            />
          )}
        </StyledJsonTreeContainer>
      ) : (
        <CodeEditor
          value={prettyJson}
          language="json"
          height={height}
          variant="with-header"
          resizable={true}
          options={{
            readOnly: readonly,
            domReadOnly: readonly,
            folding: true,
            scrollBeyondLastLine: false,
            lineNumbersMinChars: 2,
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
              useShadows: false,
            },
          }}
          onChange={readonly === true ? undefined : onJsonChange}
        />
      )}
    </StyledEditorContainer>
  );
};
