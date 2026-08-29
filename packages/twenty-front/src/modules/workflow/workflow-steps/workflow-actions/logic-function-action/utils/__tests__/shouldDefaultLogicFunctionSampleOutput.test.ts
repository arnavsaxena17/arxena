import { shouldDefaultLogicFunctionSampleOutput } from '@/workflow/workflow-steps/workflow-actions/logic-function-action/utils/shouldDefaultLogicFunctionSampleOutput';
import {
  OUTREACH_SEARCH_PEOPLE_FOR_COMPANY_SAMPLE_OUTPUT,
  OUTREACH_SEARCH_PEOPLE_SAMPLE_OUTPUT,
} from '@/workflow/workflow-steps/workflow-actions/logic-function-action/constants/outreachNativeLogicFunctionSampleOutput';

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

  it('keeps a complete people-for-company sample', () => {
    expect(
      shouldDefaultLogicFunctionSampleOutput({
        logicFunctionName: 'search-people-for-company',
        expectedOutputSchema: OUTREACH_SEARCH_PEOPLE_FOR_COMPANY_SAMPLE_OUTPUT,
      }),
    ).toBe(false);
  });

  it('defaults search-people when the sample is a stub person hit', () => {
    expect(
      shouldDefaultLogicFunctionSampleOutput({
        logicFunctionName: 'search-people',
        expectedOutputSchema: {
          success: true,
          people: [{ name: 'Arapa Hara', title: 'Head of Sales' }],
        },
      }),
    ).toBe(true);
  });

  it('keeps a complete search-people sample', () => {
    expect(
      shouldDefaultLogicFunctionSampleOutput({
        logicFunctionName: 'search-people',
        expectedOutputSchema: OUTREACH_SEARCH_PEOPLE_SAMPLE_OUTPUT,
      }),
    ).toBe(false);
  });
});
