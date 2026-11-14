import { isNonEmptyString } from '@sniptt/guards';

// Employers that differ only by a legal-entity suffix are the same employer:
// "Jubilant FoodWorks" and "Jubilant FoodWorks Ltd." are one company. Only
// entity suffixes are listed here — words such as "Group" or "Holdings" can
// name a different company and must stay part of the key.
const COMPANY_LEGAL_SUFFIXES = new Set([
  'ltd',
  'limited',
  'pvt',
  'private',
  'inc',
  'incorporated',
  'llc',
  'corp',
  'corporation',
  'co',
  'company',
  'plc',
  'llp',
  'gmbh',
  'ag',
  'sa',
  'sas',
  'bv',
  'nv',
  'pte',
  'sdn',
  'bhd',
  'srl',
  'spa',
  'oy',
  'ab',
  'kk',
  'kg',
  'ulc',
]);

const LINKEDIN_PROFILE_PATH = /linkedin\.com\/(?:mwlite\/)?in\/([^/?#]+)/i;

// LinkedIn's internal member ids (ACwAAA…, ACoAA…) show up in Google-indexed
// profile URLs next to the vanity slug (naveen-supplychain-strategy). Both
// resolve to one member, but the two strings never match, so the opaque form is
// kept as a key of its own instead of competing with vanity slugs. The shape is
// specific (A, C or D, w or o, A, then the id) so a vanity slug such as
// ACME-Corp is not mistaken for one.
const OPAQUE_LINKEDIN_ID = /^A[CD][wo]A[A-Za-z0-9_-]{4,}$/;

// A shared inbox is not one person's identity
const GENERIC_EMAIL_LOCAL_PARTS = new Set([
  'info',
  'contact',
  'sales',
  'hr',
  'careers',
  'admin',
  'support',
  'hello',
  'team',
  'office',
  'jobs',
  'recruiting',
  'recruitment',
  'enquiries',
  'inquiries',
]);

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

// Case, punctuation, apostrophes and accents must not decide identity:
// "Naveen  Srivastava", "naveen srivastava" and "NAVEEN SRIVASTAVA" are one
// person, and "Haldiram's" is "Haldirams".
const normalizeIdentityText = (value: string): string =>
  value
    .normalize('NFC')
    .replace(/[\u2018\u2019']/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

export const normalizePersonName = (name: string): string =>
  normalizeIdentityText(name);

export const normalizeCompanyName = (companyName: string): string => {
  const tokens = normalizeIdentityText(companyName.replace(/&/g, ' and '))
    .split(' ')
    .filter(Boolean);

  // "Pvt Ltd" is two suffixes; strip the whole run, never the last word alone
  while (
    tokens.length > 1 &&
    COMPANY_LEGAL_SUFFIXES.has(tokens[tokens.length - 1])
  ) {
    tokens.pop();
  }

  return tokens.join(' ');
};

const extractLinkedinSlug = (linkedinUrl: string): string => {
  const trimmed = linkedinUrl.trim();

  if (!trimmed) {
    return '';
  }

  const match = LINKEDIN_PROFILE_PATH.exec(trimmed);

  if (match?.[1]) {
    return safeDecode(match[1]).replace(/\/+$/, '').normalize('NFC');
  }

  // A bare slug (`naveen-supplychain-strategy`) is accepted, but not a URL on
  // another host and not a Sales Navigator lead link, whose token is scoped to
  // the search that produced it.
  if (
    /^(https?:)?\/\//.test(trimmed) ||
    /linkedin\.com\//i.test(trimmed) ||
    /^www\./i.test(trimmed)
  ) {
    return '';
  }

  return trimmed.replace(/^@/, '').replace(/\/+$/, '');
};

export const isOpaqueLinkedinId = (linkedinUrl: string): boolean =>
  OPAQUE_LINKEDIN_ID.test(extractLinkedinSlug(linkedinUrl));

// Two profile URLs decide identity only when both are present and of one kind:
// two vanity slugs, or two member ids. A member id (Harvest) and a vanity slug
// (Google) for one member never match as strings, so for that pair, as for a
// row without a URL, the name and the employer have to decide.
export const linkedinUrlsAreComparable = (
  first: string | undefined,
  second: string | undefined,
): boolean => {
  const firstSlug = extractLinkedinSlug(first ?? '');
  const secondSlug = extractLinkedinSlug(second ?? '');

  return (
    isNonEmptyString(firstSlug) &&
    isNonEmptyString(secondSlug) &&
    OPAQUE_LINKEDIN_ID.test(firstSlug) === OPAQUE_LINKEDIN_ID.test(secondSlug)
  );
};

// Every form of one profile URL reduces to one key: country subdomains, www,
// http/https, query strings, trailing slashes, percent-encoding and case.
export const normalizeLinkedinProfileKey = (linkedinUrl: string): string => {
  const slug = extractLinkedinSlug(linkedinUrl);

  if (!isNonEmptyString(slug)) {
    return '';
  }

  const normalized = slug.toLowerCase();

  return OPAQUE_LINKEDIN_ID.test(slug)
    ? `li:member:${normalized}`
    : `li:in:${normalized}`;
};

export type PersonIdentityInput = {
  name: string;
  companyName?: string;
  linkedinUrl?: string;
  email?: string;
};

// A person is matched on every key it has, strongest first. Two rows are the
// same person when they share any key, so a row found through a profile URL and
// the same row found through name + employer still collapse.
export const personIdentityKeys = (person: PersonIdentityInput): string[] => {
  const keys: string[] = [];
  const linkedinKey = normalizeLinkedinProfileKey(person.linkedinUrl ?? '');

  if (isNonEmptyString(linkedinKey)) {
    keys.push(linkedinKey);
  }

  const email = (person.email ?? '').trim().toLowerCase();
  const emailLocalPart = email.split('@')[0] ?? '';

  if (email.includes('@') && !GENERIC_EMAIL_LOCAL_PARTS.has(emailLocalPart)) {
    keys.push(`email:${email}`);
  }

  const name = normalizePersonName(person.name ?? '');
  const company = normalizeCompanyName(person.companyName ?? '');

  // An empty employer says nothing: two namesakes without one stay two people
  if (isNonEmptyString(name) && isNonEmptyString(company)) {
    keys.push(`name-company:${name}|${company}`);
  }

  return keys;
};

// The primary key is only used to derive a stable row id. It prefers the
// profile URL because that is what most rows already carry.
export const personIdentityKey = (person: PersonIdentityInput): string => {
  const keys = personIdentityKeys(person);

  if (keys.length > 0) {
    return keys[0];
  }

  return `name:${normalizePersonName(person.name ?? '')}|company:${normalizeCompanyName(
    person.companyName ?? '',
  )}`;
};
