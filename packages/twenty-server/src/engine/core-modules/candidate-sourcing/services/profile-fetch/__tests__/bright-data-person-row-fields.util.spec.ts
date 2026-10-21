import { brightDataRecordToPersonOtherFields } from 'src/engine/core-modules/candidate-sourcing/services/profile-fetch/bright-data-person-row-fields.util';

describe('brightDataRecordToPersonOtherFields', () => {
  it('maps people-search bags into profile and flat otherFields', () => {
    const { otherFields, profile } = brightDataRecordToPersonOtherFields({
      about: 'Founder',
      url: 'https://www.linkedin.com/in/ada',
      connections: 500,
      past_job_titles: 'Analyst',
      past_company_names: 'Acme',
      education_schools: 'IGNOU',
    });

    expect(profile?.experience).toBe('Analyst @ Acme');
    expect(profile?.education).toBe('IGNOU');
    expect(otherFields.connections).toBe(500);
    expect(otherFields.workExperience).toEqual([
      { role: 'Analyst', company: 'Acme' },
    ]);
    expect(otherFields.profile).toBeDefined();
  });

  it('maps scrape experience arrays the same way', () => {
    const { otherFields, profile } = brightDataRecordToPersonOtherFields({
      about: 'CEO',
      experience: [{ title: 'CEO', company: 'Acme' }],
      education: [{ title: 'IIT', end_year: '2001' }],
      connections: 200,
    });

    expect(profile?.experience).toContain('CEO @ Acme');
    expect(otherFields.workExperience).toEqual([
      { role: 'CEO', company: 'Acme' },
    ]);
    expect(otherFields.education).toEqual([{ school: 'IIT', degree: '' }]);
    expect(otherFields.connections).toBe(200);
  });
});
