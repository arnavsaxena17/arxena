import {
  isDirectCompanyNameMatch,
  scoreCompanyNameMatch,
} from '../score-company-name-match.util';

describe('scoreCompanyNameMatch', () => {
  it('should score exact names and legal-suffix variants as 100', () => {
    expect(scoreCompanyNameMatch('Apple', 'Apple Inc')).toBe(100);
    expect(scoreCompanyNameMatch('StayVista', 'Stay Vista')).toBe(100);
  });

  it('should treat a matching LinkedIn slug as a direct hit', () => {
    expect(
      scoreCompanyNameMatch('StayVista', 'Vista Rooms', 'stay-vista'),
    ).toBe(100);
    expect(isDirectCompanyNameMatch('StayVista', '', 'stayvista')).toBe(true);
  });

  it('should not treat a weak overlapping name as a direct match', () => {
    expect(isDirectCompanyNameMatch('Apple', 'Apple Bank')).toBe(false);
    expect(isDirectCompanyNameMatch('Stripe', 'Microsoft')).toBe(false);
  });
});
