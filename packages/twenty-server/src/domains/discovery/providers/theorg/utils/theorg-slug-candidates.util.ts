/**
 * LinkedIn / internal company ids often look like `acme-ltd` while TheOrg uses
 * shorter slugs (e.g. `acme`). These helpers build ordered candidate slugs to try.
 */

/** Trailing hyphenated segments commonly stripped from company ids but not part of TheOrg slugs. */
const CORPORATE_SLUG_SUFFIXES = new Set([
  'ltd',
  'limited',
  'inc',
  'incorporated',
  'corp',
  'corporation',
  'plc',
  'nv',
  'sa',
  'ag',
  'oy',
  'ab',
  'gmbh',
  'pte',
  'pty',
  'llp',
  'lp',
  'llc',
  'co',
  'company',
  'group',
  'holdings',
  'holding',
  'intl',
  'international',
]);

/**
 * Built-in overrides when automatic stripping does not match TheOrg.
 * Prefer env `THEORG_SLUG_OVERRIDES_JSON` for deployment-specific entries.
 * Example: `{ "linkedin-style-id": "theorg-slug" }` — e.g. when stripping
 * segments is wrong for a particular company.
 */
export const THEORG_SLUG_STATIC_OVERRIDES: Readonly<Record<string, string>> = {
  // 'eureka-forbes-ltd': 'eureka-forbes-limited',
};

export type TheOrgSlugOverrides = Readonly<Record<string, string>>;

function parseEnvSlugOverrides(): Record<string, string> {
  const raw = process.env.THEORG_SLUG_OVERRIDES_JSON;
  if (!raw?.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof key === 'string' && typeof value === 'string' && key && value) {
        out[normalizeTheOrgSlugInput(key)] = value.trim().toLowerCase();
      }
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Normalizes a raw id for comparison and candidate generation: trim, lowercase,
 * underscores → hyphens, collapse repeated hyphens.
 */
export function normalizeTheOrgSlugInput(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** True when the normalized slug is a key in {@link THEORG_SLUG_STATIC_OVERRIDES} (not env JSON). */
export function hasStaticTheOrgSlugOverride(rawSlug: string): boolean {
  const normalized = normalizeTheOrgSlugInput(rawSlug);
  if (!normalized) {
    return false;
  }
  return Object.prototype.hasOwnProperty.call(THEORG_SLUG_STATIC_OVERRIDES, normalized);
}

/**
 * Removes trailing hyphenated corporate/legal suffix segments, e.g.
 * `batliboi-ltd` → `batliboi`, `acme-holdings-limited` → `acme`.
 */
export function stripTrailingCorporateSlugSegments(slug: string): string {
  const normalized = normalizeTheOrgSlugInput(slug);
  const parts = normalized.split('-').filter((p) => p.length > 0);
  while (parts.length > 1) {
    const last = parts[parts.length - 1].toLowerCase();
    if (CORPORATE_SLUG_SUFFIXES.has(last)) {
      parts.pop();
    } else {
      break;
    }
  }
  return parts.join('-');
}

/**
 * For multi-segment slugs, the first segment alone sometimes matches TheOrg
 * (`batliboi-ltd` → `batliboi`). Skips very short first segments to avoid
 * mangling names like `h-m`.
 */
export function firstSegmentSlugCandidate(slug: string): string | null {
  const normalized = normalizeTheOrgSlugInput(slug);
  const parts = normalized.split('-').filter((p) => p.length > 0);
  if (parts.length < 2) {
    return null;
  }
  const first = parts[0];
  if (first.length < 3) {
    return null;
  }
  return first;
}

function dedupeOrdered(slugs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of slugs) {
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/**
 * Merges static map, env JSON, and optional runtime overrides (runtime wins on duplicate keys).
 */
export function mergeTheOrgSlugOverrides(
  extra?: TheOrgSlugOverrides,
): Record<string, string> {
  return {
    ...THEORG_SLUG_STATIC_OVERRIDES,
    ...parseEnvSlugOverrides(),
    ...(extra ?? {}),
  };
}

/**
 * Ordered list of TheOrg slug candidates to try for a given internal/LinkedIn-style id.
 * Order: exact → mapped target → stripped corporate suffixes → first-segment heuristic.
 */
export function generateTheOrgSlugCandidates(
  rawSlug: string,
  overrides?: TheOrgSlugOverrides,
): string[] {
  const normalized = normalizeTheOrgSlugInput(rawSlug);
  if (!normalized) {
    return [];
  }

  const merged = mergeTheOrgSlugOverrides(overrides);
  const mapped = merged[normalized];
  const stripped = stripTrailingCorporateSlugSegments(normalized);
  const firstSeg = firstSegmentSlugCandidate(normalized);

  return dedupeOrdered([
    normalized,
    ...(mapped && mapped !== normalized ? [mapped] : []),
    ...(stripped !== normalized ? [stripped] : []),
    ...(firstSeg &&
    firstSeg !== normalized &&
    firstSeg !== stripped &&
    firstSeg !== mapped
      ? [firstSeg]
      : []),
  ]);
}

/**
 * Extracts the LinkedIn company vanity slug (or numeric id) from a company URL,
 * e.g. `https://www.linkedin.com/company/batliboi-ltd` → `batliboi-ltd`.
 */
export function parseLinkedInCompanySlugFromUrl(
  rawUrl: string | null | undefined,
): string | null {
  if (!rawUrl?.trim()) {
    return null;
  }

  try {
    const u = new URL(rawUrl.trim());
    if (!u.hostname.toLowerCase().endsWith('linkedin.com')) {
      return null;
    }
    const path = u.pathname.replace(/^\/+|\/+$/g, '');
    const match = path.match(/^company\/([^/?#]+)/i);
    if (!match?.[1]) {
      return null;
    }
    return normalizeTheOrgSlugInput(match[1]);
  } catch {
    return null;
  }
}
