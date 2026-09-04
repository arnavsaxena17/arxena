import { computeOrgChartGradeBandYs } from './computeOrgChartGradeBandYs';

describe('computeOrgChartGradeBandYs', () => {
  it('keeps deep managers as the managers band', () => {
    const bandYs = computeOrgChartGradeBandYs({
      layerStepPx: 100,
      maxYByTier: {
        leadership: 100,
        managers: 200,
        executives: 300,
      },
    });

    expect(bandYs).toEqual({
      leadership: 100,
      managers: 200,
      executives: 300,
    });
  });

  it('synthesizes bands when managers and executives are shallow', () => {
    const bandYs = computeOrgChartGradeBandYs({
      layerStepPx: 100,
      maxYByTier: {
        leadership: 100,
        managers: 100,
        executives: 100,
      },
    });

    expect(bandYs).toEqual({
      leadership: 100,
      managers: 200,
      executives: 300,
    });
  });

  it('skips missing middle tiers while preserving spacing', () => {
    const bandYs = computeOrgChartGradeBandYs({
      layerStepPx: 100,
      maxYByTier: {
        leadership: 100,
        executives: 100,
      },
    });

    expect(bandYs).toEqual({
      leadership: 100,
      executives: 300,
    });
  });
});
