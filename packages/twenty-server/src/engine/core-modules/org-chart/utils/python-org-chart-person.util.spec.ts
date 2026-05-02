import { normalizePersonForPythonOrgChartBuild } from './python-org-chart-person.util';

describe('normalizePersonForPythonOrgChartBuild', () => {
  it('maps camelCase linkedinUrl and profilePictureUrl for Python org-chart rebuild (as-of)', () => {
    const normalized = normalizePersonForPythonOrgChartBuild(
      {
        name: 'Jane Doe',
        job_title: 'Engineer',
        linkedinUrl: 'https://www.linkedin.com/in/jane',
        profilePictureUrl: 'https://cdn.example/p.jpg',
      },
      { companyId: 'acme', companyName: 'Acme' },
    );

    expect(normalized.linkedin_url).toBe('https://www.linkedin.com/in/jane');
    expect(normalized.profile_picture_url).toBe('https://cdn.example/p.jpg');
  });

  it('maps Apify-style photo when profile_picture_url is absent', () => {
    const normalized = normalizePersonForPythonOrgChartBuild(
      {
        full_name: 'John Smith',
        job_title: 'PM',
        photo: 'https://media.apify/p.png',
      },
      { companyId: 'co', companyName: 'Co' },
    );

    expect(normalized.profile_picture_url).toBe('https://media.apify/p.png');
  });
});
