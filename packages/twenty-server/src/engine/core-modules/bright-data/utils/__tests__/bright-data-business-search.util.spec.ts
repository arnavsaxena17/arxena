import {
  mapBrightDataCompanyToEphemeral,
  mapBrightDataCompanyToSearchHit,
  mapBrightDataPersonToEphemeral,
  mapBrightDataPersonToSearchItem,
  normalizeBrightDataBusinessSearchMode,
  planBrightDataBusinessSearchPages,
} from 'src/engine/core-modules/bright-data/utils/bright-data-business-search.util';

const apparelCompany = {
  brightId: 'ab0f11c90553695d64d6fdb94e672889f127a3fa082bd827a1eb5001960a1938',
  data: {
    name: 'Aditya Birla Fashion and Retail Ltd.',
    industry: 'Retail Apparel and Fashion',
    organization_type: 'Public Company',
    headquarters_country_code: 'IN',
    headquarters_city: 'Mumbai',
    employees_in_linkedin: 14911,
    founded_year: 2007,
    domain: 'abfrl.com',
    website: 'https://www.abfrl.com/',
    url: 'https://www.linkedin.com/company/abfrl',
  },
};

describe('bright data business search util', () => {
  it('normalizes mode case, defaults to ludicrous and rejects unknown modes', () => {
    expect(normalizeBrightDataBusinessSearchMode('Smart')).toBe('smart');
    expect(normalizeBrightDataBusinessSearchMode()).toBe('ludicrous');
    expect(normalizeBrightDataBusinessSearchMode('INSTANT')).toBe('instant');
    expect(normalizeBrightDataBusinessSearchMode('Ludicrous')).toBe(
      'ludicrous',
    );
    expect(() => normalizeBrightDataBusinessSearchMode('turbo')).toThrow(
      'ludicrous, smart or instant',
    );
  });

  it('pages ludicrous searches at 100 and stops at offset 1000', () => {
    const pages = planBrightDataBusinessSearchPages({
      mode: 'ludicrous',
      limit: 5000,
    });

    expect(pages).toHaveLength(11);
    expect(pages[0]).toEqual({ offset: 0, limit: 100 });
    expect(pages[10]).toEqual({ offset: 1000, limit: 100 });
    expect(
      planBrightDataBusinessSearchPages({
        mode: 'ludicrous',
        limit: 300,
        offset: 900,
      }),
    ).toEqual([
      { offset: 900, limit: 100 },
      { offset: 1000, limit: 100 },
    ]);
  });

  it('pages smart searches at 10 and caps at 100', () => {
    expect(
      planBrightDataBusinessSearchPages({ mode: 'smart', limit: 25 }),
    ).toEqual([
      { offset: 0, limit: 10 },
      { offset: 10, limit: 10 },
      { offset: 20, limit: 5 },
    ]);
    expect(
      planBrightDataBusinessSearchPages({ mode: 'smart', limit: 500 }),
    ).toHaveLength(10);
    expect(
      planBrightDataBusinessSearchPages({
        mode: 'instant',
        limit: 250,
        offset: 100,
      }),
    ).toEqual([
      { offset: 100, limit: 100 },
      { offset: 200, limit: 100 },
      { offset: 300, limit: 50 },
    ]);
  });

  it('maps a company document into search and ephemeral rows', () => {
    expect(mapBrightDataCompanyToSearchHit(apparelCompany)).toMatchObject({
      id: apparelCompany.brightId,
      name: 'Aditya Birla Fashion and Retail Ltd.',
      website: 'https://www.abfrl.com/',
      linkedinUrl: 'https://www.linkedin.com/company/abfrl',
      industry: 'Retail Apparel and Fashion',
      country: 'IN',
      locality: 'Mumbai',
      size: '14911',
      founded: '2007',
    });
    expect(mapBrightDataCompanyToEphemeral(apparelCompany)).toMatchObject({
      id: apparelCompany.brightId,
      domain: 'abfrl.com',
      employees: '14911',
      segment: 'Public Company',
      status: 'new',
    });
  });

  it('maps a person document into search and ephemeral rows', () => {
    const person = {
      brightId: 'person-1',
      data: {
        name: 'Ada Lovelace',
        first_name: 'Ada',
        current_title: 'Managing Director',
        current_company_name: 'QSR India',
        url: 'https://www.linkedin.com/in/ada',
        location: 'Mumbai, India',
        about: 'Runs restaurants',
      },
    };

    expect(mapBrightDataPersonToSearchItem(person)).toMatchObject({
      name: 'Ada Lovelace',
      title: 'Managing Director',
      companyName: 'QSR India',
      url: 'https://www.linkedin.com/in/ada',
      source: 'bright_data',
    });
    expect(mapBrightDataPersonToEphemeral(person)).toMatchObject({
      id: 'person-1',
      name: 'Ada Lovelace',
      title: 'Managing Director',
      companyName: 'QSR India',
      linkedinUrl: 'https://www.linkedin.com/in/ada',
      stage: 'queued',
    });
  });
});
