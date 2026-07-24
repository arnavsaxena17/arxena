import {
  buildPersonProfileFromParsedCv,
  extractLinkedinProfileUrlFromText,
  resolveCurrentCompanyFromParsedCv,
  resolveLinkedinUrlFromResume,
} from './resume-linkedin.util';

describe('resume-linkedin.util', () => {
  it('extracts LinkedIn /in/ URLs from resume text', () => {
    const url = extractLinkedinProfileUrlFromText(
      'Contact me at https://www.linkedin.com/in/prince-kumar-123 and email a@b.com',
    );
    console.log('extractLinkedinProfileUrlFromText:', url);
    expect(url).toBe('https://www.linkedin.com/in/prince-kumar-123');
  });

  it('handles country subdomain LinkedIn URLs', () => {
    const url = extractLinkedinProfileUrlFromText(
      'in.linkedin.com/in/varunchojhar/',
    );
    console.log('country subdomain url:', url);
    expect(url).toBe('https://www.linkedin.com/in/varunchojhar');
  });

  it('returns undefined when no LinkedIn URL is present', () => {
    expect(extractLinkedinProfileUrlFromText('No social links here')).toBeUndefined();
  });

  it('prefers parsed linkedinUrl over raw text scan', () => {
    const resolved = resolveLinkedinUrlFromResume({
      parsed: {
        linkedinUrl: 'https://www.linkedin.com/in/from-parser',
      },
      resumeText: 'also https://www.linkedin.com/in/from-text',
    });
    console.log('resolveLinkedinUrlFromResume prefers parsed:', resolved);
    expect(resolved).toBe('https://www.linkedin.com/in/from-parser');
  });

  it('falls back to resume text when parsed fields lack LinkedIn', () => {
    const resolved = resolveLinkedinUrlFromResume({
      parsed: { profileUrl: 'https://github.com/someone' },
      resumeText: 'LinkedIn: linkedin.com/in/fallback-slug',
    });
    console.log('resolveLinkedinUrlFromResume fallback:', resolved);
    expect(resolved).toBe('https://www.linkedin.com/in/fallback-slug');
  });

  it('builds a person profile from parsed CV', () => {
    const profile = buildPersonProfileFromParsedCv(
      {
        firstName: 'Prince',
        lastName: 'Kumar',
        location: 'Bangalore',
        skills: 'Sales, CRM',
        workExperience: [
          {
            jobTitle: 'Account Executive',
            company: 'Acme Corp',
            location: 'Bangalore',
            duration: '2023 - Present',
            jobSummary: 'Enterprise SaaS sales',
          },
        ],
      },
      'Prince Kumar\nAccount Executive at Acme Corp',
    );
    console.log('buildPersonProfileFromParsedCv:', profile);
    expect(profile.first_name).toBe('Prince');
    expect(profile.last_name).toBe('Kumar');
    expect(profile.headline).toBe('Account Executive @ Acme Corp');
    expect(Array.isArray(profile.work_experience)).toBe(true);
    expect((profile.work_experience as unknown[])[0]).toMatchObject({
      company: 'Acme Corp',
      position: 'Account Executive',
    });
  });

  it('resolves current company from first work experience entry', () => {
    const current = resolveCurrentCompanyFromParsedCv({
      workExperience: [
        { company: 'Acme Corp', jobTitle: 'AE', location: 'IN' },
        { company: 'Old Co', jobTitle: 'SDR' },
      ],
    });
    console.log('resolveCurrentCompanyFromParsedCv:', current);
    expect(current).toEqual({
      companyName: 'Acme Corp',
      role: 'AE',
      location: 'IN',
    });
  });
});
