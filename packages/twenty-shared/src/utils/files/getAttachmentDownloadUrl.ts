import { capitalize } from '@/utils/strings/capitalize';

// STANDARD_OBJECTS.attachment.fields.file.universalIdentifier
export const ATTACHMENT_FILE_FIELD_UNIVERSAL_IDENTIFIER =
  '20202020-15db-460e-8166-c7b5d87ad4be';

export const getAttachmentTargetFieldIdName = (
  nameSingular: string,
): string => {
  return `target${capitalize(nameSingular)}Id`;
};

export type AttachmentDownloadSource = {
  file?: Array<{ url?: string | null } | null> | null;
  fullPath?: string | null;
};

// Prefer FILES-field signed URL; fall back to deprecated fullPath for legacy rows
export const getAttachmentDownloadUrl = (
  attachment: AttachmentDownloadSource | null | undefined,
): string | null => {
  const fileUrl = attachment?.file?.[0]?.url;

  if (typeof fileUrl === 'string' && fileUrl.length > 0) {
    return fileUrl;
  }

  const fullPath = attachment?.fullPath;

  if (typeof fullPath === 'string' && fullPath.length > 0) {
    return fullPath;
  }

  return null;
};
