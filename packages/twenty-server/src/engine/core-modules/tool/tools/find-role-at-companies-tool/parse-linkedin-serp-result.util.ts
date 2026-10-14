export type ParsedLinkedinSerpPerson = {
  name: string;
  title: string;
  companyName: string;
  linkedinUrl: string;
  snippet: string;
};

const LINKEDIN_SUFFIX = /\s*[|\-–—]\s*linkedin\s*$/i;
const PART_SEPARATOR = /\s+[-–—]\s+/;

export const isLinkedinProfileUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);

    return (
      /(^|\.)linkedin\.com$/i.test(parsed.hostname) &&
      /^\/in\/[^/]+/.test(parsed.pathname)
    );
  } catch {
    return false;
  }
};

// A post URL carries its author's profile id before the first underscore:
// linkedin.com/posts/smita-jatia_ai-technology-... was written by /in/smita-jatia.
// Some people only appear in Google as a post, so this recovers their profile.
export const linkedinProfileUrlFromPostUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url);

    if (!/(^|\.)linkedin\.com$/i.test(parsed.hostname)) {
      return null;
    }

    const [, section, slug] = parsed.pathname.split('/');
    const profileId = slug?.split('_')[0] ?? '';

    return section === 'posts' && profileId !== ''
      ? `https://www.linkedin.com/in/${profileId}`
      : null;
  } catch {
    return null;
  }
};

export const normalizeLinkedinProfileUrl = (url: string): string => {
  try {
    const parsed = new URL(url);

    return `https://www.linkedin.com${parsed.pathname.replace(/\/+$/, '')}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
};

// LinkedIn result titles read "Name - Title - Company | LinkedIn", sometimes
// "Name - Title at Company" or just "Name - Company". Company can be empty.
export const parseLinkedinSerpResult = (entry: {
  title: string;
  url: string;
  snippet?: string;
}): ParsedLinkedinSerpPerson | null => {
  if (!isLinkedinProfileUrl(entry.url)) {
    return null;
  }

  const parts = entry.title
    .replace(LINKEDIN_SUFFIX, '')
    .split(PART_SEPARATOR)
    .map((part) => part.trim())
    .filter((part) => part !== '');

  if (parts.length === 0) {
    return null;
  }

  const [name, ...rest] = parts;
  let title = '';
  let companyName = '';

  if (rest.length >= 2) {
    title = rest[0];
    companyName = rest.slice(1).join(' - ');
  } else if (rest.length === 1) {
    const atMatch = /^(.*?)\s+(?:at|@)\s+(.+)$/i.exec(rest[0]);

    if (atMatch !== null) {
      title = atMatch[1];
      companyName = atMatch[2];
    } else {
      title = rest[0];
    }
  }

  const atInTitle = /^(.*?)\s+(?:at|@)\s+(.+)$/i.exec(title);

  if (companyName === '' && atInTitle !== null) {
    title = atInTitle[1];
    companyName = atInTitle[2];
  }

  return {
    name,
    title,
    companyName,
    linkedinUrl: entry.url,
    snippet: entry.snippet ?? '',
  };
};
