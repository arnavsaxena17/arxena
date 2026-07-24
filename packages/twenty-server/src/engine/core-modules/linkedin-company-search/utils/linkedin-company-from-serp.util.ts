import type { BrightDataSerpOrganicEntry } from 'src/engine/core-modules/bright-data/types/bright-data-serp.types';

export function buildGoogleLinkedinCompanySearchUrl(input: {
  companyName: string;
  country: string;
}): string {
  const query = `${input.companyName} ${input.country} linkedin company`;
  const q = encodeURIComponent(query);

  return `https://www.google.com/search?q=${q}`;
}

export type LinkedinCompanyCandidate = {
  companyName: string;
  linkedinCompanyUrl: string;
  linkedinCompanySlug: string;
  sourceTitle?: string;
  rank?: number;
  score: number;
};

export type CompanyWebsiteCandidate = {
  websiteUrl: string;
  domain: string;
  companyName: string;
  sourceTitle?: string;
  rank?: number;
  score: number;
};

export function extractLinkedinCompanyCandidatesFromSerpOrganic(input: {
  organic: BrightDataSerpOrganicEntry[] | undefined | null;
  targetCompanyName: string;
}): LinkedinCompanyCandidate[] {
  if (!input.organic?.length) {
    return [];
  }

  const candidates: LinkedinCompanyCandidate[] = [];

  for (const entry of input.organic) {
    const link = entry.link?.trim() || entry.url?.trim();
    if (!link) {
      continue;
    }

    const parsedUrl = parseLinkedinCompanyUrl(link);
    if (!parsedUrl) {
      continue;
    }

    const companyNameFromResult = extractCompanyNameFromEntry(entry, parsedUrl.slug);
    const score = computeNameScore(input.targetCompanyName, companyNameFromResult);

    candidates.push({
      companyName: companyNameFromResult,
      linkedinCompanyUrl: parsedUrl.url,
      linkedinCompanySlug: parsedUrl.slug,
      sourceTitle: entry.title,
      rank: entry.rank,
      score,
    });
  }

  return dedupeCandidatesBySlug(candidates).sort((a, b) => b.score - a.score);
}

function parseLinkedinCompanyUrl(
  rawUrl: string,
): { slug: string; url: string } | null {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();

    if (host !== 'linkedin.com' && !host.endsWith('.linkedin.com')) {
      return null;
    }

    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0]?.toLowerCase() !== 'company' || !parts[1]) {
      return null;
    }

    const slug = parts[1].trim().toLowerCase();
    if (!slug) {
      return null;
    }

    return {
      slug,
      url: `https://www.linkedin.com/company/${slug}/`,
    };
  } catch {
    return null;
  }
}

function extractCompanyNameFromEntry(
  entry: BrightDataSerpOrganicEntry,
  fallbackSlug: string,
): string {
  const profileName = entry.profile?.name?.trim();
  if (profileName) {
    return profileName;
  }

  const title = (entry.title || '').trim();
  if (title) {
    const cleaned = title
      .replace(/\s*[\-|:|]\s*linkedin\s*$/i, '')
      .replace(/\s*\|\s*linkedin\s*$/i, '')
      .replace(/\s*-\s*linkedin\s*$/i, '')
      .trim();
    if (cleaned) {
      return cleaned;
    }
  }

  return fallbackSlug.replace(/-/g, ' ').trim();
}

function computeNameScore(targetNameRaw: string, candidateNameRaw: string): number {
  const target = normalizeName(targetNameRaw);
  const candidate = normalizeName(candidateNameRaw);

  if (!target || !candidate) {
    return 0;
  }

  if (target === candidate) {
    return 100;
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
}

function normalizeName(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(company|co|inc|incorporated|corp|corporation|ltd|limited|llc|plc|group|holdings)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeCandidatesBySlug(
  candidates: LinkedinCompanyCandidate[],
): LinkedinCompanyCandidate[] {
  const bySlug = new Map<string, LinkedinCompanyCandidate>();

  for (const candidate of candidates) {
    const existing = bySlug.get(candidate.linkedinCompanySlug);
    if (!existing || candidate.score > existing.score) {
      bySlug.set(candidate.linkedinCompanySlug, candidate);
    }
  }

  return [...bySlug.values()];
}

export function extractCompanyWebsiteCandidatesFromSerpOrganic(input: {
  organic: BrightDataSerpOrganicEntry[] | undefined | null;
  targetCompanyName: string;
}): CompanyWebsiteCandidate[] {
  if (!input.organic?.length) {
    return [];
  }

  const candidates: CompanyWebsiteCandidate[] = [];

  for (const entry of input.organic) {
    const link = entry.link?.trim() || entry.url?.trim();
    if (!link) {
      continue;
    }

    const parsed = parseCompanyWebsiteUrl(link);
    if (!parsed) {
      continue;
    }

    const companyNameFromResult = extractWebsiteNameFromEntry(entry, parsed.domain);
    const score = computeNameScore(input.targetCompanyName, companyNameFromResult);

    candidates.push({
      websiteUrl: parsed.url,
      domain: parsed.domain,
      companyName: companyNameFromResult,
      sourceTitle: entry.title,
      rank: entry.rank,
      score,
    });
  }

  return dedupeWebsiteCandidatesByDomain(candidates).sort((a, b) => b.score - a.score);
}

export function buildGoogleCompanyWebsiteSearchUrl(input: {
  companyName: string;
  country: string;
}): string {
  const query = `${input.companyName} ${input.country} official company website`;
  const q = encodeURIComponent(query);

  return `https://www.google.com/search?q=${q}`;
}

function parseCompanyWebsiteUrl(
  rawUrl: string,
): { url: string; domain: string } | null {
  try {
    const url = new URL(rawUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return null;
    }

    const domain = url.hostname.toLowerCase().replace(/^www\./, '');
    if (!domain || isBlockedWebsiteDomain(domain)) {
      return null;
    }

    return {
      url: `${url.protocol}//${url.hostname}${url.pathname || '/'}`.replace(/\/+$/, '/'),
      domain,
    };
  } catch {
    return null;
  }
}

function extractWebsiteNameFromEntry(
  entry: BrightDataSerpOrganicEntry,
  fallbackDomain: string,
): string {
  const profileName = entry.profile?.name?.trim();
  if (profileName) {
    return profileName;
  }

  const title = (entry.title || '').trim();
  if (title) {
    const cleaned = title
      .replace(/\s*[\-|:|]\s*official\s*site\s*$/i, '')
      .replace(/\s*[\-|:|]\s*official\s*website\s*$/i, '')
      .replace(/\s*[\-|:|]\s*home\s*$/i, '')
      .trim();
    if (cleaned) {
      return cleaned;
    }
  }

  return fallbackDomain.split('.')[0]?.replace(/-/g, ' ').trim() || fallbackDomain;
}

function dedupeWebsiteCandidatesByDomain(
  candidates: CompanyWebsiteCandidate[],
): CompanyWebsiteCandidate[] {
  const byDomain = new Map<string, CompanyWebsiteCandidate>();

  for (const candidate of candidates) {
    const existing = byDomain.get(candidate.domain);
    if (!existing || candidate.score > existing.score) {
      byDomain.set(candidate.domain, candidate);
    }
  }

  return [...byDomain.values()];
}

function isBlockedWebsiteDomain(domain: string): boolean {
  const blockedSuffixes = [
    'linkedin.com',
    'facebook.com',
    'instagram.com',
    'x.com',
    'twitter.com',
    'youtube.com',
    'wikipedia.org',
    'bloomberg.com',
    'crunchbase.com',
    'glassdoor.com',
    'indeed.com',
    'ambitionbox.com',
    'moneycontrol.com',
    'justdial.com',
    'zaubacorp.com',
  ];

  return blockedSuffixes.some(
    (suffix) => domain === suffix || domain.endsWith(`.${suffix}`),
  );
}
