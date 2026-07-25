// LinkedIn URLs are stored without www; display uses www.linkedin.com

export const normalizeLinkedInUrl = (url: string): string => {
  if (!url) {
    return '';
  }

  return url.replace(/(?:www\.)+linkedin\.com/gi, 'linkedin.com');
};

const WWW_LINKEDIN_HOST_PLACEHOLDER = '__ARXENA_WWW_LINKEDIN_COM__';

// Collapse www chains first, then prepend exactly one www (no lookbehind — Safari < 16.4)
export const reconstructLinkedInUrlForDisplay = (url: string): string => {
  if (!url) {
    return '';
  }

  return url
    .replace(/(?:www\.)+linkedin\.com/gi, WWW_LINKEDIN_HOST_PLACEHOLDER)
    .replace(/linkedin\.com/gi, 'www.linkedin.com')
    .split(WWW_LINKEDIN_HOST_PLACEHOLDER)
    .join('www.linkedin.com');
};

export const isLinkedInUrl = (url: string): boolean => {
  if (!url) {
    return false;
  }

  return url.includes('linkedin.com');
};
