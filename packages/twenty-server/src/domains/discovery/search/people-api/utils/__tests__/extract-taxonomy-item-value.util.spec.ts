import {
  extractTaxonomyItemValue,
  usablePeopleTaxonomyLabel,
} from '../extract-taxonomy-item-value.util';

describe('extractTaxonomyItemValue', () => {
  it('returns name when present', () => {
    const value = extractTaxonomyItemValue({
      id: 'engineering',
      label: 'engineering',
      name: 'engineering',
      parent_id: 'technology',
      level: 2,
    });
    expect(value).toBe('engineering');
    console.log('[extractTaxonomyItemValue] name', value);
  });

  it('returns null for empty item', () => {
    expect(extractTaxonomyItemValue(null)).toBeNull();
    console.log('[extractTaxonomyItemValue] null item');
  });
});

describe('usablePeopleTaxonomyLabel', () => {
  it('drops unclassified and blank labels', () => {
    expect(usablePeopleTaxonomyLabel('unclassified')).toBeUndefined();
    expect(usablePeopleTaxonomyLabel('  ')).toBeUndefined();
    expect(usablePeopleTaxonomyLabel('engineering')).toBe('engineering');
  });
});
