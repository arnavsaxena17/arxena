import {
  estimateRunCostUsd,
  getAiColumnAutoRunMaxUsd,
  needsCostApproval,
} from 'src/engine/core-modules/outreach-command/utils/ai-column-cost-limit.util';

describe('getAiColumnAutoRunMaxUsd', () => {
  it('should default to $5', () => {
    expect(getAiColumnAutoRunMaxUsd({})).toBe(5);
  });

  it('should read the env, including 0 for always ask', () => {
    expect(
      getAiColumnAutoRunMaxUsd({ AI_COLUMN_AUTO_RUN_MAX_USD: '12.5' }),
    ).toBe(12.5);
    expect(getAiColumnAutoRunMaxUsd({ AI_COLUMN_AUTO_RUN_MAX_USD: '0' })).toBe(
      0,
    );
  });

  it.each(['', 'lots', '-3'])('should ignore %j', (raw) => {
    expect(getAiColumnAutoRunMaxUsd({ AI_COLUMN_AUTO_RUN_MAX_USD: raw })).toBe(
      5,
    );
  });
});

describe('estimateRunCostUsd', () => {
  it('should limit the estimate to the rows a limited run touches', () => {
    expect(
      estimateRunCostUsd({
        estimatedRunCostUsd: 40,
        estimatedPerRowUsd: 0.02,
        rowLimit: 100,
      }),
    ).toBe(2);
  });

  it('should keep the full estimate without a row limit', () => {
    expect(
      estimateRunCostUsd({ estimatedRunCostUsd: 40, estimatedPerRowUsd: 0.02 }),
    ).toBe(40);
  });

  it('should have no estimate when the engine reports no cost', () => {
    expect(
      estimateRunCostUsd({
        estimatedRunCostUsd: null,
        estimatedPerRowUsd: null,
      }),
    ).toBeNull();
  });
});

describe('needsCostApproval', () => {
  const limitUsd = 5;

  it('should not ask for a run under the limit', () => {
    expect(needsCostApproval({ estimatedCostUsd: 2.2, limitUsd })).toBe(false);
  });

  it('should not ask when the engine reports no cost', () => {
    expect(needsCostApproval({ estimatedCostUsd: null, limitUsd })).toBe(false);
  });

  it('should ask for a run over the limit', () => {
    expect(needsCostApproval({ estimatedCostUsd: 32.8, limitUsd })).toBe(true);
  });

  it('should accept an approval that covers the estimate', () => {
    expect(
      needsCostApproval({
        estimatedCostUsd: 32.8,
        approvedCostUsd: 35,
        limitUsd,
      }),
    ).toBe(false);
  });

  it('should ask again when the approval is lower than the estimate', () => {
    expect(
      needsCostApproval({
        estimatedCostUsd: 32.8,
        approvedCostUsd: 12,
        limitUsd,
      }),
    ).toBe(true);
  });
});
