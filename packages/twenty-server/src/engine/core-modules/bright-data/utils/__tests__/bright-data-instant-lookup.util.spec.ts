import {
  filterBrightDataDocumentsByLinkedinUrl,
  parseBrightDataInstantLookupQuery,
} from 'src/engine/core-modules/bright-data/utils/bright-data-business-search.util';

describe('parseBrightDataInstantLookupQuery', () => {
  it('should read a company website as a domain lookup', () => {
    expect(
      parseBrightDataInstantLookupQuery('company', 'https://www.Stripe.com'),
    ).toEqual({ kind: 'domain', domainHost: 'stripe.com' });
  });

  it('should read a company LinkedIn URL as a LinkedIn lookup, not the linkedin.com domain', () => {
    expect(
      parseBrightDataInstantLookupQuery(
        'company',
        'https://www.linkedin.com/company/ABFRL/about/?trk=x',
      ),
    ).toEqual({
      kind: 'linkedinUrl',
      linkedinUrlKey: 'linkedin.com/company/abfrl',
    });
  });

  it('should read a profile URL as a people lookup, including locale subdomains', () => {
    expect(
      parseBrightDataInstantLookupQuery(
        'people',
        'in.linkedin.com/in/smita-jatia/',
      ),
    ).toEqual({
      kind: 'linkedinUrl',
      linkedinUrlKey: 'linkedin.com/in/smita-jatia',
    });
  });

  it('should treat a URL of the other entity as a probe', () => {
    expect(
      parseBrightDataInstantLookupQuery(
        'people',
        'https://www.linkedin.com/company/abfrl',
      ),
    ).toBeNull();
    expect(
      parseBrightDataInstantLookupQuery(
        'company',
        'https://www.linkedin.com/in/smita-jatia',
      ),
    ).toBeNull();
  });

  it('should treat a domain in a people search and any plain phrase as a probe', () => {
    expect(
      parseBrightDataInstantLookupQuery('people', 'stripe.com'),
    ).toBeNull();
    expect(
      parseBrightDataInstantLookupQuery('people', 'Smita Jatia Westlife'),
    ).toBeNull();
    expect(
      parseBrightDataInstantLookupQuery('company', 'apparel brands India'),
    ).toBeNull();
  });
});

describe('filterBrightDataDocumentsByLinkedinUrl', () => {
  it('should keep only the record with the same LinkedIn URL', () => {
    const kept = filterBrightDataDocumentsByLinkedinUrl(
      [
        {
          brightId: 'a',
          data: { url: 'https://www.linkedin.com/in/Smita-Jatia?original=1' },
        },
        {
          brightId: 'b',
          data: { url: 'https://www.linkedin.com/in/smita-jatia-2' },
        },
        { brightId: 'c', data: {} },
      ],
      'linkedin.com/in/smita-jatia',
    );

    expect(kept.map((document) => document.brightId)).toEqual(['a']);
  });
});
