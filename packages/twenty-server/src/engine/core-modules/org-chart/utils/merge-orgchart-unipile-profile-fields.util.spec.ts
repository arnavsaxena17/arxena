import {
  extractUnipileProfileFieldsFromSearchRow,
  mergeOrgChartUnipileProfileFieldsOntoOrgChartData,
} from './merge-orgchart-unipile-profile-fields.util';
import { normalizeOrgChartLinkedinUrlKey } from './merge-orgchart-profile-source-slugs.util';

describe('mergeOrgChartUnipileProfileFieldsOntoOrgChartData', () => {
  it('merges Unipile fields onto candidates by LinkedIn URL', () => {
    const byUrl = new Map([
      [
        normalizeOrgChartLinkedinUrlKey('https://www.linkedin.com/in/jane'),
        {
          network_distance: 'DISTANCE_2',
          premium: true,
          shared_connections_count: 12,
          followers_count: 400,
          location_name: 'Bengaluru',
          location_country: 'India',
        },
      ],
    ]);

    const out = mergeOrgChartUnipileProfileFieldsOntoOrgChartData(
      {
        orgchart: [
          {
            key: 1,
            candidates: [
              {
                full_name: 'Jane Doe',
                linkedin_url: 'https://www.linkedin.com/in/jane',
              },
            ],
          },
        ],
      },
      byUrl,
      new Map(),
    );

    const candidates = (out.orgchart as Array<{ candidates: Array<Record<string, unknown>> }>)[0]
      .candidates;
    expect(candidates[0].network_distance).toBe('DISTANCE_2');
    expect(candidates[0].premium).toBe(true);
    expect(candidates[0].shared_connections_count).toBe(12);
    expect(candidates[0].location_name).toBe('Bengaluru');
  });
});

describe('extractUnipileProfileFieldsFromSearchRow', () => {
  it('reads camelCase and snake_case Unipile fields', () => {
    const fields = extractUnipileProfileFieldsFromSearchRow({
      networkDistance: 'DISTANCE_1',
      open_profile: true,
      connections_count: 500,
      locationName: 'Mumbai',
      country: 'India',
    });
    expect(fields.network_distance).toBe('DISTANCE_1');
    expect(fields.open_profile).toBe(true);
    expect(fields.connections_count).toBe(500);
    expect(fields.location_name).toBe('Mumbai');
    expect(fields.location_country).toBe('India');
  });
});
