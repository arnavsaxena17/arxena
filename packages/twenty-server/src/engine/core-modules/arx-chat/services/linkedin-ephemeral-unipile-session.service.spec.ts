import { LinkedinEphemeralUnipileSessionService } from './linkedin-ephemeral-unipile-session.service';

describe('LinkedinEphemeralUnipileSessionService', () => {
  const service = new LinkedinEphemeralUnipileSessionService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  it('uses li_at for classic and recruiter search types', () => {
    expect(
      service.pickCookieTokenForSearchType('classic', 'li-at-token', 'li-a-token'),
    ).toBe('li-at-token');
    expect(
      service.pickCookieTokenForSearchType('recruiter', 'li-at-token', 'li-a-token'),
    ).toBe('li-at-token');
  });

  it('prefers li_a for sales navigator with li_at fallback', () => {
    expect(
      service.pickCookieTokenForSearchType(
        'sales_navigator',
        'li-at-token',
        'li-a-token',
      ),
    ).toBe('li-a-token');
    expect(
      service.pickCookieTokenForSearchType('sales_navigator', 'li-at-token', null),
    ).toBe('li-at-token');
  });

  it('reports mode-aware cookie readiness', () => {
    expect(
      service.hasRequiredCookiesForSearchType('classic', 'li-at', null),
    ).toBe(true);
    expect(
      service.hasRequiredCookiesForSearchType('sales_navigator', null, null),
    ).toBe(false);
    expect(
      service.hasRequiredCookiesForSearchType('sales_navigator', 'li-at', null),
    ).toBe(true);
  });
});
