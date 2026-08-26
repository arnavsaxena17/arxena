import {
  clampUnipileRelationsLimit,
  normalizeUnipileUserRelationsList,
  sortUnipileRelationsByRecentlyAdded,
  UNIPILE_RELATIONS_DEFAULT_LIMIT,
} from '../unipile-user-relations.util';

describe('clampUnipileRelationsLimit', () => {
  it('defaults when limit is missing or invalid', () => {
    expect(clampUnipileRelationsLimit()).toBe(UNIPILE_RELATIONS_DEFAULT_LIMIT);
    expect(clampUnipileRelationsLimit('abc')).toBe(
      UNIPILE_RELATIONS_DEFAULT_LIMIT,
    );
  });

  it('clamps to Unipile bounds', () => {
    expect(clampUnipileRelationsLimit(0)).toBe(1);
    expect(clampUnipileRelationsLimit(50)).toBe(50);
    expect(clampUnipileRelationsLimit(5000)).toBe(1000);
    expect(clampUnipileRelationsLimit('10')).toBe(10);
  });
});

describe('sortUnipileRelationsByRecentlyAdded', () => {
  it('orders by created_at descending so newest connections come first', () => {
    const sorted = sortUnipileRelationsByRecentlyAdded([
      { first_name: 'Old', created_at: 100 },
      { first_name: 'New', created_at: 300 },
      { first_name: 'Mid', created_at: 200 },
    ]);

    expect(sorted.map((item) => item.first_name)).toEqual(['New', 'Mid', 'Old']);
  });
});

describe('normalizeUnipileUserRelationsList', () => {
  it('sorts, slices to limit, and preserves a next-page cursor', () => {
    const result = normalizeUnipileUserRelationsList(
      {
        object: 'UserRelationsList',
        items: [
          { first_name: 'Old', created_at: 1 },
          { first_name: 'New', created_at: 3 },
          { first_name: 'Mid', created_at: 2 },
        ],
        cursor: 'next-page',
      },
      2,
    );

    expect(result).toEqual({
      object: 'UserRelationsList',
      items: [
        { first_name: 'New', created_at: 3 },
        { first_name: 'Mid', created_at: 2 },
      ],
      cursor: 'next-page',
    });
  });

  it('returns an empty list when Unipile payload is missing items', () => {
    expect(normalizeUnipileUserRelationsList(null)).toEqual({
      object: 'UserRelationsList',
      items: [],
      cursor: null,
    });
  });
});
