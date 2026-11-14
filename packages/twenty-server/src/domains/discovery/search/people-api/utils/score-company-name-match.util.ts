export const PEOPLE_COMPANY_DIRECT_MATCH_MIN_SCORE = 88;

const LEGAL_SUFFIX_PATTERN =
  /\b(company|co|inc|incorporated|corp|corporation|ltd|limited|llc|plc|group|holdings)\b/g;

export const normalizeCompanyNameForMatch = (value: string): string =>
  value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(LEGAL_SUFFIX_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const compactCompanyNameForMatch = (value: string): string =>
  normalizeCompanyNameForMatch(value).replace(/\s+/g, '');

export const scoreCompanyNameMatch = (
  targetName: string,
  candidateName: string,
  candidateSlug?: string | null,
): number => {
  const target = normalizeCompanyNameForMatch(targetName);
  const candidate = normalizeCompanyNameForMatch(candidateName);
  const targetCompact = compactCompanyNameForMatch(targetName);
  const candidateCompact = compactCompanyNameForMatch(candidateName);
  const slugCompact = compactCompanyNameForMatch(
    (candidateSlug ?? '').replace(/-/g, ' '),
  );

  if (!targetCompact) {
    return 0;
  }

  if (
    target === candidate ||
    targetCompact === candidateCompact ||
    (slugCompact.length > 0 && targetCompact === slugCompact)
  ) {
    return 100;
  }

  if (!candidate) {
    return slugCompact.length > 0 && targetCompact.includes(slugCompact)
      ? 60
      : 0;
  }

  const targetTokens = target.split(' ').filter(Boolean);
  const candidateTokens = candidate.split(' ').filter(Boolean);
  const targetSet = new Set(targetTokens);
  const candidateSet = new Set(candidateTokens);

  let overlap = 0;
  for (const token of targetSet) {
    if (candidateSet.has(token)) {
      overlap += 1;
    }
  }

  const union = new Set([...targetSet, ...candidateSet]).size || 1;
  const jaccard = overlap / union;
  const targetCoverage = overlap / (targetSet.size || 1);
  const candidateCoverage = overlap / (candidateSet.size || 1);

  let score = jaccard * 60 + targetCoverage * 25 + candidateCoverage * 15;
  if (candidate.includes(target) || target.includes(candidate)) {
    score += 12;
  }
  if (candidate.startsWith(target) || target.startsWith(candidate)) {
    score += 8;
  }

  return Math.min(100, Math.max(0, Number(score.toFixed(2))));
};

export const isDirectCompanyNameMatch = (
  targetName: string,
  candidateName: string,
  candidateSlug?: string | null,
): boolean =>
  scoreCompanyNameMatch(targetName, candidateName, candidateSlug) >=
  PEOPLE_COMPANY_DIRECT_MATCH_MIN_SCORE;
