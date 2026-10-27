import { HarvestLinkedinTransformerService } from 'src/engine/core-modules/org-chart/services/harvest-linkedin-transformer.service';

describe('HarvestLinkedinTransformerService', () => {
  const transformer = new HarvestLinkedinTransformerService();

  it('should map a current lead with a nested location', () => {
    const [row] = transformer.transformCurrentLeadsToCandidates(
      [
        {
          id: 'ACw1',
          firstName: 'Asha',
          lastName: 'Rao',
          linkedinUrl: 'https://www.linkedin.com/in/asha',
          location: { linkedinText: 'Mumbai, India' },
          currentPositions: [
            {
              title: 'Plant Manager',
              companyName: 'Arvind Ltd',
              companyLinkedinUrl: 'https://www.linkedin.com/company/arvind',
            },
          ],
        },
      ],
      'Arvind',
    );

    expect(row).toMatchObject({
      name: 'Asha Rao',
      headline: 'Plant Manager',
      jobCompanyName: 'Arvind Ltd',
      jobCompanyLinkedinUrl: 'https://www.linkedin.com/company/arvind',
      locationName: 'Mumbai, India',
      linkedinUrl: 'https://www.linkedin.com/in/asha',
    });
  });

  it('should fall back to the chart company when the lead has no position', () => {
    const [row] = transformer.transformCurrentLeadsToCandidates(
      [{ firstName: 'Ravi' }],
      'Arvind',
      'https://www.linkedin.com/company/arvind',
    );

    expect(row).toMatchObject({
      name: 'Ravi',
      headline: '',
      jobCompanyName: 'Arvind',
      jobCompanyLinkedinUrl: 'https://www.linkedin.com/company/arvind',
      locationName: '',
    });
  });

  it('should prefer profile fields over lead fields for past leads', () => {
    const [row] = transformer.transformPastLeadsWithProfilesToCandidates(
      [
        {
          firstName: 'Old',
          lastName: 'Name',
          linkedinUrl: 'https://www.linkedin.com/in/lead',
          location: { linkedinText: 'Lead City' },
          org_harvest_profile: {
            element: {
              firstName: 'Meera',
              lastName: 'Shah',
              linkedinUrl: 'https://www.linkedin.com/in/meera',
              location: {
                linkedinText: 'Bengaluru, India',
                parsed: { countryFull: 'India', state: 'Karnataka' },
              },
              experience: [{ companyName: 'Arvind', position: 'Former VP' }],
            },
          },
        },
      ],
      'Arvind',
    );

    expect(row).toMatchObject({
      name: 'Meera Shah',
      headline: 'Former VP',
      linkedinUrl: 'https://www.linkedin.com/in/meera',
      locationName: 'Bengaluru, India',
      locationCountry: 'India',
      locationRegion: 'Karnataka',
    });
  });
});
