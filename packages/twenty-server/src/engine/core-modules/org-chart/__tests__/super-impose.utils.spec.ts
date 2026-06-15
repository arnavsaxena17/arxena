import {
    buildResolvedCompanyFromUrl,
    dedupeNormalizedLinkedinCompanyUrls,
    extractLinkedinCompanySlugFromUrl,
    isValidLinkedinCompanyPageUrl,
    isValidSalesNavigatorPeopleSearchUrl,
    normalizeLinkedinCompanyUrl,
    parseMultilineUrlInput,
    resolveSuperImposeCompanySearchNames,
} from 'src/engine/core-modules/org-chart/utils/super-impose-input-resolver.util';
import {
    andMergeBooleanSearchClauses,
    wrapJobTitleAsOrClause,
} from 'src/engine/core-modules/org-chart/utils/super-impose-keyword-merge.util';

describe('super-impose-input-resolver.util', () => {
  it('extracts linkedin company slug from url', () => {
    expect(
      extractLinkedinCompanySlugFromUrl(
        'https://www.linkedin.com/company/Acme-Corp/about/',
      ),
    ).toBe('acme-corp');
  });

  it('normalizes slug to canonical linkedin company url', () => {
    expect(normalizeLinkedinCompanyUrl('acme-corp')).toBe(
      'https://www.linkedin.com/company/acme-corp/',
    );
  });

  it('dedupes normalized linkedin company urls', () => {
    expect(
      dedupeNormalizedLinkedinCompanyUrls([
        'https://www.linkedin.com/company/acme/',
        'acme',
        'https://linkedin.com/company/acme',
      ]),
    ).toEqual(['https://www.linkedin.com/company/acme/']);
  });

  it('validates linkedin company and sales navigator urls', () => {
    expect(
      isValidLinkedinCompanyPageUrl('https://www.linkedin.com/company/foo'),
    ).toBe(true);
    expect(isValidSalesNavigatorPeopleSearchUrl('https://example.com')).toBe(
      false,
    );
    expect(
      isValidSalesNavigatorPeopleSearchUrl(
        'https://www.linkedin.com/sales/search/people?query=(recentSearchId:1)',
      ),
    ).toBe(true);
  });

  it('builds resolved company from url', () => {
    expect(
      buildResolvedCompanyFromUrl(
        'https://www.linkedin.com/company/foo/',
        'linkedin_url',
        'Foo Inc',
      ),
    ).toEqual({
      slug: 'foo',
      linkedinUrl: 'https://www.linkedin.com/company/foo/',
      resolvedFrom: 'linkedin_url',
      companyName: 'Foo Inc',
    });
  });

  it('parses multiline url input', () => {
    expect(parseMultilineUrlInput('  a\n\nb  ')).toEqual(['a', 'b']);
  });

  it('derives company search names from resolved companies', () => {
    expect(
      resolveSuperImposeCompanySearchNames([
        {
          slug: 'insulators-and-electricals-company',
          linkedinUrl:
            'https://www.linkedin.com/company/insulators-and-electricals-company/',
          resolvedFrom: 'primary_chart',
          companyName: 'Insulators and Electricals Company',
        },
        {
          slug: 'insulator-and-electrical-company',
          linkedinUrl:
            'https://www.linkedin.com/company/insulator-and-electrical-company/',
          resolvedFrom: 'linkedin_url',
        },
      ]),
    ).toEqual([
      'Insulators and Electricals Company',
      'insulator and electrical company',
    ]);
  });
});

describe('super-impose-keyword-merge.util', () => {
  it('and-merges boolean clauses with parentheses', () => {
    expect(
      andMergeBooleanSearchClauses(['sales OR revenue', 'india']),
    ).toBe('(sales OR revenue) AND india');
  });

  it('wraps multi-term job titles as OR clause', () => {
    expect(wrapJobTitleAsOrClause('VP Sales Director')).toBe(
      'VP OR Sales OR Director',
    );
  });
});
