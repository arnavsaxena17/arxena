import { WorkflowAiFilteringTestService } from 'src/engine/core-modules/workflow/services/workflow-ai-filtering-test.service';

describe('WorkflowAiFilteringTestService', () => {
  it('returns failure when prompt is empty', async () => {
    const service = new WorkflowAiFilteringTestService({
      processAndBuildResult: jest.fn(),
    } as never);

    const result = await service.test({
      prompt: '   ',
      fields: [{ name: 'isSeniorGtm', type: 'boolean' }],
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Prompt');
  });

  it('returns enriched fixture candidates from processor wrapper', async () => {
    const processAndBuildResult = jest.fn().mockResolvedValue({
      success: true,
      total: 2,
      candidates: [
        {
          id: 'sample-1',
          name: 'Arapa Hara',
          aiFilter: { isSeniorGtm: true },
        },
      ],
    });

    const service = new WorkflowAiFilteringTestService({
      processAndBuildResult,
    } as never);

    const result = await service.test({
      prompt: 'Senior GTM only',
      selectedModel: 'typesafe-ai/jev',
      fields: [{ name: 'isSeniorGtm', type: 'boolean' }],
    });

    expect(result.success).toBe(true);
    expect(result.result).toMatchObject({ total: 2 });
    expect(processAndBuildResult).toHaveBeenCalled();
  });
});
