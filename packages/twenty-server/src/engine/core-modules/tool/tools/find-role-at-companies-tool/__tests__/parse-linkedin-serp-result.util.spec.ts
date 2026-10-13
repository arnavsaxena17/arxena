import {
  normalizeLinkedinProfileUrl,
  parseLinkedinSerpResult,
} from 'src/engine/core-modules/tool/tools/find-role-at-companies-tool/parse-linkedin-serp-result.util';

describe('parseLinkedinSerpResult', () => {
  it('should split name, title and company', () => {
    expect(
      parseLinkedinSerpResult({
        title: 'Sanjay Goyal - Managing Director - Graviss Foods | LinkedIn',
        url: 'https://in.linkedin.com/in/sanjay-goyal-aaa675196',
      }),
    ).toMatchObject({
      name: 'Sanjay Goyal',
      title: 'Managing Director',
      companyName: 'Graviss Foods',
    });
  });

  it('should read "Title at Company"', () => {
    expect(
      parseLinkedinSerpResult({
        title: 'Keerthi D - Deputy CEO at Hatsun Agro Product Ltd | LinkedIn',
        url: 'https://www.linkedin.com/in/keerthi-d-785b21186',
      }),
    ).toMatchObject({
      name: 'Keerthi D',
      title: 'Deputy CEO',
      companyName: 'Hatsun Agro Product Ltd',
    });
  });

  it('should skip results that are not profiles', () => {
    expect(
      parseLinkedinSerpResult({
        title: 'Hatsun Agro - LinkedIn',
        url: 'https://www.linkedin.com/company/hatsun-agro',
      }),
    ).toBeNull();
    expect(
      parseLinkedinSerpResult({
        title: 'Someone',
        url: 'https://example.com/in/someone',
      }),
    ).toBeNull();
  });
});

describe('normalizeLinkedinProfileUrl', () => {
  it('should make country subdomains and trailing slashes compare equal', () => {
    expect(
      normalizeLinkedinProfileUrl('https://in.linkedin.com/in/Amruta-Kawre/'),
    ).toBe(normalizeLinkedinProfileUrl('https://www.linkedin.com/in/amruta-kawre'));
  });
});
