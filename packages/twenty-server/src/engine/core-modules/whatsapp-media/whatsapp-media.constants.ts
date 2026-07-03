export const WHATSAPP_MEDIA_S3_FOLDER = 'whatsapp_media';

export const WHATSAPP_MEDIA_PUBLIC_PATH_PREFIX = '/whatsapp-media/';

export const WHATSAPP_MEDIA_TYPES = [
  'images',
  'videos',
  'docs',
  'audio',
] as const;

export type WhatsappMediaType = (typeof WHATSAPP_MEDIA_TYPES)[number];

export const WHATSAPP_MEDIA_TYPE_PATTERN =
  /^(images|videos|docs|audio)$/u;

export const WHATSAPP_MEDIA_FILENAME_PATTERN =
  /^[a-zA-Z0-9._-]+$/u;
