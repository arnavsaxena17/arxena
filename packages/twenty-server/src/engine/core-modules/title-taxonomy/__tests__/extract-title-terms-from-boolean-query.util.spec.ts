import { extractTitleTermsFromBooleanQuery } from 'src/engine/core-modules/title-taxonomy/extract-title-terms-from-boolean-query.util';

describe('extractTitleTermsFromBooleanQuery', () => {
  it('should read a plain list of titles', () => {
    expect(
      extractTitleTermsFromBooleanQuery(
        '(CEO OR "chief executive" OR "managing director" OR founder) OR (CEO OR president)',
      ),
    ).toEqual([
      'ceo',
      'chief executive',
      'managing director',
      'founder',
      'ceo',
      'president',
    ]);
  });

  it('should skip a function AND seniority expression', () => {
    expect(
      extractTitleTermsFromBooleanQuery(
        '((marketing OR brand) AND (head OR director))',
      ),
    ).toEqual([]);
  });
});
