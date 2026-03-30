const isNonEmptyString = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;

/**
 * Build a canonical LinkedIn profile URL from a Unipile GET /accounts/:id response.
 * Prefers connection_params.im.publicIdentifier (same source as account filtering).
 */
export const extractLinkedinProfileUrlFromUnipileAccount = (
  account: unknown,
): string | null => {
  if (account == null || typeof account !== 'object') {
    return null;
  }
  const a = account as Record<string, unknown>;
  const conn = a.connection_params;
  const imRaw =
    conn && typeof conn === 'object'
      ? (conn as Record<string, unknown>).im
      : undefined;
  const im =
    imRaw && typeof imRaw === 'object'
      ? (imRaw as Record<string, unknown>)
      : null;

  const publicId =
    im && isNonEmptyString(im.publicIdentifier)
      ? im.publicIdentifier.trim()
      : null;

  if (publicId) {
    const slug = publicId.replace(/^\/+|\/+$/g, '');

    return `https://linkedin.com/in/${slug}`;
  }

  const imUsername =
    im && isNonEmptyString(im.username) ? im.username.trim() : '';

  if (imUsername.length > 1 && !imUsername.includes(' ')) {
    return `https://linkedin.com/in/${imUsername.replace(/^@/, '')}`;
  }

  const username = isNonEmptyString(a.username) ? a.username.trim() : '';

  if (username.includes('linkedin.com')) {
    return username.startsWith('http') ? username : `https://${username}`;
  }
  if (username.length > 1 && !username.includes(' ')) {
    return `https://linkedin.com/in/${username.replace(/^@/, '')}`;
  }

  const pd = a.profile_data;

  if (pd && typeof pd === 'object') {
    const p = pd as Record<string, unknown>;

    for (const key of [
      'publicProfileUrl',
      'profile_url',
      'public_profile_url',
    ] as const) {
      const v = p[key];

      if (isNonEmptyString(v)) {
        return v.trim();
      }
    }
  }

  return null;
};

/**
 * WhatsApp number from Unipile account (GET /accounts/:id or list item).
 */
export const extractWhatsappPhoneFromUnipileAccount = (
  account: unknown,
): string | null => {
  if (account == null || typeof account !== 'object') {
    return null;
  }
  const a = account as Record<string, unknown>;
  const conn = a.connection_params;
  const imRaw =
    conn && typeof conn === 'object'
      ? (conn as Record<string, unknown>).im
      : undefined;
  const im =
    imRaw && typeof imRaw === 'object'
      ? (imRaw as Record<string, unknown>)
      : null;

  if (im && isNonEmptyString(im.phone_number)) {
    return im.phone_number.trim();
  }
  if (isNonEmptyString(a.phone_number)) {
    return a.phone_number.trim();
  }

  return null;
};
