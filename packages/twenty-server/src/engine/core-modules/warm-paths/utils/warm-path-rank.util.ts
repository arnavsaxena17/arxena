import type { WarmPathRelevance } from '../warm-paths.types';

const HR_KEYWORDS = [
  'hr',
  'human resources',
  'people',
  'talent',
  'recruit',
  'michael page',
  'pagegroup',
];

const scoreHeadlineProminence = (
  headline: string | null,
  targetHeadline: string | null,
  targetCompany: string | null,
): WarmPathRelevance => {
  const h = (headline ?? '').toLowerCase();
  const reasons: string[] = [];
  let score = 0;

  if (targetCompany && h.includes(targetCompany.toLowerCase())) {
    score += 50;
    reasons.push(`Same company (${targetCompany})`);
  }

  for (const keyword of HR_KEYWORDS) {
    if (h.includes(keyword)) {
      score += 25;
      reasons.push('HR / talent circle');
      break;
    }
  }

  if (targetHeadline) {
    const targetTokens = targetHeadline.toLowerCase().split(/\W+/).filter((t) => t.length > 3);
    const overlap = targetTokens.filter((t) => h.includes(t));
    if (overlap.length >= 2) {
      score += 15;
      reasons.push('Similar role / industry');
    }
  }

  if (h.includes('director') || h.includes('vp') || h.includes('head of') || h.includes('chief')) {
    score += 10;
    reasons.push('Senior role');
  }

  if (reasons.length === 0) {
    reasons.push('Shared connection to target');
  }

  return { score, reasons };
};

export const scoreBridgeRelevance = (
  headline: string | null,
  targetHeadline: string | null,
  targetCompany: string | null,
  sharedWithViewer: number | null,
): WarmPathRelevance => {
  const base = scoreHeadlineProminence(headline, targetHeadline, targetCompany);
  const shared = sharedWithViewer ?? 0;
  return {
    score: base.score + Math.min(shared, 60),
    reasons: base.reasons,
  };
};

export const sharedOverlapStrength = (
  count: number | null,
): 'very_high' | 'high' | 'moderate' | 'low' => {
  const n = count ?? 0;
  if (n >= 30) return 'very_high';
  if (n >= 10) return 'high';
  if (n >= 3) return 'moderate';
  return 'low';
};

export const clusterLabelFromHeadline = (headline: string | null): string | null => {
  const h = (headline ?? '').toLowerCase();
  if (h.includes('michael page') || h.includes('pagegroup')) {
    return 'Michael Page · talent / HR';
  }
  if (h.includes('hr') || h.includes('human resources') || h.includes('people')) {
    return 'HR / people leadership';
  }
  if (h.includes('consultant')) {
    return 'Consulting network';
  }
  return null;
};
