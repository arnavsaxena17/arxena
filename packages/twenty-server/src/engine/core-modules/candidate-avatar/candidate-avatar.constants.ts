export const AVATAR_S3_FOLDER = 'avatars';
export const AVATAR_META_FOLDER = 'avatars/meta';
export const AVATAR_FILENAME = 'avatar.webp';
export const AVATAR_PUBLIC_PATH_PREFIX = '/avatars/';
export const AVATAR_KEY_PATTERN = /^[a-f0-9]{64}$/u;

export const AVATAR_IMAGE_FIELD_NAMES = new Set([
  'profile_picture_url',
  'profile_picture_url_large',
  'profileImageUrl',
  'displayPicture',
  'display_picture',
  'photo',
  'pictureUrl',
  'picture_url',
  'picture',
  'image',
  'avatar',
]);

/** Hostnames allowed for upstream fetch during ingest. */
export const AVATAR_ALLOWED_IMAGE_HOSTS = new Set([
  'media.licdn.com',
  'media-exp1.licdn.com',
  'static.licdn.com',
  'st2.depositphotos.com',
  'images.contactout.com',
  'p.naukri.com',
  'media.apify.com',
]);

export const AVATAR_ALLOWED_IMAGE_HOST_SUFFIXES = ['.theorg.com', '.licdn.com'];
