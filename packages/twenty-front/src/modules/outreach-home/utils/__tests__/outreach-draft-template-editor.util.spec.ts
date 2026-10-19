import {
  draftTemplateToEditorContent,
  editorContentToDraftTemplate,
} from '@/outreach-home/utils/outreach-draft-template-editor.util';

describe('outreach draft template editor util', () => {
  it('should round-trip text, variables and line breaks', () => {
    const template = 'Hi {{person.firstName}},\nBest,\n{{sender.name}}';

    expect(
      editorContentToDraftTemplate(draftTemplateToEditorContent(template)),
    ).toBe(template);
  });

  it('should turn a variable token into a chip node', () => {
    const content = draftTemplateToEditorContent('{{company.name}}');

    expect(content.content?.[0].content?.[0]).toEqual({
      type: 'draftVariableTag',
      attrs: { variable: 'company.name' },
    });
  });

  it('should join multiple paragraphs with newlines', () => {
    expect(
      editorContentToDraftTemplate({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'a' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'b' }] },
        ],
      }),
    ).toBe('a\nb');
  });
});
