import {
  PEOPLE_DATA_SOURCE_CATEGORIES,
  isPeopleDataSourceAlias,
} from '../people-data-source-aliases';

describe('people-data-source-aliases', () => {
  it('exposes public aliases without vendor branding in descriptions', () => {
    const aliases = PEOPLE_DATA_SOURCE_CATEGORIES.map((category) => category.alias);
    expect(aliases).toEqual([
      'index',
      'apollo',
      'pdl',
      'contactout',
      'harvest',
    ]);
    for (const category of PEOPLE_DATA_SOURCE_CATEGORIES) {
      expect(category.label.toLowerCase()).not.toContain('people data labs');
      expect(category.description.toLowerCase()).not.toContain('people data labs');
    }
    console.log('[people-data-source-aliases] categories', aliases);
  });

  it('validates alias membership', () => {
    expect(isPeopleDataSourceAlias('apollo')).toBe(true);
    expect(isPeopleDataSourceAlias('unknown')).toBe(false);
    console.log('[people-data-source-aliases] isPeopleDataSourceAlias(apollo)=true');
  });
});
