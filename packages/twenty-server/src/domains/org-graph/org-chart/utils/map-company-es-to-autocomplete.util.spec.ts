import { mapCompanyEsDocumentsToAutocompleteItems } from './map-company-es-to-autocomplete.util';

describe('mapCompanyEsDocumentsToAutocompleteItems', () => {
  it('maps ES company documents to autocomplete rows', () => {
    expect(
      mapCompanyEsDocumentsToAutocompleteItems([
        {
          id: 'google',
          name: 'Google',
          website: 'google.com',
          industry: 'Internet',
          locality: 'Mountain View',
          region: 'California',
          country: 'United States',
          linkedin_url: 'https://www.linkedin.com/company/google',
          count_org: 42,
        },
      ]),
    ).toEqual([
      {
        name: 'Google',
        meta: {
          id: 'google',
          website: 'google.com',
          industry: 'Internet',
          location_name: 'Mountain View, California, United States',
          linkedin_url: 'https://www.linkedin.com/company/google',
        },
        count: 42,
      },
    ]);
  });

  it('drops documents without a name or id', () => {
    expect(
      mapCompanyEsDocumentsToAutocompleteItems([{ website: 'example.com' }]),
    ).toEqual([]);
  });
});
