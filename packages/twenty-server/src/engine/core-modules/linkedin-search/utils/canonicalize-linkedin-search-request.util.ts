import { companyIdentityKey } from 'twenty-shared/arx';

import { type LinkedInSearchRequest } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-request.type';

// Fields whose strings name a company. `company` also appears inside the
// filters that scope a search by employer (posted by, mentioning, author) and
// as an include/exclude pair on Sales Navigator, so the whole subtree under
// these keys is company text.
const COMPANY_FIELDS = new Set(['company', 'past_company']);

// An id or a URL is already one stable value: normalising it would rewrite
// "c_123-abc" into words and split one company into two keys.
const IDENTIFIER_FIELDS = new Set([
  'id',
  'url',
  'profile_url',
  'public_identifier',
  'saved_search_id',
  'recent_search_id',
]);

const URL_LIKE = /^(?:https?:)?\/\//i;
const LINKEDIN_URL_LIKE = /linkedin\.com\//i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const canonicalizeCompanyText = (value: string): string => {
  const trimmed = value.trim();

  if (trimmed === '') {
    return value;
  }

  if (URL_LIKE.test(trimmed) || LINKEDIN_URL_LIKE.test(trimmed)) {
    return value;
  }

  const key = companyIdentityKey(trimmed);

  return key === '' ? value : key;
};

const canonicalizeNode = (
  node: unknown,
  insideCompanyField: boolean,
): unknown => {
  if (typeof node === 'string') {
    return insideCompanyField ? canonicalizeCompanyText(node) : node;
  }

  if (Array.isArray(node)) {
    return node.map((item) => canonicalizeNode(item, insideCompanyField));
  }

  if (!isRecord(node)) {
    return node;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(node)) {
    const isIdentifier = insideCompanyField && IDENTIFIER_FIELDS.has(key);

    result[key] = canonicalizeNode(
      value,
      isIdentifier ? false : insideCompanyField || COMPANY_FIELDS.has(key),
    );
  }

  return result;
};

// The projection a search is cached under. The request is still sent as it was
// written; only the key is canonical, so "Jubilant FoodWorks Ltd." and
// "Jubilant Foodworks" cost one Unipile search instead of two.
export const canonicalizeLinkedInSearchRequest = (
  request: LinkedInSearchRequest,
): LinkedInSearchRequest =>
  canonicalizeNode(request, false) as LinkedInSearchRequest;
