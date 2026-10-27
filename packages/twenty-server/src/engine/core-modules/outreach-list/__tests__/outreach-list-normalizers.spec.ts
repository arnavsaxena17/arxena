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

  it('should route Harvest leads into a paid people list with their cost', () => {
    const normalized = normalizeToolOutputToListRows(
      'search_harvest_leads',
      {
        searchParameters: { currentJobTitles: ['Plant Manager'] },
        page: 2,
        limit: 25,
        projectId: 'project-1',
      },
      {
        items: [
          {
            id: 'ACw1',
            firstName: 'Asha',
            lastName: 'Rao',
            linkedinUrl: 'https://www.linkedin.com/in/asha',
            location: 'Mumbai, India',
            currentPositions: [
              { title: 'Plant Manager', companyName: 'Arvind' },
            ],
          },
        ],
        costUsd: 0.004,
      },
    );

    expect(normalized).toMatchObject({
      entity: 'people',
      source: 'harvest',
      label: 'Plant Manager',
      spentUsd: 0.004,
      signatureArgs: {
        searchParameters: { currentJobTitles: ['Plant Manager'] },
      },
    });
    expect(normalized?.rows[0]).toMatchObject({
      name: 'Asha Rao',
      title: 'Plant Manager',
      companyName: 'Arvind',
      linkedinUrl: 'https://www.linkedin.com/in/asha',
      location: 'Mumbai, India',
    });
  });

  it('should read a raw Harvest lead with a nested location', () => {
    const normalized = normalizeToolOutputToListRows(
      'search_harvest_leads',
      { searchParameters: { currentJobTitles: ['Plant Manager'] } },
      {
        items: [
          {
            id: 'ACw2',
            firstName: 'Ravi',
            lastName: 'Iyer',
            linkedinUrl: 'https://www.linkedin.com/in/ravi',
            location: { linkedinText: 'Chennai, India' },
            currentPositions: [{ title: 'Plant Head', companyName: 'TVS' }],
          },
        ],
      },
    );

    expect(normalized?.rows[0]).toMatchObject({
      name: 'Ravi Iyer',
      title: 'Plant Head',
      companyName: 'TVS',
      location: 'Chennai, India',
    });
  });

  it('should read a nested Harvest account location', () => {
    const normalized = normalizeToolOutputToListRows(
      'search_harvest_accounts',
      { searchParameters: { search: 'software' } },
      {
        items: [
          {
            id: '1035',
            name: 'Microsoft',
            location: { linkedinText: 'Redmond, Washington' },
          },
        ],
      },
    );

    expect(normalized?.rows[0]?.location).toBe('Redmond, Washington');
  });

  it('should route Harvest accounts into a company list', () => {
    const normalized = normalizeToolOutputToListRows(
      'search_harvest_accounts',
      { searchParameters: { search: 'software' } },
      {
        items: [
          {
            id: '1035',
            name: 'Microsoft',
            linkedinUrl: 'https://www.linkedin.com/company/1035',
            industry: 'Software Development',
            employeeCountRange: '10001+',
          },
        ],
        costUsd: 0.004,
      },
    );

    expect(normalized?.entity).toBe('company');
    expect(normalized?.rows[0]).toMatchObject({
      name: 'Microsoft',
      size: '10001+',
      source: 'harvest',
    });
  });

  it('should return null for unknown shapes so output is left alone', () => {
    expect(
      normalizeToolOutputToListRows('search_apollo_people', {}, { result: {} }),
    ).toBeNull();
    expect(isOutreachListSourceTool('find_many_companies')).toBe(false);
    expect(isOutreachListSourceTool('search_people_index')).toBe(true);
    expect(isOutreachListSourceTool('search_wikidata_companies')).toBe(true);
  });

  it('should route people index hits into a people list without projectId in the signature', () => {
    const normalized = normalizeToolOutputToListRows(
      'search_people_index',
      { jobTitle: 'CEO', projectId: 'proj-1', limit: 10 },
      {
        result: {
          items: [
            {
              full_name: 'Ada Lovelace',
              job_title: 'CEO',
              job_company_name: 'Analytical Engines',
              linkedin_url: 'https://www.linkedin.com/in/ada',
            },
          ],
        },
      },
    );

    expect(normalized?.entity).toBe('people');
    expect(normalized?.rows[0]).toMatchObject({
      name: 'Ada Lovelace',
      title: 'CEO',
      companyName: 'Analytical Engines',
      source: 'other',
    });
    expect(normalized?.signatureArgs).toEqual({ jobTitle: 'CEO' });
  });

  it('should route Wikidata companies into a company list', () => {
    const normalized = normalizeToolOutputToListRows(
      'search_wikidata_companies',
      { domain: 'dow.com', projectId: 'proj-1' },
      {
        result: {
          companies: [
            {
              wikidataId: 'Q123',
              companyName: 'Dow',
              companyDomain: 'dow.com',
              website: 'https://www.dow.com',
              industry: 'Chemicals',
              employeeCount: 35000,
            },
          ],
        },
      },
    );

    expect(normalized?.entity).toBe('company');
    expect(normalized?.rows[0]).toMatchObject({
      name: 'Dow',
      domain: 'dow.com',
      size: '35000',
      source: 'other',
    });
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
        linkedin_followers: 12000,
      },
    });

    expect(row).toMatchObject({
      key: 'd:wowmomo.com',
      country: 'IN',
      size: '201-500',
      source: 'bright_data',
    });
    expect(row?.otherFields).toMatchObject({
      website: 'https://www.wowmomo.com/',
      headquartersCountry: 'IN',
      sizeBand: '201-500',
      linkedinFollowers: 12000,
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
    ).toEqual({
      website: 'https://www.medikabazaar.com/',
      relevant: false,
    });
  });

  it('should map Bright Data people fields into otherFields', () => {
    const row = fromBrightDataDocument('people', {
      brightId: 'p1',
      data: {
        name: 'Sachin Kesharwani',
        current_title: 'Co-Founder',
        current_company_name: 'HAPPY FACES',
        url: 'https://www.linkedin.com/in/sachin-kesharwani',
        connections: 500,
        followers: 1264,
        education_schools: 'Indira Gandhi National Open University',
        past_job_titles: 'Volunteer',
        past_company_names: 'Dream Empowerment Organization',
      },
    });

    expect(row).toMatchObject({
      name: 'Sachin Kesharwani',
      title: 'Co-Founder',
      companyName: 'HAPPY FACES',
      source: 'bright_data',
    });
    expect(row?.otherFields).toMatchObject({
      connections: 500,
      followers: 1264,
      educationSchools: 'Indira Gandhi National Open University',
      pastJobTitles: 'Volunteer',
      pastCompanyNames: 'Dream Empowerment Organization',
      workExperience: [
        { role: 'Volunteer', company: 'Dream Empowerment Organization' },
      ],
      education: [
        { school: 'Indira Gandhi National Open University', degree: '' },
      ],
    });
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
