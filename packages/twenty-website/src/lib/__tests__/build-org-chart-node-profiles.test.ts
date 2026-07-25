import {
  buildOrgChartNodeProfiles,
  extractCandidateLocation,
} from '@/lib/build-org-chart-node-profiles';
import type { OrgChartNodeData } from 'twenty-shared/utils';

describe('buildOrgChartNodeProfiles', () => {
  it('extracts location from location_name', () => {
    expect(
      extractCandidateLocation({
        location_name: 'pune, maharashtra, india',
      }),
    ).toBe('Pune, Maharashtra, India');
  });

  it('builds location from locality, region, and country', () => {
    expect(
      extractCandidateLocation({
        location_locality: 'bengaluru',
        location_region: 'karnataka',
        location_country: 'india',
      }),
    ).toBe('Bengaluru, Karnataka, India');
  });

  it('includes image and location from allCandidates', () => {
    const node = {
      key: 1,
      headline: 'Sales Team',
      allCandidates: [
        {
          full_name: 'Arav Neroth',
          job_title: 'Business Analyst',
          location_name: 'mumbai, maharashtra, india',
          image: 'https://media.licdn.com/dms/image/example.jpg',
        },
      ],
    } as OrgChartNodeData;

    const profiles = buildOrgChartNodeProfiles(node, 'Dista');

    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toMatchObject({
      fullName: 'Arav Neroth',
      headline: 'Business Analyst',
      company: 'Dista',
      location: 'Mumbai, Maharashtra, India',
      imageUrl: 'https://media.licdn.com/dms/image/example.jpg',
    });
  });

  it('falls back to node country for indexed candidates', () => {
    const node = {
      key: 2,
      headline: 'Engineering',
      country: 'colombia',
      name_0: 'Jatin Gupta',
      title_0: 'Engineer',
      image_0: 'https://media.licdn.com/dms/image/example-2.jpg',
    } as OrgChartNodeData;

    const profiles = buildOrgChartNodeProfiles(node, 'Dista');

    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toMatchObject({
      fullName: 'Jatin Gupta',
      location: 'Colombia',
      imageUrl: 'https://media.licdn.com/dms/image/example-2.jpg',
    });
  });
});
