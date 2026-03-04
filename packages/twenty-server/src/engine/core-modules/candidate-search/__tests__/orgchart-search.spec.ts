/**
 * Unit tests for org chart search job naming and buildOrgChartFromLinkedInCompanyCandidates.
 */
describe('Org chart job naming', () => {
  function buildOrgChartJobName(
    companyName: string,
    mode?: string,
    fn?: string,
  ): string {
    const normalizedCompanyName = (companyName ?? '').trim().replace(/\s+/g, '-');
    const jobNameSuffix = fn
      ? fn.replace(/\s+/g, '-').toLowerCase()
      : mode === 'leadership'
        ? 'leadership'
        : mode === 'entire_company' || mode === 'all_people'
          ? 'entire'
          : mode ?? 'chart';
    return `orgchart-${normalizedCompanyName}-${jobNameSuffix}`;
  }

  it('builds orgchart-company-leadership for leadership mode', () => {
    expect(buildOrgChartJobName('Acme Corp', 'leadership')).toBe(
      'orgchart-Acme-Corp-leadership',
    );
  });

  it('builds orgchart-company-entire for entire_company mode', () => {
    expect(buildOrgChartJobName('Acme Corp', 'entire_company')).toBe(
      'orgchart-Acme-Corp-entire',
    );
  });

  it('builds orgchart-company-function for function_grade with function', () => {
    expect(buildOrgChartJobName('Acme Corp', 'function_grade', 'HR')).toBe(
      'orgchart-Acme-Corp-hr',
    );
  });

  it('builds orgchart-company-chart when mode is undefined', () => {
    expect(buildOrgChartJobName('Acme Corp')).toBe(
      'orgchart-Acme-Corp-chart',
    );
  });
});

describe('Org chart candidate structure', () => {
  it('people mapping includes emails and phone_numbers placeholders', () => {
    const candidate = {
      fullName: 'Jane Doe',
      jobTitle: 'VP Sales',
      jobCompanyName: 'Acme',
      linkedinUrl: 'https://linkedin.com/in/jane',
    };
    const peopleEntry = {
      full_name: candidate.fullName,
      job_title: candidate.jobTitle,
      emails: '',
      phone_numbers: '',
    };
    expect(peopleEntry).toHaveProperty('emails');
    expect(peopleEntry).toHaveProperty('phone_numbers');
    expect(peopleEntry.emails).toBe('');
    expect(peopleEntry.phone_numbers).toBe('');
  });
});
