import { generateChartAggregateFilterKey } from '@/page-layout/widgets/graph/utils/generateChartAggregateFilterKey';

describe('generateChartAggregateFilterKey', () => {
  it('should generate key with all values provided', () => {
    const result = generateChartAggregateFilterKey(0, 100, true);

    expect(result).toBe('0-100-true-all-projects');
  });

  it('should generate key with negative values', () => {
    const result = generateChartAggregateFilterKey(-50, 50, false);

    expect(result).toBe('-50-50-false-all-projects');
  });

  it('should handle undefined values as empty strings', () => {
    const result = generateChartAggregateFilterKey(
      undefined,
      undefined,
      undefined,
    );

    expect(result).toBe('---all-projects');
  });

  it('should handle null values as empty strings', () => {
    const result = generateChartAggregateFilterKey(null, null, null);

    expect(result).toBe('---all-projects');
  });

  it('should handle mixed defined and undefined values', () => {
    const result = generateChartAggregateFilterKey(10, undefined, true);

    expect(result).toBe('10--true-all-projects');
  });

  it('should handle zero as valid value', () => {
    const result = generateChartAggregateFilterKey(0, 0, false);

    expect(result).toBe('0-0-false-all-projects');
  });

  it('should handle no arguments', () => {
    const result = generateChartAggregateFilterKey();

    expect(result).toBe('---all-projects');
  });

  it('should handle decimal values', () => {
    const result = generateChartAggregateFilterKey(10.5, 99.9, true);

    expect(result).toBe('10.5-99.9-true-all-projects');
  });

  it('should include gtm dashboard project scope key when provided', () => {
    const result = generateChartAggregateFilterKey(0, 100, true, 'project-123');

    expect(result).toBe('0-100-true-project-123');
  });
});
