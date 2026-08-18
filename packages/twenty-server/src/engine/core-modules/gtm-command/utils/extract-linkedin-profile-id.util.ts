const LINKEDIN_IN_PATH = /linkedin\.com\/in\/([^/?#]+)/i;

export const extractLinkedinProfileId = (
  value: string | null | undefined,
): string => {
  if (!value) {
    return '';
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  const match = LINKEDIN_IN_PATH.exec(trimmed);

  if (match?.[1]) {
    return decodeURIComponent(match[1]).replace(/\/+$/, '');
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return '';
  }

  return trimmed.replace(/^@/, '').replace(/\/+$/, '');
};
