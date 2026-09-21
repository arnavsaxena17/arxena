import { readPersonTitleCompanyFromCandidate } from 'src/database/commands/upgrade-version-command/2-25/utils/read-person-title-company-from-candidate.util';

describe('readPersonTitleCompanyFromCandidate', () => {
  it('prefers candidate columns over otherFields', () => {
    expect(
      readPersonTitleCompanyFromCandidate({
        jobTitle: 'VP Engineering',
        jobCompanyName: 'Acme',
        otherFields: {
          job_title: 'Ignored Title',
          job_company_name: 'Ignored Co',
        },
      }),
    ).toEqual({
      jobTitle: 'VP Engineering',
      jobCompanyName: 'Acme',
    });
  });

  it('reads job title and company from otherFields aliases', () => {
    expect(
      readPersonTitleCompanyFromCandidate({
        otherFields: {
          linkedin_headline: 'Head of Growth at Projective',
          job_company_name: 'Projective',
        },
      }),
    ).toEqual({
      jobTitle: 'Head of Growth at Projective',
      jobCompanyName: 'Projective',
    });
  });

  it('returns empty when nothing usable is present', () => {
    expect(
      readPersonTitleCompanyFromCandidate({
        jobTitle: '  ',
        otherFields: { unrelated: 'x' },
      }),
    ).toEqual({});
  });
});
