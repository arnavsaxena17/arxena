import { isNonEmptyString } from '@sniptt/guards';
import FormData from 'form-data';
import { isDefined } from 'twenty-shared/utils';

import { type UnipileChatAttachment } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile/types/unipile-chat-attachment.type';

const isUnipileChatAttachment = (
  value: unknown,
): value is UnipileChatAttachment => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const attachment = value as UnipileChatAttachment;

  return (
    isNonEmptyString(attachment.filename) && Buffer.isBuffer(attachment.fileBuffer)
  );
};

export const appendUnipileChatAttachments = (
  formData: FormData,
  attachments?: unknown[],
) => {
  if (!attachments || attachments.length === 0) {
    return;
  }

  for (const attachment of attachments) {
    if (!isUnipileChatAttachment(attachment)) {
      continue;
    }

    formData.append('attachments', attachment.fileBuffer, {
      filename: attachment.filename,
      contentType: attachment.contentType ?? 'application/octet-stream',
    });
  }
};

// LinkedIn prefers .m4a for voice_message multipart field
export const appendUnipileVoiceMessage = (
  formData: FormData,
  voiceMessage?: unknown,
) => {
  if (!isDefined(voiceMessage)) {
    return;
  }

  if (isUnipileChatAttachment(voiceMessage)) {
    formData.append('voice_message', voiceMessage.fileBuffer, {
      filename: voiceMessage.filename,
      contentType: voiceMessage.contentType ?? 'audio/mp4',
    });

    return;
  }

  formData.append('voice_message', voiceMessage as string | Buffer);
};
