import { LinkedinXrayService } from 'src/modules/linkedin-xray/linkedin-xray.service';

const buildService = ({
  jobTitle,
  expandTitles,
}: {
  jobTitle: string;
  expandTitles?: jest.Mock;
}) => {
  const service = new LinkedinXrayService(
    {} as never,
    expandTitles === undefined ? undefined : ({ expandTitles } as never),
  );

  jest
    .spyOn(
      service as unknown as {
        parseRawLinkedinXrayQueryWithLlm: () => Promise<unknown>;
      },
      'parseRawLinkedinXrayQueryWithLlm',
    )
    .mockResolvedValue({
      country: 'india',
      job_title: jobTitle,
      include_keywords: '',
      exclude_keywords: [],
      education: '',
      current_employer: 'Acme',
    });

  return service;
};

const CEO_EXPANSION = jest.fn(async () => ({
  titles: ['ceo', 'chief executive', 'managing director'],
  added: ['chief executive', 'managing director'],
  taxonomyAvailable: true,
}));

describe('LinkedinXrayService title expansion', () => {
  it('should search the titles the taxonomy files with a plain title', async () => {
    const result = await buildService({
      jobTitle: 'ceo',
      expandTitles: CEO_EXPANSION,
    }).parseRawQuery('ceo of Acme in India');

    expect(result.query.q).toContain(
      '"ceo" OR "chief executive" OR "managing director"',
    );
    expect(result.titleExpansion.added).toEqual([
      'chief executive',
      'managing director',
    ]);
    expect(result.parsedBuilderFields.jobTitle).toBe('ceo');
  });

  it('should use a boolean title string as typed', async () => {
    const expandTitles = jest.fn();
    const result = await buildService({
      jobTitle: '(VP OR Head) AND Sales',
      expandTitles,
    }).parseRawQuery('vp or head of sales at Acme');

    expect(expandTitles).not.toHaveBeenCalled();
    expect(result.titleExpansion.added).toEqual([]);
  });

  it('should keep the parsed title when the taxonomy fails', async () => {
    const result = await buildService({
      jobTitle: 'ceo',
      expandTitles: jest.fn().mockRejectedValue(new Error('down')),
    }).parseRawQuery('ceo of Acme');

    expect(result.query.q).toContain('"ceo"');
    expect(result.titleExpansion.added).toEqual([]);
  });

  it('should work with no taxonomy service at all', async () => {
    const result = await buildService({ jobTitle: 'ceo' }).parseRawQuery(
      'ceo of Acme',
    );

    expect(result.query.q).toContain('"ceo"');
  });
});
