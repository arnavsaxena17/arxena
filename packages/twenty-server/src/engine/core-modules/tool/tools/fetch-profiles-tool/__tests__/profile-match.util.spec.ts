import {
  companyMatches,
  nameMatches,
  profileMatchesCompany,
} from 'src/engine/core-modules/tool/tools/fetch-profiles-tool/utils/profile-match.util';

describe('nameMatches', () => {
  it('should match on first and last name and ignore middle names and titles', () => {
    expect(nameMatches('Dr. Rahil Gandhi', 'Rahil K Gandhi')).toBe(true);
  });

  it('should not match a different person with the same first name', () => {
    expect(nameMatches('Rahil Gandhi', 'Rahil Shah')).toBe(false);
  });
});

describe('companyMatches', () => {
  it('should match a short company name inside the profile employer', () => {
    expect(companyMatches('Vadilal', ['Vadilal Industries Limited'])).toBe(
      true,
    );
  });

  it('should match when the profile employer is the shorter name', () => {
    expect(companyMatches('Subway India', ['Subway'])).toBe(true);
  });

  it('should ignore legal suffixes and fail on a different company', () => {
    expect(companyMatches('Mad Over Donuts Pvt. Ltd.', ['Subway'])).toBe(false);
  });
});

describe('profileMatchesCompany', () => {
  const company = 'Vadilal';

  it('should accept the company on the profile', () => {
    expect(
      profileMatchesCompany(
        { companyName: 'Vadilal Industries', evidence: '' },
        company,
      ),
    ).toBe(true);
  });

  it('should accept evidence that names the company', () => {
    expect(
      profileMatchesCompany(
        { companyName: '', evidence: 'Rahil Gandhi - CEO at Vadilal' },
        company,
      ),
    ).toBe(true);
  });

  it('should reject a namesake whose profile names another company', () => {
    expect(
      profileMatchesCompany(
        { companyName: 'Acme', evidence: 'Quantitative Strategist' },
        company,
      ),
    ).toBe(false);
  });
});
