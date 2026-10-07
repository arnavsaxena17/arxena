import { matchesBrightDataCompanyName } from 'src/engine/core-modules/org-chart/utils/match-bright-data-company-name.util';

describe('matchesBrightDataCompanyName', () => {
  it('accepts legal-suffix and punctuation variants', () => {
    expect(matchesBrightDataCompanyName('Acme', 'Acme Inc.')).toBe(true);
    expect(matchesBrightDataCompanyName('Acme Pvt Ltd', 'ACME')).toBe(true);
    expect(
      matchesBrightDataCompanyName('Tata Consultancy', 'Tata-Consultancy'),
    ).toBe(true);
  });

  it('rejects longer company names that merely start with the name', () => {
    expect(matchesBrightDataCompanyName('Acme', 'Acme Robotics')).toBe(false);
    expect(matchesBrightDataCompanyName('Acme', undefined)).toBe(false);
    expect(matchesBrightDataCompanyName('', 'Acme')).toBe(false);
  });
});
