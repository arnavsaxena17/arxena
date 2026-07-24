import {
    extractLinkedinProfileUrlFromOrgChartCandidateRow,
    extractProfilePictureUrlFromOrgChartCandidateRow,
} from './orgchart-candidate-linkedin-url.util';

describe('extractLinkedinProfileUrlFromOrgChartCandidateRow', () => {
  it('prefers camelCase linkedinUrl then snake_case linkedin_url', () => {
    expect(
      extractLinkedinProfileUrlFromOrgChartCandidateRow({
        linkedinUrl: 'https://www.linkedin.com/in/a',
        linkedin_url: 'https://www.linkedin.com/in/b',
      }),
    ).toBe('https://www.linkedin.com/in/a');
    expect(
      extractLinkedinProfileUrlFromOrgChartCandidateRow({
        linkedin_url: 'https://www.linkedin.com/in/snake',
      }),
    ).toBe('https://www.linkedin.com/in/snake');
  });

  it('reads linkedInUrl and public_profile_url used by some Apify payloads', () => {
    expect(
      extractLinkedinProfileUrlFromOrgChartCandidateRow({
        linkedInUrl: 'https://www.linkedin.com/in/mixed',
      }),
    ).toBe('https://www.linkedin.com/in/mixed');
    expect(
      extractLinkedinProfileUrlFromOrgChartCandidateRow({
        public_profile_url: 'https://www.linkedin.com/in/pub',
      }),
    ).toBe('https://www.linkedin.com/in/pub');
  });

  it('returns empty string when nothing matches', () => {
    expect(extractLinkedinProfileUrlFromOrgChartCandidateRow({})).toBe('');
  });
});

describe('extractProfilePictureUrlFromOrgChartCandidateRow', () => {
  it('reads profile_picture_url then Apify-style photo', () => {
    expect(
      extractProfilePictureUrlFromOrgChartCandidateRow({
        profile_picture_url: 'https://cdn.example/a.jpg',
        photo: 'https://cdn.example/b.jpg',
      }),
    ).toBe('https://cdn.example/a.jpg');
    expect(
      extractProfilePictureUrlFromOrgChartCandidateRow({
        photo: 'https://cdn.example/b.jpg',
      }),
    ).toBe('https://cdn.example/b.jpg');
  });

  it('reads profilePictureUrl and displayPicture from table-shaped rows', () => {
    expect(
      extractProfilePictureUrlFromOrgChartCandidateRow({
        profilePictureUrl: 'https://img/P.png',
      }),
    ).toBe('https://img/P.png');
    expect(
      extractProfilePictureUrlFromOrgChartCandidateRow({
        displayPicture: 'https://img/D.png',
      }),
    ).toBe('https://img/D.png');
  });
});
