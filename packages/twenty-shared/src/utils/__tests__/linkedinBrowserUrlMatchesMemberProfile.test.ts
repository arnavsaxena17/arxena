import { linkedinBrowserUrlMatchesMemberProfile } from '../unipileWorkspaceMemberMatch';

describe('linkedinBrowserUrlMatchesMemberProfile', () => {
  it('returns no_member_url when member linkedinUrl is empty', () => {
    expect(
      linkedinBrowserUrlMatchesMemberProfile(
        null,
        'https://www.linkedin.com/in/jane-doe',
      ),
    ).toBe('no_member_url');
  });

  it('returns match when slugs align', () => {
    expect(
      linkedinBrowserUrlMatchesMemberProfile(
        'https://www.linkedin.com/in/jane-doe',
        'https://linkedin.com/in/jane-doe/',
      ),
    ).toBe('match');
  });

  it('returns mismatch when slugs differ', () => {
    expect(
      linkedinBrowserUrlMatchesMemberProfile(
        'https://www.linkedin.com/in/user-a',
        'https://www.linkedin.com/in/user-b',
      ),
    ).toBe('mismatch');
  });

  it('returns no_browser_url when member has url but browser url missing', () => {
    expect(
      linkedinBrowserUrlMatchesMemberProfile(
        'https://www.linkedin.com/in/jane-doe',
        undefined,
      ),
    ).toBe('no_browser_url');
  });
});
