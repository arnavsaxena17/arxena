import {
  costForRecordsUsd,
  planLudicrousPages,
  recordsAffordableForBudget,
} from 'src/engine/core-modules/bright-data/ludicrous/utils/bright-data-ludicrous-pricing.util';

describe('bright data ludicrous pricing util', () => {
  it('prices per returned record', () => {
    expect(costForRecordsUsd(1)).toBe(0.002);
    expect(costForRecordsUsd(1100)).toBe(2.2);
  });

  it('turns a budget into an affordable record count', () => {
    expect(recordsAffordableForBudget(0.5)).toBe(250);
    expect(recordsAffordableForBudget(10)).toBe(5000);
    expect(recordsAffordableForBudget(0.001)).toBe(0);
  });

  it('never plans past offset 1000', () => {
    const pages = planLudicrousPages({ records: 5000 });

    expect(pages).toHaveLength(11);
    expect(pages[10]).toEqual({ offset: 1000, limit: 100 });
    expect(planLudicrousPages({ records: 250, startOffset: 1000 })).toEqual([
      { offset: 1000, limit: 100 },
    ]);
  });
});
