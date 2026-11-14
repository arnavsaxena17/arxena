const AVATAR_PUBLIC_PATH_PREFIX = '/avatars/';

export const extractDisplayPictureUrl = (
  draft: Record<string, unknown>,
): string => {
  const dp = draft.displayPicture ?? draft.display_picture;
  if (typeof dp === 'string') {
    return dp.trim();
  }
  if (
    dp &&
    typeof dp === 'object' &&
    typeof (dp as { primaryLinkUrl?: string }).primaryLinkUrl === 'string'
  ) {
    return (dp as { primaryLinkUrl: string }).primaryLinkUrl.trim();
  }

  const profilePictureUrl = draft.profilePictureUrl;
  if (typeof profilePictureUrl === 'string') {
    return profilePictureUrl.trim();
  }

  const profilePictureUrlSnake = draft.profile_picture_url;
  if (typeof profilePictureUrlSnake === 'string') {
    return profilePictureUrlSnake.trim();
  }

  const profilePictureUrlLarge = draft.profile_picture_url_large;
  if (typeof profilePictureUrlLarge === 'string') {
    return profilePictureUrlLarge.trim();
  }

  const jobProcessEvents = draft.job_process_events;
  if (Array.isArray(jobProcessEvents)) {
    const profilePictureEvent = jobProcessEvents.find(
      (event) =>
        event &&
        typeof event === 'object' &&
        (event as { type?: string }).type === 'profile_picture' &&
        typeof (event as { value?: string }).value === 'string',
    ) as { value: string } | undefined;
    if (profilePictureEvent?.value) {
      return profilePictureEvent.value.trim();
    }
  }

  return '';
};

// Optional Links / string fields may be missing on linkedin_search drafts —
// never throw; callers treat empty as "omit field".
export const readPrimaryLinkUrl = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as { primaryLinkUrl?: unknown }).primaryLinkUrl === 'string'
  ) {
    return (value as { primaryLinkUrl: string }).primaryLinkUrl;
  }

  return undefined;
};

export const resolveAvatarUrlFromDisplayPictureUrl = (
  displayPictureUrl: string | null | undefined,
): string => {
  if (typeof displayPictureUrl !== 'string') {
    return '';
  }

  const trimmed = displayPictureUrl.trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  if (trimmed.startsWith(AVATAR_PUBLIC_PATH_PREFIX)) {
    const baseUrl = (
      process.env.SERVER_BASE_URL ||
      process.env.SERVER_URL ||
      'http://localhost:3000'
    ).replace(/\/$/, '');
    return `${baseUrl}${trimmed}`;
  }

  return trimmed;
};

export const toCrmPrimaryLink = (
  url: string | null | undefined,
  label = '',
): { primaryLinkLabel: string; primaryLinkUrl: string } | undefined => {
  const absolute = resolveAvatarUrlFromDisplayPictureUrl(url);

  if (!absolute.startsWith('http://') && !absolute.startsWith('https://')) {
    return undefined;
  }

  return {
    primaryLinkLabel: label || absolute,
    primaryLinkUrl: absolute,
  };
};
