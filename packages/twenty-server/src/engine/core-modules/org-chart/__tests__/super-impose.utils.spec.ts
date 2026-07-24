import {
    buildResolvedCompanyFromUrl,
    dedupeNormalizedLinkedinCompanyUrls,
    extractLinkedinCompanySlugFromUrl,
    isValidLinkedinCompanyPageUrl,
    isValidSalesNavigatorPeopleSearchUrl,
    normalizeLinkedinCompanyUrl,
    parseMultilineUrlInput,
    resolveSuperImposeCompanySearchNames,
    resolveSuperImposeLinkedinCompanyParameterIds,
    sumSuperImposeEmployeeCounts,
} from 'src/engine/core-modules/org-chart/utils/super-impose-input-resolver.util';
import { extractLinkedinCompanyIdFromUnipileProfile } from 'src/engine/core-modules/arx-chat/services/unipile-company.service';
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

  it('builds linkedin company parameter ids for all resolved companies', () => {
    expect(
      resolveSuperImposeLinkedinCompanyParameterIds(
        [
          {
            slug: 'pd-hinduja-national-hospital-&-medical-research-centre-mumbai-',
            linkedinUrl:
              'https://www.linkedin.com/company/pd-hinduja-national-hospital-&-medical-research-centre-mumbai-/',
            resolvedFrom: 'primary_chart',
            companyName:
              'pd hinduja national hospital & medical research centre (mumbai)',
          },
          {
            slug: 'hinduja-hospital',
            linkedinUrl: 'https://www.linkedin.com/company/hinduja-hospital/',
            resolvedFrom: 'linkedin_url',
          },
        ],
        'pd-hinduja-national-hospital-&-medical-research-centre-mumbai-',
      ),
    ).toEqual([
      'pd-hinduja-national-hospital-&-medical-research-centre-mumbai-',
      'hinduja-hospital',
    ]);
  });

  it('prefers profile-resolved numeric company ids over slugs', () => {
    expect(
      resolveSuperImposeLinkedinCompanyParameterIds(
        [
          {
            slug: 'pd-hinduja-national-hospital-&-medical-research-centre-mumbai-',
            linkedinUrl:
              'https://www.linkedin.com/company/pd-hinduja-national-hospital-&-medical-research-centre-mumbai-/',
            resolvedFrom: 'primary_chart',
          },
          {
            slug: 'hinduja-hospital',
            linkedinUrl: 'https://www.linkedin.com/company/hinduja-hospital/',
            resolvedFrom: 'linkedin_url',
          },
        ],
        'pd-hinduja-national-hospital-&-medical-research-centre-mumbai-',
        ['33634615', '946958'],
      ),
    ).toEqual(['33634615', '946958']);
  });

  it('sums employee counts only when every company has a valid count', () => {
    expect(
      sumSuperImposeEmployeeCounts([
        {
          slug: 'a',
          linkedinCompanyId: '1',
          employeeCount: 100,
          resolvedVia: 'company_profile',
        },
        {
          slug: 'b',
          linkedinCompanyId: '2',
          employeeCount: 50,
          resolvedVia: 'company_profile',
        },
      ]),
    ).toBe(150);

    expect(
      sumSuperImposeEmployeeCounts([
        {
          slug: 'a',
          linkedinCompanyId: '1',
          employeeCount: 100,
          resolvedVia: 'company_profile',
        },
        {
          slug: 'b',
          linkedinCompanyId: '2',
          resolvedVia: 'slug_fallback',
        },
      ]),
    ).toBeNull();
  });

  it('extracts numeric company ids from Unipile profiles', () => {
    expect(
      extractLinkedinCompanyIdFromUnipileProfile({
        id: '946958',
        entity_urn: 'urn:li:fsd_company:946958',
      }),
    ).toBe('946958');
    expect(
      extractLinkedinCompanyIdFromUnipileProfile({
        entity_urn: 'urn:li:fsd_company:27444961',
      }),
    ).toBe('27444961');
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
