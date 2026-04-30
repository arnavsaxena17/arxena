import {
    applyAsOfSnapshotToCandidates,
    deriveIntervalsForCandidateAtCompany,
    isActiveInMonth,
    pickTitleAtMonth,
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

