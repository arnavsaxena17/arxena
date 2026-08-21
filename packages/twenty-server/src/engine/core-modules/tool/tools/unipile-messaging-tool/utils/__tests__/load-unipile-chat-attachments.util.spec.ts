import { Readable } from 'stream';

import { loadUnipileChatAttachments } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/load-unipile-chat-attachments.util';
import { type FileService } from 'src/engine/core-modules/file/services/file.service';

describe('loadUnipileChatAttachments', () => {
  it('returns an empty list when no files are provided', async () => {
    const fileService = {
      getFileStreamById: jest.fn(),
    } as unknown as FileService;

    await expect(
      loadUnipileChatAttachments({
        files: [],
        workspaceId: 'workspace-1',
        fileService,
      }),
    ).resolves.toEqual([]);

    expect(fileService.getFileStreamById).not.toHaveBeenCalled();
  });

  it('loads uploaded workflow files as Unipile buffers', async () => {
    const fileService = {
      getFileStreamById: jest.fn().mockResolvedValue({
        stream: Readable.from([Buffer.from('hello')]),
        mimeType: 'application/pdf',
      }),
    } as unknown as FileService;

    const attachments = await loadUnipileChatAttachments({
      files: [{ id: 'file-1', name: 'deck.pdf' }],
      workspaceId: 'workspace-1',
      fileService,
    });

    expect(attachments).toEqual([
      {
        filename: 'deck.pdf',
        contentType: 'application/pdf',
        fileBuffer: Buffer.from('hello'),
      },
    ]);
  });

  it('throws when a file cannot be read', async () => {
    const fileService = {
      getFileStreamById: jest.fn().mockResolvedValue(null),
    } as unknown as FileService;

    await expect(
      loadUnipileChatAttachments({
        files: [{ id: 'missing', name: 'gone.pdf' }],
        workspaceId: 'workspace-1',
        fileService,
      }),
    ).rejects.toThrow('Attachment not found: gone.pdf (missing)');
  });
});
