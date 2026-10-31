import { companyCacheKeyOf, companyIdentityKey } from '../companyName';

describe('companyIdentityKey', () => {
  it('collapses the legal forms of one company', () => {
    const key = companyIdentityKey('Jubilant Foodworks');

    expect(companyIdentityKey('Jubilant FoodWorks Ltd.')).toBe(key);
    expect(companyIdentityKey('Jubilant FoodWorks Limited')).toBe(key);
    expect(companyIdentityKey('Jubilant FoodWorks Pvt. Ltd.')).toBe(key);
    expect(companyIdentityKey('JUBILANT FOODWORKS PRIVATE LIMITED')).toBe(key);
  });

  it('ignores case, punctuation, accents and apostrophes', () => {
    expect(companyIdentityKey('Société Générale')).toBe(
      companyIdentityKey('Societe Generale'),
    );
    expect(companyIdentityKey("Haldiram's")).toBe(
      companyIdentityKey('Haldirams'),
    );
    expect(companyIdentityKey('Coca-Cola India')).toBe(
      companyIdentityKey('Coca Cola India'),
    );
    expect(companyIdentityKey('Larsen & Toubro')).toBe(
      companyIdentityKey('Larsen and Toubro'),
    );
  });

  it('keeps words that can name a different company', () => {
    // These are the collisions the old site cleaner produced.
    expect(companyIdentityKey('Bank of America')).not.toBe(
      companyIdentityKey('Bank of India'),
    );
    expect(companyIdentityKey('Tata Chemicals')).not.toBe(
      companyIdentityKey('Tata Industries'),
    );
    expect(companyIdentityKey('Jubilant FoodWorks')).not.toBe(
      companyIdentityKey('Jubilant FoodWorks Group'),
    );
    expect(companyIdentityKey('Jubilant FoodWorks')).not.toBe(
      companyIdentityKey('Jubilant FoodWorks Holdings'),
    );
    expect(companyIdentityKey('Acme')).not.toBe(
      companyIdentityKey('Acme Robotics'),
    );
  });

  it('drops the whole trailing legal-suffix run, not just the last word', () => {
    expect(companyIdentityKey('Acme Foods Pvt. Ltd.')).toBe('acme foods');
    expect(companyIdentityKey('Acme Foods Private Limited')).toBe('acme foods');
  });

  it('keeps the words when the name is only a legal form', () => {
    expect(companyIdentityKey('Pvt Ltd')).toBe('pvt ltd');
    expect(companyIdentityKey('Limited')).toBe('limited');
    // "The Limited" is a brand, not an article plus a suffix
    expect(companyIdentityKey('The Limited')).toBe('the limited');
  });

  it('keeps names written in other scripts', () => {
    expect(companyIdentityKey('塔塔钢铁有限公司')).not.toBe('');
    expect(companyIdentityKey('टाटा स्टील')).not.toBe('');
  });

  it('drops a leading "the" only when a name remains', () => {
    expect(companyIdentityKey('The Boston Consulting Group')).toBe(
      'boston consulting group',
    );
    expect(companyIdentityKey('The')).toBe('the');
  });

  it('returns an empty key for an empty or non-string name', () => {
    expect(companyIdentityKey('')).toBe('');
    expect(companyIdentityKey('   ')).toBe('');
    expect(companyIdentityKey(null)).toBe('');
    expect(companyIdentityKey(undefined)).toBe('');
  });
});

describe('companyCacheKeyOf', () => {
  it('prefers the index id over every name spelling', () => {
    expect(
      companyCacheKeyOf({
        companyId: 'c_123',
        linkedinUrl: 'https://www.linkedin.com/company/jubilant-foodworks',
        name: 'Jubilant FoodWorks Ltd.',
      }),
    ).toBe('company:c_123');
  });

  it('uses the LinkedIn company when there is no id', () => {
    const url = 'https://in.linkedin.com/company/Jubilant-FoodWorks/?trk=x';

    expect(
      companyCacheKeyOf({ linkedinUrl: url, name: 'Jubilant FoodWorks Ltd.' }),
    ).toBe('linkedin:company:jubilant-foodworks');
  });

  it('falls back to the identity key before the company is resolved', () => {
    expect(companyCacheKeyOf({ name: 'Jubilant FoodWorks Ltd.' })).toBe(
      companyCacheKeyOf({ name: 'Jubilant Foodworks' }),
    );
  });

  it('returns an empty key when there is nothing to key on', () => {
    expect(companyCacheKeyOf({})).toBe('');
    expect(companyCacheKeyOf({ name: '   ' })).toBe('');
  });
});
