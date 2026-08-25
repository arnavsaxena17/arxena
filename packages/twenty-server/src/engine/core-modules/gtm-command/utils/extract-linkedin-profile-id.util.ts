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

const extractLinkedinProfileIdFromString = (value: string): string => {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  const inMatch = LINKEDIN_IN_PATH.exec(trimmed);

  if (inMatch?.[1]) {
    return decodeURIComponent(inMatch[1]).replace(/\/+$/, '');
  }

  const salesMatch = LINKEDIN_SALES_LEAD_PATH.exec(trimmed);

  if (salesMatch?.[1]) {
    return decodeURIComponent(salesMatch[1]).replace(/\/+$/, '');
  }

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('www.') ||
    /^linkedin\.com\//i.test(trimmed)
  ) {
    return '';
  }

  return trimmed.replace(/^@/, '').replace(/\/+$/, '');
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
        return collectLinkedinIdentityCandidates(JSON.parse(trimmed), depth + 1);
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
