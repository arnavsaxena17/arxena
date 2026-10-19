import { type JSONContent } from '@tiptap/react';
import { OUTREACH_DRAFT_VARIABLES } from 'twenty-shared/arx';

export const DRAFT_VARIABLE_TAG_NODE_NAME = 'draftVariableTag';

const TOKEN_SPLIT_PATTERN = /(\{\{\s*[^{}]+?\s*\}\})/;
const TOKEN_PATTERN = /^\{\{\s*([^{}]+?)\s*\}\}$/;

export const getDraftVariableLabel = (variableKey: string): string | null =>
  OUTREACH_DRAFT_VARIABLES.find((variable) => variable.key === variableKey)
    ?.label ?? null;

// Stored text → editor doc. Variables become chips; line breaks become hard breaks.
export const draftTemplateToEditorContent = (template: string): JSONContent => {
  const content: JSONContent[] = [];
  const lines = template.split('\n');

  lines.forEach((line, index) => {
    for (const part of line.split(TOKEN_SPLIT_PATTERN)) {
      const tokenMatch = part.match(TOKEN_PATTERN);

      if (tokenMatch !== null) {
        content.push({
          type: DRAFT_VARIABLE_TAG_NODE_NAME,
          attrs: { variable: tokenMatch[1].trim() },
        });
      } else if (part !== '') {
        content.push({ type: 'text', text: part });
      }
    }

    if (index < lines.length - 1) {
      content.push({ type: 'hardBreak' });
    }
  });

  return { type: 'doc', content: [{ type: 'paragraph', content }] };
};

// Editor doc → stored text. Unlike the workflow editors, hard breaks are plain
// newlines so the sent message has no trailing double spaces.
export const editorContentToDraftTemplate = (node: JSONContent): string => {
  if (node.type === 'text') {
    return (node.text ?? '').replace(/ /g, ' ');
  }

  if (node.type === 'hardBreak') {
    return '\n';
  }

  if (node.type === DRAFT_VARIABLE_TAG_NODE_NAME) {
    return `{{${node.attrs?.variable ?? ''}}}`;
  }

  const children = node.content ?? [];

  if (node.type === 'doc') {
    return children.map(editorContentToDraftTemplate).join('\n');
  }

  return children.map(editorContentToDraftTemplate).join('');
};
