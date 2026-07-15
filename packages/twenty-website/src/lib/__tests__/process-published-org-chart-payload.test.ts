import { proxyOrgChartNodeImages } from '@/lib/process-published-org-chart-payload';
import type { OrgChartNodeData } from 'twenty-shared';

describe('proxyOrgChartNodeImages', () => {
  it('proxies indexed and allCandidates image fields', () => {
    const node = {
      key: 1,
      headline: 'Sales Team',
      image_0: 'https://media.licdn.com/dms/image/indexed.jpg',
      allCandidates: [
        {
          full_name: 'Arav Neroth',
          image: 'https://media.licdn.com/dms/image/candidate.jpg',
          profile_picture_url:
            'https://media.licdn.com/dms/image/profile-picture.jpg',
        },
      ],
    } as OrgChartNodeData;

    const proxied = proxyOrgChartNodeImages(node, 'https://arxena.com/api/org-chart');

    expect(proxied.image_0).toContain('/api/org-chart/image-proxy/');
    const candidate = proxied.allCandidates?.[0] as Record<string, string>;
    expect(candidate.image).toContain('/api/org-chart/image-proxy/');
    expect(candidate.profile_picture_url).toContain(
      '/api/org-chart/image-proxy/',
    );
  });
});
