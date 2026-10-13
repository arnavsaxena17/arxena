import { JobTitleExpanderService } from 'src/engine/core-modules/candidate-search/services/job-title-expander.service';
import { type ParsedRequirement } from 'src/engine/core-modules/candidate-search/schemas/parsed-requirement.schema';

const buildService = (expandTitles?: jest.Mock) => {
  const streamProcessingService = {
    executeStreamingLlmCall: jest.fn(async () => ({
      content: JSON.stringify({ titles: ['CEO', 'Chief Executive'] }),
    })),
    createStreamingCompletion: jest.fn(),
  };

  return new JobTitleExpanderService(
    streamProcessingService as never,
    expandTitles === undefined ? undefined : ({ expandTitles } as never),
  );
};

const requirement = (overrides: Partial<ParsedRequirement>) =>
  ({
    primary_role_name: 'CEO',
    requires_job_title_expansion: true,
    ...overrides,
  }) as ParsedRequirement;

describe('JobTitleExpanderService taxonomy titles', () => {
  it('should append taxonomy titles the model did not give', async () => {
    const result = await buildService(
      jest.fn(async () => ({
        titles: ['ceo', 'chief executive', 'managing director'],
        added: ['chief executive', 'managing director'],
        taxonomyAvailable: true,
      })),
    ).expandJobTitles(requirement({}), {} as never);

    expect(result.titles).toEqual([
      'CEO',
      'Chief Executive',
      'managing director',
    ]);
  });

  it('should not expand a broad request', async () => {
    const expandTitles = jest.fn();
    const result = await buildService(expandTitles).expandJobTitles(
      requirement({ requires_job_title_expansion: false }),
      {} as never,
    );

    expect(expandTitles).not.toHaveBeenCalled();
    expect(result.titles).toEqual(['CEO', 'Chief Executive']);
  });

  it('should keep the model titles when the taxonomy fails', async () => {
    const result = await buildService(
      jest.fn().mockRejectedValue(new Error('down')),
    ).expandJobTitles(requirement({}), {} as never);

    expect(result.titles).toEqual(['CEO', 'Chief Executive']);
  });
});
