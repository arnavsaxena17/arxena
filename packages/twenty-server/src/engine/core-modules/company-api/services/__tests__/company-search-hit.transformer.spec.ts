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

  it('maps CRM composite links and full search payloads', () => {
    expect(
      transformer.fromAnyItem({
        name: 'Acme',
        domainName: { primaryLinkUrl: 'https://acme.com' },
        linkedinLink: {
          primaryLinkUrl: 'https://www.linkedin.com/company/acme',
        },
      }),
    ).toEqual({
      id: '',
      name: 'Acme',
      website: 'https://acme.com',
      linkedinUrl: 'https://www.linkedin.com/company/acme',
      industry: '',
    });

    expect(
      transformer.fromUnknownInput(
        JSON.stringify({
          success: true,
          companies: [
            {
              id: '14440515',
              name: 'Heidrick & Struggles',
              website: 'http://www.heidrick.com',
              linkedinUrl:
                'https://www.linkedin.com/company/heidrick-and-struggles/',
              industry: 'Human Resources Services',
            },
          ],
        }),
      ),
    ).toEqual([
      {
        id: '14440515',
        name: 'Heidrick & Struggles',
        website: 'http://www.heidrick.com',
        linkedinUrl: 'https://www.linkedin.com/company/heidrick-and-struggles/',
        industry: 'Human Resources Services',
      },
    ]);

    expect(
      transformer.fromUnknownInput([
        JSON.stringify({
          name: 'Apple',
          website: '',
          linkedinUrl: 'https://www.linkedin.com/company/apple/',
          industry: 'Computers and Electronics Manufacturing',
        }),
      ]),
    ).toMatchObject([{ name: 'Apple', website: '' }]);
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

  it('maps websites arrays and LinkedIn public identifiers', () => {
    expect(
      transformer.fromAnyItem({
        name: 'Korn Ferry',
        websites: [{ url: 'https://www.kornferry.com' }],
        public_identifier: 'korn-ferry',
      }),
    ).toMatchObject({
      name: 'Korn Ferry',
      website: 'https://www.kornferry.com',
      linkedinUrl: 'https://www.linkedin.com/company/korn-ferry',
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
