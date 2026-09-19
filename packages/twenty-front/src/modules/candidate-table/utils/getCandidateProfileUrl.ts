type LinkField = {
  primaryLinkUrl?: string;
};

const readLinkUrl = (value: unknown): string => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (value && typeof value === 'object' && 'primaryLinkUrl' in value) {
    const url = (value as LinkField).primaryLinkUrl;
    return typeof url === 'string' ? url.trim() : '';
  }
  return '';
};

export const getCandidateProfileUrl = (candidateData: unknown): string => {
  if (!candidateData || typeof candidateData !== 'object') {
    return '';
  }

  const record = candidateData as Record<string, unknown>;
  const people =
    record.people && typeof record.people === 'object'
      ? (record.people as Record<string, unknown>)
      : undefined;

  const linkedin =
    readLinkUrl(people?.linkedinLink) ||
    readLinkUrl(record.linkedin) ||
    readLinkUrl(record.profileUrl);

  if (linkedin) {
    return linkedin;
  }

  return (
    readLinkUrl(people?.resdexNaukriUrl) ||
    readLinkUrl(people?.hiringNaukriUrl) ||
    ''
  );
};

export const isLinkedinProfileUrl = (url: string): boolean => {
  return /linkedin\.com\/in\//i.test(url);
};
