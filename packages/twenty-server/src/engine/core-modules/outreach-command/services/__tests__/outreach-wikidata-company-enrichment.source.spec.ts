import { mapWikidataProfileToWikiCompanyHit } from 'src/engine/core-modules/outreach-command/services/outreach-wikidata-company-enrichment.source';
import type { WikidataCompanyProfile } from 'src/engine/core-modules/wikidata/types/wikidata-company.types';

describe('mapWikidataProfileToWikiCompanyHit', () => {
  it('maps ranked Wikidata profile fields into OutreachWikiCompanyHit', () => {
    const profile: WikidataCompanyProfile = {
      wikidataId: 'Q667505',
      companyDomain: 'clariant.com',
      companyName: 'Clariant',
      legalName: 'Clariant AG',
      website: 'http://www.clariant.com',
      description: 'specialty chemicals company',
      industry: 'chemical industry',
      industries: ['chemical industry'],
      foundedYear: 1995,
      inceptionDate: '1995-01-01',
      headquarters: {
        city: 'Muttenz',
        stateOrRegion: null,
        country: 'Switzerland',
        label: 'Muttenz, Switzerland',
      },
      employeeCount: 11278,
      keyExecutives: { ceo: null, chairmanOfTheBoard: null },
      stockListing: null,
      legalForm: null,
      entityTypes: ['business', 'publicly traded company'],
      country: 'Switzerland',
      dataSources: { wikidata: 'Q667505', wikipedia: 'Clariant' },
      matchScore: 90,
      matchReason: 'official website host matches domain',
    };

    expect(mapWikidataProfileToWikiCompanyHit(profile)).toEqual({
      id: 'Q667505',
      name: 'Clariant',
      website: 'http://www.clariant.com',
      industry: 'chemical industry',
      country: 'Switzerland',
      locality: 'Muttenz',
      size: '11278',
      founded: '1995',
    });
  });
});
