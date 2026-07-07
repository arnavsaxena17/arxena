import { extractTaxonomyItemValue } from '../extract-taxonomy-item-value.util';

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
