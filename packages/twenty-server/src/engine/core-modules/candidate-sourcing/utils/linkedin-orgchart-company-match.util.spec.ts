import type { LinkedInPeopleSearchResult } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-response.type';

import {
    companyNamesLooselyMatch,
    linkedInPeopleSearchResultMatchesTargetCompany,
    normalizeCompanyNameForMatch,
    pickEmploymentPositionMatchingCompany,
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

describe('pickEmploymentPositionMatchingCompany', () => {
  const positions = [
    {
      role: 'Co-Founder',
      company: 'Intelligent Brain project management',
      company_id: '111',
    },
    {
      role: 'Operation Manager',
      company: 'Mazaya international',
      company_id: '68533040',
    },
  ];

  it('prefers company_id over name and over the first current position', () => {
    const matched = pickEmploymentPositionMatchingCompany(positions, {
      companyName: 'Intelligent Brain project management',
      companyId: '68533040',
    });
    expect(matched?.role).toBe('Operation Manager');
    expect(matched?.company).toBe('Mazaya international');
  });

  it('falls back to company name when the id does not match', () => {
    const matched = pickEmploymentPositionMatchingCompany(positions, {
      companyName: 'Mazaya',
      companyId: '999',
    });
    expect(matched?.role).toBe('Operation Manager');
  });

  it('does not assume current_positions[0] when nothing matches', () => {
    expect(
      pickEmploymentPositionMatchingCompany(positions, {
        companyName: 'Other Co',
        companyId: '000',
      }),
    ).toBeUndefined();
  });
});
