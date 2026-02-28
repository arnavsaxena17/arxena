import { isMaskedOrAnonymized, toTitleCase } from '../toTitleCase';

describe('toTitleCase', () => {
  it('converts job titles with prepositions correctly', () => {
    expect(toTitleCase('director of engineering')).toBe(
      'Director of Engineering',
    );
    expect(toTitleCase('head of sales')).toBe('Head of Sales');
    expect(toTitleCase('vice president of product')).toBe(
      'Vice President of Product',
    );
  });

  it('capitalizes first and last words even when small', () => {
    expect(toTitleCase('the lord of the rings')).toBe('The Lord of the Rings');
  });

  it('handles names', () => {
    expect(toTitleCase('john smith')).toBe('John Smith');
    expect(toTitleCase('mary jane watson')).toBe('Mary Jane Watson');
  });

  it('handles company names and locations', () => {
    expect(toTitleCase('acme corporation')).toBe('Acme Corporation');
    expect(toTitleCase('new york')).toBe('New York');
    expect(toTitleCase('san francisco bay area')).toBe(
      'San Francisco Bay Area',
    );
  });

  it('handles abbreviations correctly', () => {
    expect(toTitleCase('ceo')).toBe('CEO');
    expect(toTitleCase('director of ios development')).toBe(
      'Director of iOS Development',
    );
    expect(toTitleCase('head of hr')).toBe('Head of HR');
    expect(toTitleCase('ibm')).toBe('IBM');
    expect(toTitleCase('vp of engineering')).toBe('VP of Engineering');
  });

  it('ignores punctuation when matching abbreviations', () => {
    expect(toTitleCase('vp, sales and marketing')).toBe(
      'VP, Sales and Marketing',
    );
    expect(toTitleCase('evp. product')).toBe('EVP. Product');
  });

  it('handles country and function root names', () => {
    expect(toTitleCase('argentina')).toBe('Argentina');
    expect(toTitleCase('new zealand')).toBe('New Zealand');
    expect(toTitleCase('hong kong')).toBe('Hong Kong');
    expect(toTitleCase('fullcompany')).toBe('Full Company');
    expect(toTitleCase('human resources')).toBe('Human Resources');
    expect(toTitleCase('supply chain')).toBe('Supply Chain');
  });

  it('handles empty and null inputs', () => {
    expect(toTitleCase('')).toBe('');
    expect(toTitleCase(null)).toBe('');
    expect(toTitleCase(undefined)).toBe('');
  });

  it('splits underscores and title cases', () => {
    expect(toTitleCase('Information_technology_and_services')).toBe(
      'Information Technology and Services',
    );
    expect(toTitleCase('Consumer_electronics')).toBe('Consumer Electronics');
  });

  it('trims whitespace', () => {
    expect(toTitleCase('  director of engineering  ')).toBe(
      'Director of Engineering',
    );
  });

  it('is idempotent for already-cased strings', () => {
    expect(toTitleCase('Director of Engineering')).toBe(
      'Director of Engineering',
    );
  });

  it('skips title case for masked/anonymized when skipIfMasked', () => {
    expect(toTitleCase('xxx', { skipIfMasked: true })).toBe('xxx');
    expect(toTitleCase('xxxx xxx', { skipIfMasked: true })).toBe('xxxx xxx');
    expect(toTitleCase('unknown linkedin member', { skipIfMasked: true })).toBe(
      'unknown linkedin member',
    );
    expect(toTitleCase('xx yy', { skipIfMasked: true })).toBe('xx yy');
  });

  it('still applies title case to masked when skipIfMasked is false', () => {
    expect(toTitleCase('xxx')).toBe('Xxx');
  });
});

describe('isMaskedOrAnonymized', () => {
  it('returns true for masked/anonymized strings', () => {
    expect(isMaskedOrAnonymized('xxx')).toBe(true);
    expect(isMaskedOrAnonymized('xxxx xxx')).toBe(true);
    expect(isMaskedOrAnonymized('unknown linkedin member')).toBe(true);
    expect(isMaskedOrAnonymized('xx yy')).toBe(true);
  });

  it('returns false for real names', () => {
    expect(isMaskedOrAnonymized('john smith')).toBe(false);
    expect(isMaskedOrAnonymized('Director of Engineering')).toBe(false);
  });
});
