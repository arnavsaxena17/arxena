const SMALL_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'but',
  'or',
  'for',
  'nor',
  'on',
  'at',
  'to',
  'from',
  'by',
  'of',
  'in',
  'with',
  'as',
  'into',
  'via',
  'per',
]);

/**
 * Known abbreviations: lowercase key -> display form.
 * Aligned with arxena-site abbreviations.py for job titles and common terms.
 * Acronyms (CEO, IBM) and special casing (iOS, iPhone).
 */
const ABBREVIATION_DISPLAY: Record<string, string> = {
  'ceo': 'CEO',
  cfo: 'CFO',
  cto: 'CTO',
  cio: 'CIO',
  coo: 'COO',
  cmo: 'CMO',
  chro: 'CHRO',
  cro: 'CRO',
  evp: 'EVP',
  sts: 'STS',
  ai: 'AI',
  ml: 'ML',
  ui: 'UI',
  ux: 'UX',
  crm: 'CRM',
  erp: 'ERP',
  api: 'API',
  ibm: 'IBM',
  'u.s.a': 'U.S.A.',
  ii:'II',
  iii:'III',
  iv:'IV',
  v:'V',
  vi:'VI',
  vii:'VII',
  viii:'VIII',
  ix:'IX',
  'u.s': 'U.S.',
  usa: 'USA',

  emea: 'EMEA',
  svp: 'SVP',
  vp: 'VP',
  avp: 'AVP',
  gm: 'GM',
  md: 'MD',
  hr: 'HR',
  it: 'IT',
  uk: 'UK',
  eu: 'EU',
  b2b: 'B2B',
  b2c: 'B2C',
  c2b: 'C2B',
  c2c: 'C2C',
  g2b: 'G2B',
  g2c: 'G2C',
  rnd: 'R&D',
  ltd: 'Ltd',
  pwc:'PwC',
  ios: 'iOS',
  iphone: 'iPhone',
  ipad: 'iPad',
  hcm: 'HCM',
  hdfc: 'HDFC',
  gss: 'GSS',
  us:'US',
  scm: 'SCM',
  hrms: 'HRMS',
  hrm: 'HRM',
  lms: 'LMS',
  gcp: 'GCP',
  aws: 'AWS',
  macos: 'macOS',
  seo: 'SEO',
  hrt:'HRT',
  pm: 'PM',
  qa: 'QA',
  qc: 'QC',
  mdg:'MDG',
  hrd:'HRD',
  hrta: 'HRTA',
  sf:'SF',
  sap: 'SAP',
  mba: 'MBA',
  phd: 'PhD',
  bsc: 'BSc',
  msc: 'MSc',
  fullcompany: 'Full Company',
  bankingassist: 'Banking Assist',
  financeassist: 'Finance Assist',
  operationsassist: 'Operations Assist',
  projectsassist: 'Projects Assist',
  salesassist: 'Sales Assist',
  tradingassist: 'Trading Assist',
};

/**
 * Splits a word into leading punctuation, core (alphanumeric), and trailing punctuation.
 * Used so "vp," looks up "vp" for abbreviation match while preserving "," in output.
 */
function getWordParts(word: string): {
  leading: string;
  core: string;
  trailing: string;
} {
  const leadingMatch = word.match(/^(\W*)/);
  const trailingMatch = word.match(/(\W*)$/);
  const leading = leadingMatch ? leadingMatch[1] : '';
  const trailing = trailingMatch ? trailingMatch[1] : '';
  const core = word.slice(leading.length, word.length - (trailing?.length ?? 0));
  return { leading, core, trailing };
}

/**
 * Returns true if the string appears to be masked/anonymized (e.g. xxx, xxxx xxx).
 * Such values should not be title-cased.
 */
export const isMaskedOrAnonymized = (
  str: string | null | undefined,
): boolean => {
  if (!str || typeof str !== 'string') return true;
  const normalized = str.replace(/\s+/g, '').toLowerCase();
  if (!normalized) return true;
  if (normalized === 'unknownlinkedinmember') return true;
  return /^x+$/u.test(normalized) || /^[xy]+$/u.test(normalized);
};

export type ToTitleCaseOptions = {
  /** When true, return str as-is if it appears masked/anonymized (xxx, etc.) */
  skipIfMasked?: boolean;
};

/**
 * Converts a string to title case. Capitalizes the first letter of each word,
 * except for small words (articles, conjunctions, short prepositions) which
 * stay lowercase unless they are the first or last word.
 * Known abbreviations (CEO, IBM, iOS) are rendered in their canonical form.
 *
 * Examples:
 * - "director of engineering" -> "Director of Engineering"
 * - "head of sales" -> "Head of Sales"
 * - "ceo" -> "CEO"
 * - "director of ios development" -> "Director of iOS Development"
 */
export const toTitleCase = (
  str: string | null | undefined,
  options?: ToTitleCaseOptions,
): string => {
  if (str == null || typeof str !== 'string') return '';
  const trimmed = str.trim();
  if (!trimmed) return '';

  if (options?.skipIfMasked && isMaskedOrAnonymized(trimmed)) {
    return trimmed;
  }

  const words = trimmed
    .toLowerCase()
    .split(/[\s_]+/)
    .filter(Boolean);
  return words
    .map((word, index) => {
      const { leading, core, trailing } = getWordParts(word);
      const coreLower = core.toLowerCase();
      const isFirst = index === 0;
      const isLast = index === words.length - 1;
      if (!isFirst && !isLast && SMALL_WORDS.has(coreLower)) {
        return word;
      }
      const canonical = ABBREVIATION_DISPLAY[coreLower];
      if (canonical) return leading + canonical + trailing;
      if (!core) return word;
      const titleCased =
        core.charAt(0).toUpperCase() + core.slice(1).toLowerCase();
      return leading + titleCased + trailing;
    })
    .join(' ');
};