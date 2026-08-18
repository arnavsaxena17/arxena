import { shouldDefaultLogicFunctionSampleOutput } from '@/workflow/workflow-steps/workflow-actions/logic-function-action/utils/shouldDefaultLogicFunctionSampleOutput';

describe('shouldDefaultLogicFunctionSampleOutput', () => {
  it('defaults when no sample is set', () => {
    expect(
      shouldDefaultLogicFunctionSampleOutput({
        logicFunctionName: 'search-people-for-company',
        expectedOutputSchema: {},
      }),
    ).toBe(true);
  });

  it('defaults search-people-for-company when the sample has no people array', () => {
    expect(
      shouldDefaultLogicFunctionSampleOutput({
        logicFunctionName: 'search-people-for-company',
        expectedOutputSchema: { lastName: 'Hara', firstName: 'Arapa' },
      }),
    ).toBe(true);
  });

  it('keeps a valid people sample', () => {
    expect(
      shouldDefaultLogicFunctionSampleOutput({
        logicFunctionName: 'search-people-for-company',
        expectedOutputSchema: {
          people: [{ name: 'Arapa Hara' }],
        },
      }),
    ).toBe(false);
  });
});
