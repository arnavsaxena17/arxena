import { getInitialEditorContent } from '@/workflow/workflow-variables/utils/getInitialEditorContent';
import { VariableTag } from '@/workflow/workflow-variables/utils/variableTag';
import Document from '@tiptap/extension-document';
import HardBreak from '@tiptap/extension-hard-break';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { Placeholder } from '@tiptap/extensions/placeholder';
import { UndoRedo } from '@tiptap/extensions/undo-redo';
import { Slice } from '@tiptap/pm/model';

import { type Editor, useEditor } from '@tiptap/react';
import { useEffect } from 'react';
import { isDefined, parseJson } from 'twenty-shared/utils';
import { type JsonValue } from 'type-fest';

const MultilineHardBreak = HardBreak.extend({
  addKeyboardShortcuts() {
    return {
      Enter: () => this.editor.commands.setHardBreak(),
      'Shift-Enter': () => this.editor.commands.setHardBreak(),
      'Mod-Enter': () => this.editor.commands.setHardBreak(),
    };
  },
}).configure({
  keepMarks: false,
});

type UseTextVariableEditorProps = {
  placeholder: string | undefined;
  multiline: boolean | undefined;
  readonly: boolean | undefined;
  defaultValue: string | undefined | null;
  onUpdate: (editor: Editor) => void;
};

/**
 * Checks if the given text is a valid JSON object (not array, primitive, or null)
 */
const isJsonObject = (text: string): boolean => {
  try {
    const parsed = JSON.parse(text);
    return parsed !== null && typeof parsed === 'object';
  } catch {
    return false;
  }
};

export const useTextVariableEditor = ({
  placeholder,
  multiline,
  readonly,
  defaultValue,
  onUpdate,
}: UseTextVariableEditorProps) => {
  const editor = useEditor(
    {
      extensions: [
        Document,
        Paragraph,
        Text,
        Placeholder.configure({
          placeholder,
        }),
        VariableTag,
        ...(multiline === true ? [MultilineHardBreak] : []),
        UndoRedo,
      ],
      content: isDefined(defaultValue)
        ? getInitialEditorContent(defaultValue)
        : undefined,
      editable: !readonly,
      onUpdate: ({ editor }) => {
        onUpdate(editor);
      },
      editorProps: {
        handleKeyDown: (view, event) => {
          if (event.key !== 'Enter' && event.key !== 'NumpadEnter') {
            return false;
          }

          if (multiline === true) {
            const hardBreak = view.state.schema.nodes.hardBreak;

            if (isDefined(hardBreak)) {
              event.preventDefault();
              event.stopPropagation();
              view.dispatch(
                view.state.tr
                  .replaceSelectionWith(hardBreak.create())
                  .scrollIntoView(),
              );

              return true;
            }

            return false;
          }

          event.preventDefault();

          return true;
        },
        handlePaste: (view, event) => {
          const plainText = event.clipboardData?.getData('text/plain') ?? '';
          const {
            state: { schema, tr },
          } = view;

          // Format pasted JSON content with pretty-printing
          if (isJsonObject(plainText)) {
            const parsedJson = parseJson<JsonValue>(plainText);
            const formattedJson = multiline
              ? JSON.stringify(parsedJson, null, 2)
              : JSON.stringify(parsedJson);
            const docNode = schema.nodeFromJSON(
              getInitialEditorContent(formattedJson),
            );
            const inlineContent = docNode.firstChild?.content;

            if (inlineContent && inlineContent.size > 0) {
              tr.replaceSelection(new Slice(inlineContent, 0, 0));
              view.dispatch(tr);
            }
            return true;
          }

          // In multiline mode, convert newlines to hardBreak nodes
          if (multiline && plainText.includes('\n')) {
            const docNode = schema.nodeFromJSON(
              getInitialEditorContent(plainText),
            );
            const inlineContent = docNode.firstChild?.content;

            if (inlineContent && inlineContent.size > 0) {
              tr.replaceSelection(new Slice(inlineContent, 0, 0));
              view.dispatch(tr);
              return true;
            }
            return false;
          }

          return false;
        },
      },
      enableInputRules: false,
      enablePasteRules: false,
      injectCSS: false,
    },
    [multiline],
  );

  useEffect(() => {
    editor?.setEditable(!readonly, false);
  }, [editor, readonly]);

  return editor;
};
