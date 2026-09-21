import { WorkflowAiFilteringService } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-filtering/workflow-ai-filtering.service';

describe('WorkflowAiFilteringService.processAndBuildResult', () => {
  it('merges processor enrichedData under aiFilter on each candidate', async () => {
    const processAiFilters = jest.fn().mockResolvedValue([
      {
        candidateId: 'sample-1',
        enrichedData: { isSeniorGtm: true, fitBand: 'strong' },
      },
      {
        candidateId: 'sample-2',
        enrichedData: { isSeniorGtm: false, fitBand: 'no' },
      },
    ]);

    const service = new WorkflowAiFilteringService(
      { processAiFilters } as never,
      {} as never,
      { add: jest.fn() } as never,
    );

    const result = await service.processAndBuildResult({
      candidates: [
        { id: 'sample-1', name: 'Arapa Hara', title: 'Head of Sales' },
        { id: 'sample-2', name: 'Jordan Lee', title: 'SDR' },
      ],
      filter: {
        name: 'SeniorGtm',
        prompt: 'Senior GTM only',
        selectedModel: 'typesafe-ai/jev',
        selectedMetadataFields: ['name', 'title'],
        fields: [
          { name: 'isSeniorGtm', type: 'boolean' },
          {
            name: 'fitBand',
            type: 'enum',
            enumValues: ['strong', 'maybe', 'no'],
          },
        ],
      },
    });

    expect(result.success).toBe(true);
    expect(result.total).toBe(2);
    expect(result.candidates[0].aiFilter).toEqual({
      isSeniorGtm: true,
      fitBand: 'strong',
    });
    expect(result.candidates[1].aiFilter).toEqual({
      isSeniorGtm: false,
      fitBand: 'no',
    });
    expect(processAiFilters).toHaveBeenCalledTimes(1);
  });
});
