const LINKEDIN_IN_PATH = /linkedin\.com\/(?:mwlite\/)?in\/([^/?#]+)/i;
const LINKEDIN_SALES_LEAD_PATH =
  /linkedin\.com\/sales\/(?:lead|people)\/([^/,?#]+)/i;

const LINKEDIN_OBJECT_KEYS = [
  'linkedinProfileId',
  'public_identifier',
  'primaryLinkUrl',
  'linkedinLink',
  'linkedinUrl',
  'profileUrl',
] as const;

const safeDecodeUriComponent = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

// Decode percent-encoding and NFC so %D9%90%D9%90amz and ِِamz compare equal
const canonicalizeLinkedinIdentitySegment = (value: string): string =>
  safeDecodeUriComponent(value).replace(/\/+$/, '').normalize('NFC');

const extractLinkedinProfileIdFromString = (value: string): string => {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  const inMatch = LINKEDIN_IN_PATH.exec(trimmed);

  if (inMatch?.[1]) {
    return canonicalizeLinkedinIdentitySegment(inMatch[1]);
  }

  const salesMatch = LINKEDIN_SALES_LEAD_PATH.exec(trimmed);

  if (salesMatch?.[1]) {
    return canonicalizeLinkedinIdentitySegment(salesMatch[1]);
  }

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('www.') ||
    /^linkedin\.com\//i.test(trimmed)
  ) {
    return '';
  }

  return canonicalizeLinkedinIdentitySegment(trimmed.replace(/^@/, ''));
};

// Store / match as https://linkedin.com/in/{decoded NFC slug} (never percent-encoded)
export const canonicalizeLinkedinProfileUrl = (
  url: string | null | undefined,
): string => {
  const trimmed = url?.trim() ?? '';

  if (!trimmed) {
    return '';
  }

  const slug = extractLinkedinProfileIdFromString(trimmed);

  if (!slug) {
    return trimmed
      .replace(/www\.linkedin\.com/i, 'linkedin.com')
      .replace(/^http:\/\//i, 'https://');
  }

  return `https://linkedin.com/in/${slug}`;
};

const collectLinkedinIdentityCandidates = (
  value: unknown,
  depth = 0,
): string[] => {
  if (depth > 4 || value == null) {
    return [];
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!trimmed) {
      return [];
    }

    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        return collectLinkedinIdentityCandidates(
          JSON.parse(trimmed),
          depth + 1,
        );
      } catch {
        return [trimmed];
      }
    }

    return [trimmed];
  }

  if (typeof value !== 'object') {
    return [];
  }

  const record = value as Record<string, unknown>;
  const candidates: string[] = [];

  for (const key of LINKEDIN_OBJECT_KEYS) {
    if (key in record) {
      candidates.push(
        ...collectLinkedinIdentityCandidates(record[key], depth + 1),
      );
    }
  }

  return candidates;
};

export const extractLinkedinProfileId = (value: unknown): string => {
  for (const candidate of collectLinkedinIdentityCandidates(value)) {
    const extracted = extractLinkedinProfileIdFromString(candidate);

    if (extracted) {
      return extracted;
    }
  }

  return '';
};
