const AVATAR_PUBLIC_PATH_PREFIX = '/avatars/';

export const extractDisplayPictureUrl = (
  candidate: Record<string, unknown>,
): string => {
  const dp = candidate.displayPicture ?? candidate.display_picture;
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

  const profilePictureUrl = candidate.profilePictureUrl;
  if (typeof profilePictureUrl === 'string') {
    return profilePictureUrl.trim();
  }

  const profilePictureUrlSnake = candidate.profile_picture_url;
  if (typeof profilePictureUrlSnake === 'string') {
    return profilePictureUrlSnake.trim();
  }

  const profilePictureUrlLarge = candidate.profile_picture_url_large;
  if (typeof profilePictureUrlLarge === 'string') {
    return profilePictureUrlLarge.trim();
  }

  const jobProcessEvents = candidate.job_process_events;
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

export const resolveAvatarUrlFromDisplayPictureUrl = (
  displayPictureUrl: string,
): string => {
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
