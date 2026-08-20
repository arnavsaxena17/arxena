import { CompanySearchHitTransformer } from '../company-search-hit.transformer';

describe('CompanySearchHitTransformer', () => {
  const transformer = new CompanySearchHitTransformer();

  it('maps Unipile company items', () => {
    expect(
      transformer.fromUnipileItems([
        {
          type: 'COMPANY',
          id: '1',
          name: 'Acme',
          website: 'acme.com',
          profile_url: 'https://www.linkedin.com/company/acme',
          industry: 'Software',
        },
        { type: 'PEOPLE', id: 'p1' },
      ]),
    ).toEqual([
      {
        id: '1',
        name: 'Acme',
        website: 'acme.com',
        linkedinUrl: 'https://www.linkedin.com/company/acme',
        industry: 'Software',
      },
    ]);
  });

  it('maps Harvest and index records', () => {
    expect(
      transformer.fromHarvestItem({
        id: 'h1',
        name: 'Harvest Co',
        websiteUrl: 'harvest.co',
        linkedinUrl: 'https://www.linkedin.com/company/harvest',
        industry: 'Staffing',
      }),
    ).toMatchObject({
      id: 'h1',
      name: 'Harvest Co',
      website: 'harvest.co',
    });

    expect(
      transformer.fromIndexItem({
        id: 'acme',
        name: 'Acme',
        website: 'acme.com',
        linkedin_url: 'https://www.linkedin.com/company/acme',
        industry: 'Software',
      }),
    ).toMatchObject({
      linkedinUrl: 'https://www.linkedin.com/company/acme',
    });
  });

  it('maps Unipile saved-account list members', () => {
    expect(
      transformer.fromUnipileItems([
        {
          object: 'SavedAccount',
          id: '5652',
          display_name: 'Egon Zehnder',
          profile_url: 'https://www.linkedin.com/company/egon-zehnder/',
          industry: 'Business Consulting and Services',
          website: 'http://www.egonzehnder.com',
        },
      ]),
    ).toEqual([
      {
        id: '5652',
        name: 'Egon Zehnder',
        website: 'http://www.egonzehnder.com',
        linkedinUrl: 'https://www.linkedin.com/company/egon-zehnder/',
        industry: 'Business Consulting and Services',
      },
    ]);
  });
});
