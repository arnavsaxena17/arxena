import type { LinkedInPeopleSearchResult } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-response.type';

import {
    companyNamesLooselyMatch,
    linkedInPeopleSearchResultMatchesTargetCompany,
    normalizeCompanyNameForMatch,
} from './linkedin-orgchart-company-match.util';

describe('linkedin-orgchart-company-match.util', () => {
  it('normalizeCompanyNameForMatch strips suffix noise', () => {
    expect(normalizeCompanyNameForMatch('Arxena Inc.')).toBe('arxena');
    expect(normalizeCompanyNameForMatch('Acme LLC')).toBe('acme');
  });

  it('companyNamesLooselyMatch handles containment', () => {
    expect(companyNamesLooselyMatch('Arxena', 'Arxena Inc')).toBe(true);
    expect(companyNamesLooselyMatch('OtherCo', 'Arxena')).toBe(false);
  });

  it('linkedInPeopleSearchResultMatchesTargetCompany uses current_positions', () => {
    const candidate = {
      current_positions: [
        {
          company: 'Arxena',
          company_id: 'x',
          description: null,
          role: 'CEO',
          location: null,
          industry: [],
          tenure_at_role: { years: 0, months: 0 },
          tenure_at_company: { years: 0, months: 0 },
          start: { year: 2020 },
          skills: null,
        },
      ],
    } as unknown as LinkedInPeopleSearchResult;

    expect(linkedInPeopleSearchResultMatchesTargetCompany(candidate, 'Arxena')).toBe(
      true,
    );
    expect(linkedInPeopleSearchResultMatchesTargetCompany(candidate, 'OtherCo')).toBe(
      false,
    );
  });
});
