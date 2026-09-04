import type { OrgChartGradeTier } from './filterOrgChartNodeDataArray';

const GRADE_TIER_ORDER: OrgChartGradeTier[] = [
  'leadership',
  'managers',
  'executives',
];

export const computeOrgChartGradeBandYs = ({
  maxYByTier,
  layerStepPx,
}: {
  maxYByTier: Partial<Record<OrgChartGradeTier, number>>;
  layerStepPx: number;
}): Partial<Record<OrgChartGradeTier, number>> => {
  const bandYByTier: Partial<Record<OrgChartGradeTier, number>> = {};
  let previousBandY: number | null = null;

  for (const tier of GRADE_TIER_ORDER) {
    const maxY = maxYByTier[tier];
    if (maxY === undefined) {
      if (previousBandY !== null) {
        previousBandY += layerStepPx;
      }
      continue;
    }
    const minBandY =
      previousBandY === null ? maxY : previousBandY + layerStepPx;
    const bandY = Math.max(maxY, minBandY);
    bandYByTier[tier] = bandY;
    previousBandY = bandY;
  }

  return bandYByTier;
};
