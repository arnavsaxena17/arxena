import { JobSearchHitTransformer } from '../job-search-hit.transformer';

describe('JobSearchHitTransformer', () => {
  const transformer = new JobSearchHitTransformer();

  it('maps Unipile jobs including nested company', () => {
    expect(
      transformer.fromUnipileItem({
        id: 'job-1',
        title: 'Account Executive',
        location: 'San Francisco',
        url: 'https://www.linkedin.com/jobs/view/1',
        posted_at: '2026-08-01',
        company: { name: 'Acme' },
      }),
    ).toEqual({
      id: 'job-1',
      title: 'Account Executive',
      location: 'San Francisco',
      url: 'https://www.linkedin.com/jobs/view/1',
      companyName: 'Acme',
      postedAt: '2026-08-01',
    });
  });

  it('maps Harvest jobs', () => {
    expect(
      transformer.fromHarvestItem({
        id: 'h1',
        jobTitle: 'Engineer',
        location: 'Remote',
        jobUrl: 'https://www.linkedin.com/jobs/view/2',
        companyName: 'Acme',
        postedDate: '2026-08-02',
      }),
    ).toMatchObject({
      title: 'Engineer',
      url: 'https://www.linkedin.com/jobs/view/2',
      companyName: 'Acme',
    });
  });
});
