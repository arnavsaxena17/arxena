import { type EmailAttachment } from 'twenty-shared/types';

import { type UnipileChatAttachment } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile/types/unipile-chat-attachment.type';
import { type FileService } from 'src/engine/core-modules/file/services/file.service';
import {
  UNIPILE_CHAT_ATTACHMENT_FILE_FOLDERS,
  UNIPILE_CHAT_ATTACHMENT_MAX_BYTES,
} from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/constants/unipile-chat-attachment-file-folders.const';
import { streamToBuffer } from 'src/utils/stream-to-buffer';

export const loadUnipileChatAttachments = async ({
  files,
  workspaceId,
  fileService,
}: {
  files?: EmailAttachment[];
  workspaceId?: string;
  fileService: FileService;
}): Promise<UnipileChatAttachment[]> => {
  if (!files || files.length === 0) {
    return [];
  }

  if (!workspaceId) {
    throw new Error('Workspace is required to load LinkedIn attachments');
  }

  const attachments: UnipileChatAttachment[] = [];

  for (const file of files) {
    const fileStream = await fileService.getFileStreamById({
      fileId: file.id,
      workspaceId,
      allowedFileFolders: UNIPILE_CHAT_ATTACHMENT_FILE_FOLDERS,
    });

    if (fileStream === null) {
      throw new Error(`Attachment not found: ${file.name} (${file.id})`);
    }

    let fileBuffer: Buffer;

    try {
      fileBuffer = await streamToBuffer(
        fileStream.stream,
        UNIPILE_CHAT_ATTACHMENT_MAX_BYTES,
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('exceeds maximum allowed size')
      ) {
        throw new Error(
          `Attachment ${file.name} exceeds Unipile's 15MB LinkedIn file limit`,
        );
      }

      throw error;
    }

    attachments.push({
      filename: file.name,
      contentType: fileStream.mimeType || 'application/octet-stream',
      fileBuffer,
    });
  }

  return attachments;
};
