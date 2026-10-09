import { convertDollarsToBillingCredits } from 'src/engine/metadata-modules/ai/ai-billing/utils/convert-dollars-to-billing-credits.util';

describe('convertDollarsToBillingCredits', () => {
  it('should convert one dollar to one million micro-credits', () => {
    expect(convertDollarsToBillingCredits(1)).toBe(1_000_000);
  });

  it('should convert fractions of a cent without losing them', () => {
    expect(convertDollarsToBillingCredits(0.000_001)).toBeCloseTo(1, 6);
  });

  it('should convert zero to zero', () => {
    expect(convertDollarsToBillingCredits(0)).toBe(0);
  });

  it('should price a five-dollar monthly connection at five million micro-credits', () => {
    expect(convertDollarsToBillingCredits(5)).toBe(5_000_000);
  });
});
