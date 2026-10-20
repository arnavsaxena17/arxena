import {
  getCandidateProfileUrl,
  isLinkedinProfileUrl,
} from '@/candidate-table/utils/getCandidateProfileUrl';

describe('getCandidateProfileUrl', () => {
  it('reads people.linkedinLink from CRM candidate nodes', () => {
    expect(
      getCandidateProfileUrl({
        people: {
          linkedinLink: {
            primaryLinkUrl: 'https://www.linkedin.com/in/crm-person',
          },
        },
      }),
    ).toBe('https://www.linkedin.com/in/crm-person');
  });

  it('reads linkedinUrl from outreach / table rows', () => {
    expect(
      getCandidateProfileUrl({
        linkedinUrl: {
          primaryLinkUrl: 'https://www.linkedin.com/in/outreach-person',
        },
      }),
    ).toBe('https://www.linkedin.com/in/outreach-person');

    expect(
      getCandidateProfileUrl({
        linkedinUrl: 'https://www.linkedin.com/in/string-url',
      }),
    ).toBe('https://www.linkedin.com/in/string-url');
  });

  it('falls back to profileUrl then Naukri links', () => {
    expect(
      getCandidateProfileUrl({
        profileUrl: 'https://www.linkedin.com/in/profile-url',
      }),
    ).toBe('https://www.linkedin.com/in/profile-url');

    expect(
      getCandidateProfileUrl({
        people: {
          resdexNaukriUrl: {
            primaryLinkUrl: 'https://resdex.naukri.com/foo',
          },
        },
      }),
    ).toBe('https://resdex.naukri.com/foo');
  });

  it('returns empty string when no profile link exists', () => {
    expect(getCandidateProfileUrl(null)).toBe('');
    expect(getCandidateProfileUrl({})).toBe('');
  });
});

describe('isLinkedinProfileUrl', () => {
  it('detects LinkedIn /in/ URLs', () => {
    expect(isLinkedinProfileUrl('https://www.linkedin.com/in/someone')).toBe(
      true,
    );
    expect(isLinkedinProfileUrl('https://resdex.naukri.com/foo')).toBe(false);
  });
});
