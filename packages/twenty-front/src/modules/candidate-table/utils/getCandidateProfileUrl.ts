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

  const linkedin =
    readLinkUrl(record.linkedin) ||
    readLinkUrl(record.linkedinUrl) ||
    readLinkUrl(record.profileUrl);

  if (linkedin) {
    return linkedin;
  }

  return (
    readLinkUrl(record.resdexNaukriUrl) ||
    readLinkUrl(record.hiringNaukriUrl) ||
    ''
  );
};

export const isLinkedinProfileUrl = (url: string): boolean => {
  return /linkedin\.com\/in\//i.test(url);
};
