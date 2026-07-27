import { type AttachmentWithFile } from '@/activities/files/utils/filterAttachmentsWithFile';
import { getAttachmentDownloadUrl } from 'twenty-shared/utils';

export const getAttachmentUrl = ({
  attachment,
}: {
  attachment: AttachmentWithFile;
}): string => {
  return (
    getAttachmentDownloadUrl({
      file: [attachment.file],
      fullPath: attachment.fullPath,
    }) ?? attachment.file.url
  );
};
