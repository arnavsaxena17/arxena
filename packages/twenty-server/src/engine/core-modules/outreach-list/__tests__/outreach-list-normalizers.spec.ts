import {
  fromBrightDataDocument,
  isOutreachListSourceTool,
  normalizeToolOutputToListRows,
} from 'src/engine/core-modules/outreach-list/utils/outreach-list-normalizers.util';
import {
  buildOutreachListRowKey,
  normalizeDomain,
  normalizeLinkedinUrl,
} from 'src/engine/core-modules/outreach-list/utils/outreach-list-keys.util';
import { buildOutreachListCsv } from 'src/engine/core-modules/outreach-list/utils/outreach-list-csv.util';

describe('outreach list keys', () => {
  it('should treat the same website written differently as one company', () => {
    expect(normalizeDomain('https://www.Wowmomo.com/about?x=1')).toBe(
      'wowmomo.com',
    );
    expect(
      buildOutreachListRowKey('company', {
        domain: '',
        website: 'http://wowmomo.com/',
        linkedinUrl: '',
        name: 'Wow! Momo',
        companyName: '',
      }),
    ).toBe('d:wowmomo.com');
  });

  it('should never use a Sales Navigator lead url as a person key', () => {
    expect(
      normalizeLinkedinUrl(
        'https://www.linkedin.com/sales/lead/ACw,NAME_SEARCH',
      ),
    ).toBe('');
    expect(
      normalizeLinkedinUrl('https://www.linkedin.com/in/jane-doe/?x=1'),
    ).toBe('linkedin.com/in/jane-doe');
  });
});

describe('normalizeToolOutputToListRows', () => {
  it('should read the nested Apollo organizations shape', () => {
    const normalized = normalizeToolOutputToListRows(
      'search_apollo_companies',
      { organizationName: 'restaurant', page: 2 },
      {
        result: {
          organizations: {
            organizations: [
              {
                id: 'a1',
                name: 'Burger Co',
                primary_domain: 'burger.co',
                industry: 'Restaurants',
                country: 'India',
                estimated_num_employees: 250,
              },
            ],
            accounts: [],
          },
        },
      },
    );

    expect(normalized?.entity).toBe('company');
    expect(normalized?.rows[0]).toMatchObject({
      key: 'd:burger.co',
      source: 'apollo',
      size: '250',
    });
    expect(normalized?.signatureArgs).toEqual({
      organizationName: 'restaurant',
    });
  });

  it('should use the public LinkedIn url for people, not the lead link', () => {
    const normalized = normalizeToolOutputToListRows(
      'search_linkedin_people',
      {},
      {
        items: [
          {
            name: 'Sameer K',
            headline: 'CEO',
            profile_url: 'https://www.linkedin.com/sales/lead/abc',
            public_profile_url: 'https://www.linkedin.com/in/sameer-k',
            current_positions: [{ role: 'CEO', company: 'Jubilant' }],
          },
        ],
      },
    );

    expect(normalized?.rows[0]).toMatchObject({
      key: 'l:linkedin.com/in/sameer-k',
      title: 'CEO',
      companyName: 'Jubilant',
    });
  });

  it('should route a pasted company search url into a company list', () => {
    const normalized = normalizeToolOutputToListRows(
      'search_linkedin_from_url',
      { url: 'https://www.linkedin.com/sales/search/company?page=3' },
      {
        result: {
          items: [
            {
              type: 'COMPANY',
              id: '123',
              name: 'Burger Co',
              industry: 'Restaurants',
              headcount: '51-200',
            },
          ],
        },
      },
    );

    expect(normalized?.entity).toBe('company');
    expect(normalized?.rows[0].name).toBe('Burger Co');
  });

  it('should return null for unknown shapes so output is left alone', () => {
    expect(
      normalizeToolOutputToListRows('search_apollo_people', {}, { result: {} }),
    ).toBeNull();
    expect(isOutreachListSourceTool('find_many_companies')).toBe(false);
  });

  it('should map a Bright Data company document', () => {
    const row = fromBrightDataDocument('company', {
      brightId: 'b1',
      data: {
        name: 'Wow! Momo',
        website: 'https://www.wowmomo.com/',
        industry: 'Restaurants',
        headquarters_country_code: 'IN',
        company_size_from: 201,
        company_size_to: 500,
      },
    });

    expect(row).toMatchObject({
      key: 'd:wowmomo.com',
      country: 'IN',
      size: '201-500',
      source: 'bright_data',
    });
    expect(
      fromBrightDataDocument('company', {
        brightId: 'b1',
        relevant: false,
        data: {
          name: 'Medikabazaar',
          website: 'https://www.medikabazaar.com/',
        },
      })?.otherFields,
    ).toEqual({ relevant: false });
  });
});

describe('buildOutreachListCsv', () => {
  it('should neutralise formulas, quote commas and include every row', () => {
    const rows = [
      fromBrightDataDocument('company', {
        brightId: '1',
        data: { name: '=cmd|calc', website: 'https://a.com' },
      }),
      fromBrightDataDocument('company', {
        brightId: '2',
        data: { name: 'Beta, Inc', website: 'https://b.com' },
      }),
    ].filter((row) => row !== null);
    const csv = buildOutreachListCsv('company', rows);

    expect(csv).toContain("'=cmd|calc");
    expect(csv).toContain('"Beta, Inc"');
    expect(csv.trim().split('\n')).toHaveLength(3);
  });
});
