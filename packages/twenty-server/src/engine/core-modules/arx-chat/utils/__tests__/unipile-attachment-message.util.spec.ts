import {
  buildIncomingAttachmentChatReply,
  isDocumentAttachment,
  isLikelyCvAttachment,
  resolveAttachmentMessageLabel,
} from '../unipile-attachment-message.util';

describe('unipile-attachment-message.util', () => {
  it('labels document/file attachments as CV Received', () => {
    expect(
      resolveAttachmentMessageLabel([{ type: 'file', mimetype: 'application/pdf' }]),
    ).toBe('CV Received');
    expect(isDocumentAttachment({ type: 'file' })).toBe(true);
    expect(isLikelyCvAttachment({ type: 'file', mimetype: 'application/pdf' })).toBe(
      true,
    );
  });

  it('falls back when message is empty/null but attachments exist', () => {
    expect(
      buildIncomingAttachmentChatReply(null, [{ type: 'file' }]),
    ).toBe('CV Received');
    expect(
      buildIncomingAttachmentChatReply('', [{ type: 'file' }]),
    ).toBe('CV Received');
  });

  it('appends CV Received when caption text is present with a document', () => {
    expect(
      buildIncomingAttachmentChatReply('Please find attached', [
        { type: 'file', mimetype: 'application/pdf' },
      ]),
    ).toBe('Please find attached\nCV Received');
  });

  it('keeps plain text when there are no attachments', () => {
    expect(buildIncomingAttachmentChatReply('Hello', undefined)).toBe('Hello');
    expect(buildIncomingAttachmentChatReply(null, undefined)).toBe('');
  });

  it('labels media types distinctly', () => {
    expect(resolveAttachmentMessageLabel([{ type: 'img' }])).toBe('[Image]');
    expect(resolveAttachmentMessageLabel([{ type: 'video' }])).toBe('[Video]');
    expect(resolveAttachmentMessageLabel([{ type: 'audio' }])).toBe(
      '[Audio Message]',
    );
  });
});
