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
  'international',
  'intl',
]);

export const THEOFFICIALBOARD_SLUG_STATIC_OVERRIDES: Readonly<
  Record<string, string>
> = {};

export type TheOfficialBoardSlugOverrides = Readonly<Record<string, string>>;

export function normalizeTheOfficialBoardSlugInput(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseEnvSlugOverrides(): Record<string, string> {
  const raw = process.env.THEOFFICIALBOARD_SLUG_OVERRIDES_JSON;

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
        out[normalizeTheOfficialBoardSlugInput(key)] =
          normalizeTheOfficialBoardSlugInput(value);
      }
    }

    return out;
  } catch {
    return {};
  }
}

export function stripTrailingCorporateSlugSegments(slug: string): string {
  const normalized = normalizeTheOfficialBoardSlugInput(slug);
  const parts = normalized.split('-').filter(Boolean);

  while (parts.length > 1) {
    const last = parts[parts.length - 1];

    if (!CORPORATE_SLUG_SUFFIXES.has(last)) {
      break;
    }

    parts.pop();
  }

  return parts.join('-');
}

export function firstSegmentSlugCandidate(slug: string): string | null {
  const normalized = normalizeTheOfficialBoardSlugInput(slug);
  const parts = normalized.split('-').filter(Boolean);

  if (parts.length < 2 || parts[0].length < 3) {
    return null;
  }

  return parts[0];
}

function dedupeOrdered(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    out.push(value);
  }

  return out;
}

export function mergeTheOfficialBoardSlugOverrides(
  extra?: TheOfficialBoardSlugOverrides,
): Record<string, string> {
  return {
    ...THEOFFICIALBOARD_SLUG_STATIC_OVERRIDES,
    ...parseEnvSlugOverrides(),
    ...(extra ?? {}),
  };
}

export function generateTheOfficialBoardSlugCandidates(
  rawSlug: string,
  overrides?: TheOfficialBoardSlugOverrides,
): string[] {
  const normalized = normalizeTheOfficialBoardSlugInput(rawSlug);

  if (!normalized) {
    return [];
  }

  const merged = mergeTheOfficialBoardSlugOverrides(overrides);
  const mapped = merged[normalized];
  const stripped = stripTrailingCorporateSlugSegments(normalized);
  const firstSegment = firstSegmentSlugCandidate(normalized);

  return dedupeOrdered([
    normalized,
    ...(mapped && mapped !== normalized ? [mapped] : []),
    ...(stripped && stripped !== normalized ? [stripped] : []),
    ...(firstSegment &&
    firstSegment !== normalized &&
    firstSegment !== stripped &&
    firstSegment !== mapped
      ? [firstSegment]
      : []),
  ]);
}
