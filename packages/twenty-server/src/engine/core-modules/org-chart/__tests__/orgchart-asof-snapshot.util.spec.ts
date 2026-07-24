import {
    applyAsOfSnapshotToCandidates,
    applyEntireCompanyExperienceTitlesToCandidates,
    companyTenureFromDerivedExperience,
    deriveIntervalsForCandidateAtCompany,
    isActiveInMonth,
    pickTitleAtMonth,
    pickTitleForEntireCompanyFromIntervals,
} from '../utils/orgchart-asof-snapshot.util';
import { computeTimelineProfilesFromCandidates } from '../utils/orgchart-timeline-metrics.util';

describe('orgchart-asof-snapshot.util', () => {
  it('derives ContactOut intervals and treats endMonth as inclusive', () => {
    const row = {
      org_contactout_experience: [
        {
          company_name: 'Acme',
          title: 'Engineer I',
          start_date_year: 2023,
          start_date_month: 2,
          end_date_year: 2023,
          end_date_month: 6,
          is_current: false,
        },
      ],
    } as unknown as Record<string, unknown>;

    const intervals = deriveIntervalsForCandidateAtCompany({
      row,
      companyName: 'Acme',
    });
    expect(intervals).toHaveLength(1);
    expect(isActiveInMonth(intervals as any, '2023-06')).toBe(true);
    expect(isActiveInMonth(intervals as any, '2023-07')).toBe(false);
  });

  it('matches Apify experience by LinkedIn company URL when display name differs', () => {
    const targetUrl = 'https://www.linkedin.com/company/12345';
    const row = {
      org_apify_experience: [
        {
          companyName: 'ACME Inc — different from search name',
          companyLinkedinUrl: 'https://www.linkedin.com/company/12345/',
          position: 'Engineer at target co',
          startDate: { year: 2023, month: 'Jan' },
          endDate: { year: 2023, month: 'Dec', text: 'Dec 2023' },
        },
      ],
    } as unknown as Record<string, unknown>;

    const byNameOnly = deriveIntervalsForCandidateAtCompany({
      row,
      companyName: 'Acme Corp',
    });
    expect(byNameOnly).toHaveLength(0);

    const withUrl = deriveIntervalsForCandidateAtCompany({
      row,
      companyName: 'Acme Corp',
      companyLinkedinUrl: targetUrl,
    });
    expect(withUrl).toHaveLength(1);
    expect(pickTitleAtMonth(withUrl as any, '2023-06')).toBe(
      'Engineer at target co',
    );
  });

  it('picks latest-start active title for a month', () => {
    const row = {
      org_contactout_experience: [
        {
          company_name: 'Acme',
          title: 'Engineer I',
          start_date_year: 2023,
          start_date_month: 1,
          end_date_year: 2023,
          end_date_month: 12,
          is_current: false,
        },
        {
          company_name: 'Acme',
          title: 'Senior Engineer',
          start_date_year: 2023,
          start_date_month: 8,
          is_current: true,
        },
      ],
    } as unknown as Record<string, unknown>;

    const intervals = deriveIntervalsForCandidateAtCompany({
      row,
      companyName: 'Acme',
    });
    expect(pickTitleAtMonth(intervals as any, '2023-07')).toBe('Engineer I');
    expect(pickTitleAtMonth(intervals as any, '2023-10')).toBe('Senior Engineer');
  });

  it('pickTitleForEntireCompanyFromIntervals prefers ongoing stint over past', () => {
    const intervals = [
      { startMonth: '2020-01', endMonth: '2022-06', title: 'Past Role' },
      { startMonth: '2023-01', endMonth: null, title: 'Current Role' },
    ];
    expect(pickTitleForEntireCompanyFromIntervals(intervals)).toBe('Current Role');
  });

  it('pickTitleForEntireCompanyFromIntervals picks latest-ended stint when none ongoing', () => {
    const intervals = [
      { startMonth: '2018-01', endMonth: '2020-03', title: 'Old' },
      { startMonth: '2021-06', endMonth: '2023-12', title: 'Recent Past' },
    ];
    expect(pickTitleForEntireCompanyFromIntervals(intervals)).toBe('Recent Past');
  });

  it('companyTenureFromDerivedExperience returns current when an open stint exists', () => {
    const row = {
      org_contactout_experience: [
        {
          company_name: 'Acme',
          title: 'VP',
          start_date_year: 2024,
          start_date_month: 1,
          is_current: true,
        },
      ],
    } as unknown as Record<string, unknown>;
    expect(
      companyTenureFromDerivedExperience({
        row,
        companyName: 'Acme',
      }),
    ).toBe('current');
  });

  it('companyTenureFromDerivedExperience returns past when only ended stints exist', () => {
    const row = {
      org_contactout_experience: [
        {
          company_name: 'Acme',
          title: 'VP',
          start_date_year: 2020,
          start_date_month: 1,
          end_date_year: 2022,
          end_date_month: 6,
          is_current: false,
        },
      ],
    } as unknown as Record<string, unknown>;
    expect(
      companyTenureFromDerivedExperience({
        row,
        companyName: 'Acme',
      }),
    ).toBe('past');
  });

  it('applyEntireCompanyExperienceTitlesToCandidates overwrites titles from matching experience', () => {
    const candidates: Array<Record<string, unknown>> = [
      {
        name: 'A',
        headline: 'CEO at OtherCo',
        jobTitle: 'CEO at OtherCo',
        org_contactout_experience: [
          {
            company_name: 'Acme',
            title: 'VP Engineering',
            start_date_year: 2024,
            start_date_month: 1,
            is_current: true,
          },
        ],
      },
    ];
    const out = applyEntireCompanyExperienceTitlesToCandidates({
      candidates,
      companyName: 'Acme',
    });
    expect(out).toHaveLength(1);
    expect(out[0].headline).toBe('VP Engineering');
    expect(out[0].job_title).toBe('VP Engineering');
  });

  it('filters candidates to those active at asOfMonth and overwrites title fields', () => {
    const candidates: Array<Record<string, unknown>> = [
      {
        name: 'A',
        title: 'Old',
        org_contactout_experience: [
          {
            company_name: 'Acme',
            title: 'Engineer',
            start_date_year: 2024,
            start_date_month: 1,
            is_current: true,
          },
        ],
      },
      {
        name: 'B',
        title: 'Old',
        org_contactout_experience: [
          {
            company_name: 'Acme',
            title: 'Left',
            start_date_year: 2023,
            start_date_month: 1,
            end_date_year: 2023,
            end_date_month: 12,
            is_current: false,
          },
        ],
      },
    ];

    const asOf = applyAsOfSnapshotToCandidates({
      candidates,
      companyName: 'Acme',
      asOfMonth: '2024-02',
    });
    expect(asOf).toHaveLength(1);
    expect(asOf[0].name).toBe('A');
    expect(asOf[0].title).toBe('Engineer');
  });

  it('timeline profiles include linkedinUrl and profilePictureUrl from table-shaped rows', () => {
    const candidates: Array<Record<string, unknown>> = [
      {
        id: '1',
        name: 'A',
        linkedinUrl: 'https://www.linkedin.com/in/a',
        profilePictureUrl: 'https://img/p.png',
        org_contactout_experience: [
          {
            company_name: 'Acme',
            title: 'Engineer',
            start_date_year: 2024,
            start_date_month: 2,
            is_current: true,
          },
        ],
      },
    ];
    const out = computeTimelineProfilesFromCandidates({
      candidates,
      companyName: 'Acme',
      asOfMonth: '2024-02',
      event: 'current',
      window: '1m',
    });
    expect(out.total).toBe(1);
    expect(out.profiles[0]?.linkedinUrl).toBe('https://www.linkedin.com/in/a');
    expect(out.profiles[0]?.profilePictureUrl).toBe('https://img/p.png');
  });

  it('returns profile rows for joined event', () => {
    const candidates: Array<Record<string, unknown>> = [
      {
        id: '1',
        name: 'A',
        linkedin_url: 'https://www.linkedin.com/in/a',
        org_contactout_experience: [
          {
            company_name: 'Acme',
            title: 'Engineer',
            start_date_year: 2024,
            start_date_month: 2,
            is_current: true,
          },
        ],
      },
    ];
    const out = computeTimelineProfilesFromCandidates({
      candidates,
      companyName: 'Acme',
      asOfMonth: '2024-02',
      event: 'joined',
      window: '1m',
    });
    expect(out.total).toBe(1);
    expect(out.profiles[0]?.fullName).toBe('A');
  });
});

