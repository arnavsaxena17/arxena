import { styled } from '@linaria/react';
import Document from '@tiptap/extension-document';
import HardBreak from '@tiptap/extension-hard-break';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { Node, mergeAttributes } from '@tiptap/core';
import { Placeholder } from '@tiptap/extensions/placeholder';
import { UndoRedo } from '@tiptap/extensions/undo-redo';
import {
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
  useEditor,
} from '@tiptap/react';
import { OUTREACH_DRAFT_VARIABLES } from 'twenty-shared/arx';
import { IconAlertTriangle } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { BaseChip } from '@/object-record/record-field/ui/form-types/components/BaseChip';
import {
  DRAFT_VARIABLE_TAG_NODE_NAME,
  draftTemplateToEditorContent,
  editorContentToDraftTemplate,
  getDraftVariableLabel,
} from '@/outreach-home/utils/outreach-draft-template-editor.util';

const StyledEditorShell = styled.div`
  background-color: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-sizing: border-box;
  min-height: 160px;
  padding: ${themeCssVariables.spacing[2]};

  &:focus-within {
    border-color: ${themeCssVariables.color.blue};
  }

  .tiptap {
    color: ${themeCssVariables.font.color.primary};
    font-family: ${themeCssVariables.font.family};
    font-size: ${themeCssVariables.font.size.md};
    line-height: 1.6;
    min-height: 140px;
    outline: none;
    white-space: pre-wrap;
  }

  .tiptap p {
    margin: 0;
  }

  .tiptap p.is-editor-empty:first-of-type::before {
    color: ${themeCssVariables.font.color.light};
    content: attr(data-placeholder);
    float: left;
    height: 0;
    pointer-events: none;
  }
`;

const StyledChipWrapper = styled.span`
  display: inline-block;
  padding-inline: ${themeCssVariables.spacing[0.5]};
  white-space: nowrap;
`;

const StyledInsertRow = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledInsertLabel = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  margin-right: ${themeCssVariables.spacing[1]};
`;

const StyledInsertButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  margin: 0;
  padding: 0;
`;

const StyledRoot = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
`;

const DraftVariableChip = ({ node, deleteNode, editor }: NodeViewProps) => {
  const variableKey = String(node.attrs.variable ?? '');
  const label = getDraftVariableLabel(variableKey);

  return (
    <NodeViewWrapper as={StyledChipWrapper}>
      <BaseChip
        label={label ?? variableKey}
        ariaLabel={label ?? `Unknown variable ${variableKey}`}
        danger={label === null}
        leftIcon={label === null ? <IconAlertTriangle size={12} /> : undefined}
        onRemove={editor.isEditable ? deleteNode : undefined}
        removeAriaLabel="Remove variable"
      />
    </NodeViewWrapper>
  );
};

const DraftVariableTag = Node.create({
  name: DRAFT_VARIABLE_TAG_NODE_NAME,
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes: () => ({
    variable: {
      default: null,
      parseHTML: (element) => element.getAttribute('data-variable'),
      renderHTML: (attributes) => ({ 'data-variable': attributes.variable }),
    },
  }),

  parseHTML: () => [
    { tag: `span[data-type="${DRAFT_VARIABLE_TAG_NODE_NAME}"]` },
  ],

  renderHTML: ({ node, HTMLAttributes }) => [
    'span',
    mergeAttributes(HTMLAttributes, {
      'data-type': DRAFT_VARIABLE_TAG_NODE_NAME,
    }),
    String(node.attrs.variable ?? ''),
  ],

  addNodeView: () => ReactNodeViewRenderer(DraftVariableChip),

  renderText: ({ node }) => `{{${node.attrs.variable}}}`,
});

const MultilineHardBreak = HardBreak.extend({
  addKeyboardShortcuts() {
    return {
      Enter: () => this.editor.commands.setHardBreak(),
      'Shift-Enter': () => this.editor.commands.setHardBreak(),
    };
  },
}).configure({ keepMarks: false });

type OutreachDraftTemplateEditorProps = {
  // Initial template. Remount with a new `key` to load a different one.
  initialValue: string;
  onChange: (template: string) => void;
  placeholder?: string;
};

export const OutreachDraftTemplateEditor = ({
  initialValue,
  onChange,
  placeholder,
}: OutreachDraftTemplateEditorProps) => {
  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      Placeholder.configure({ placeholder }),
      DraftVariableTag,
      MultilineHardBreak,
      UndoRedo,
    ],
    content: draftTemplateToEditorContent(initialValue),
    onUpdate: ({ editor: updatedEditor }) => {
      onChange(editorContentToDraftTemplate(updatedEditor.getJSON()));
    },
    enableInputRules: false,
    enablePasteRules: false,
    injectCSS: false,
  });

  const handleInsertVariable = (variableKey: string) => {
    editor
      ?.chain()
      .focus()
      .insertContent({
        type: DRAFT_VARIABLE_TAG_NODE_NAME,
        attrs: { variable: variableKey },
      })
      .run();
  };

  return (
    <StyledRoot>
      <StyledInsertRow>
        <StyledInsertLabel>Insert variable</StyledInsertLabel>
        {OUTREACH_DRAFT_VARIABLES.map((variable) => (
          <StyledInsertButton
            key={variable.key}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => handleInsertVariable(variable.key)}
            aria-label={`Insert ${variable.label}`}
          >
            <BaseChip label={variable.label} />
          </StyledInsertButton>
        ))}
      </StyledInsertRow>
      <StyledEditorShell>
        <EditorContent editor={editor} />
      </StyledEditorShell>
    </StyledRoot>
  );
};
