import FormData from 'form-data';

import { appendUnipileChatAttachments } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile/utils/append-unipile-chat-attachments.util';

describe('appendUnipileChatAttachments', () => {
  it('appends file buffers as multipart attachments', () => {
    const formData = new FormData();
    const fileBuffer = Buffer.from('pdf-bytes');

    appendUnipileChatAttachments(formData, [
      {
        filename: 'one-pager.pdf',
        contentType: 'application/pdf',
        fileBuffer,
      },
    ]);

    const payload = formData.getBuffer().toString();

    expect(payload).toContain('filename="one-pager.pdf"');
    expect(payload).toContain('Content-Type: application/pdf');
    expect(payload).toContain('pdf-bytes');
  });

  it('skips values that are not file buffers', () => {
    const formData = new FormData();

    appendUnipileChatAttachments(formData, [
      { filename: 'ignored.json' },
      'not-an-attachment',
    ]);

    expect(formData.getBuffer().toString()).not.toContain('filename=');
  });
});
