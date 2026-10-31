// One company, however its legal wrapper is spelled. "Jubilant Foodworks",
// "Jubilant FoodWorks Ltd." and "Jubilant FoodWorks Pvt. Ltd." name one firm,
// so they must cost one provider call and produce one ledger line.
//
// This key is deliberately conservative: it removes what the law adds to a
// name, never what tells two companies apart.

// Legal forms only. "Group", "Holdings", "Industries", "Bank" and country
// words can name a different company and stay part of the key. Dropping them
// is what merged "Bank of America" with "Bank of India" and "Tata Chemicals"
// with "Tata Industries" in the old site cleaner, which is a search heuristic,
// not an identity.
export const COMPANY_LEGAL_SUFFIXES: ReadonlySet<string> = new Set([
  'ab',
  'ag',
  'assoc',
  'association',
  'bhd',
  'bv',
  'co',
  'companies',
  'company',
  'corp',
  'corporation',
  'gmbh',
  'inc',
  'incorporated',
  'kg',
  'kk',
  'limited',
  'llc',
  'llp',
  'ltda',
  'ltd',
  'nv',
  'oy',
  'plc',
  'private',
  'pte',
  'pty',
  'pvt',
  'sa',
  'sas',
  'sdn',
  'se',
  'sl',
  'spa',
  'srl',
  'ulc',
]);

// Typographic apostrophes are deleted rather than spaced, so "Haldiram's" and
// "Haldirams" are one key. Spacing them produced "haldiram s" and missed.
const APOSTROPHES = /['\u0060\u00b4\u2018\u2019\u201b]/g;
const COMBINING_MARKS = /[\u0300-\u036f]/g;
// Letters and digits in any script: a name in Devanagari or CJK is still a
// name, and dropping it would leave an empty key.
const NON_TOKEN_CHARACTERS = /[^\p{L}\p{N}]+/u;

const toTokens = (companyName: string): string[] =>
  companyName
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .replace(APOSTROPHES, '')
    .replace(/&/g, ' and ')
    .toLowerCase()
    .split(NON_TOKEN_CHARACTERS)
    .filter((token) => token.length > 0);

// "Pvt Ltd" is one run at the end, never the last word alone: popping only
// "ltd" would leave "pvt" in the key of one company and not another.
const dropAffixes = (tokens: string[]): string[] => {
  const kept = [...tokens];

  while (kept.length > 1 && COMPANY_LEGAL_SUFFIXES.has(kept[kept.length - 1])) {
    kept.pop();
  }

  while (kept.length > 1 && kept[0] === 'the') {
    kept.shift();
  }

  return kept;
};

// The cache key, dedupe key and cross-source join for one company.
// Lowercase and punctuation-free, with a trailing legal form removed.
export const companyIdentityKey = (
  companyName: string | null | undefined,
): string => {
  if (typeof companyName !== 'string') {
    return '';
  }

  const tokens = toTokens(companyName);

  if (tokens.length === 0) {
    return '';
  }

  const kept = dropAffixes(tokens);

  // A name that reduces to a legal form or to "the" ("Pvt Ltd", "The Limited")
  // has nothing left that identifies it, so it keeps its words instead of
  // collapsing to "pvt".
  const hasNoIdentityLeft =
    kept.length === 1 &&
    (COMPANY_LEGAL_SUFFIXES.has(kept[0]) || kept[0] === 'the');

  return (hasNoIdentityLeft ? tokens : kept).join(' ');
};

export type CompanyCacheKeyInput = {
  name?: string | null;
  companyId?: string | null;
  linkedinUrl?: string | null;
};

const LINKEDIN_COMPANY_PATH = /linkedin\.com\/(?:mwlite\/)?company\/([^/?#]+)/i;

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const linkedinCompanySlug = (linkedinUrl?: string | null): string => {
  const match = LINKEDIN_COMPANY_PATH.exec((linkedinUrl ?? '').trim());

  if (!match?.[1]) {
    return '';
  }

  return safeDecode(match[1]).replace(/\/+$/, '').toLowerCase();
};

// A stable key for one company: the index id, then the LinkedIn company, then
// the name. Names are never unique, so the first two win whenever the resolver
// supplied them; the name key is what makes the first, pre-resolution lookup
// collapse two spellings of the same firm.
export const companyCacheKeyOf = (input: CompanyCacheKeyInput): string => {
  const companyId = (input.companyId ?? '').trim();

  if (companyId !== '') {
    return `company:${companyId}`;
  }

  const linkedinSlug = linkedinCompanySlug(input.linkedinUrl);

  if (linkedinSlug !== '') {
    return `linkedin:company:${linkedinSlug}`;
  }

  const nameKey = companyIdentityKey(input.name);

  return nameKey === '' ? '' : `name:${nameKey}`;
};
