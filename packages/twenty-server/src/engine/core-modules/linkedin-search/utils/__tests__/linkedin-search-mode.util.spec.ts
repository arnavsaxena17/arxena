import {
  getLinkedinSearchModeAvailability,
  resolveLinkedinSearchMode,
} from 'src/engine/core-modules/linkedin-search/utils/linkedin-search-mode.util';

const SEAT = { contract_id: 'contract', owner_seat_id: 'seat' };

const profileWith = (me: Record<string, unknown>) => ({
  linkedinUnipileAccountId: 'account-1',
  me,
});

describe('getLinkedinSearchModeAvailability', () => {
  it('should allow only classic for an account without premium seats', () => {
    expect(
      getLinkedinSearchModeAvailability(profileWith({}), 'people'),
    ).toEqual({ known: true, available: ['classic'], defaultMode: 'classic' });
  });

  it('should default people search to Sales Navigator when both seats exist', () => {
    expect(
      getLinkedinSearchModeAvailability(
        profileWith({ sales_navigator: SEAT, recruiter: SEAT }),
        'people',
      ),
    ).toEqual({
      known: true,
      available: ['classic', 'sales_navigator', 'recruiter'],
      defaultMode: 'sales_navigator',
    });
  });

  it('should fall back to classic for companies on a Recruiter-only seat', () => {
    expect(
      getLinkedinSearchModeAvailability(
        profileWith({ recruiter: SEAT }),
        'companies',
      ),
    ).toEqual({ known: true, available: ['classic'], defaultMode: 'classic' });
  });

  it('should read a profile stored as a JSON string', () => {
    expect(
      getLinkedinSearchModeAvailability(
        JSON.stringify(profileWith({ recruiter: SEAT })),
        'people',
      ).defaultMode,
    ).toBe('recruiter');
  });

  it('should mark seats unknown when nothing is stored', () => {
    expect(getLinkedinSearchModeAvailability(null, 'people')).toEqual({
      known: false,
      available: ['classic', 'sales_navigator', 'recruiter'],
      defaultMode: 'classic',
    });
  });
});

describe('resolveLinkedinSearchMode', () => {
  it('should use the default mode when searchType is omitted', () => {
    const resolution = resolveLinkedinSearchMode({
      linkedinProfile: profileWith({ sales_navigator: SEAT }),
      category: 'people',
    });

    expect(resolution).toMatchObject({ ok: true, mode: 'sales_navigator' });
  });

  it('should reject a mode the account has no seat for', () => {
    const resolution = resolveLinkedinSearchMode({
      requested: 'recruiter',
      linkedinProfile: profileWith({ sales_navigator: SEAT }),
      category: 'people',
    });

    expect(resolution).toMatchObject({
      ok: false,
      requested: 'recruiter',
      availability: { available: ['classic', 'sales_navigator'] },
    });
  });

  it('should reject recruiter for company search', () => {
    const resolution = resolveLinkedinSearchMode({
      requested: 'recruiter',
      linkedinProfile: profileWith({ recruiter: SEAT }),
      category: 'companies',
    });

    expect(resolution.ok).toBe(false);
  });

  it('should keep the requested mode when seats are unknown', () => {
    const resolution = resolveLinkedinSearchMode({
      requested: 'sales_navigator',
      linkedinProfile: undefined,
      category: 'people',
    });

    expect(resolution).toMatchObject({ ok: true, mode: 'sales_navigator' });
  });
});
