import { shouldDefaultLogicFunctionSampleOutput } from '@/workflow/workflow-steps/workflow-actions/logic-function-action/utils/shouldDefaultLogicFunctionSampleOutput';
import { GTM_SEARCH_PEOPLE_SAMPLE_OUTPUT } from '@/workflow/workflow-steps/workflow-actions/logic-function-action/constants/gtmNativeLogicFunctionSampleOutput';

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
        expectedOutputSchema: {
          success: true,
          total: 1,
          dataSource: 'unipile',
          projectId: 'project-id',
          error: '',
          people: [
            {
              name: 'Arapa Hara',
              firstName: 'Arapa',
              lastName: 'Hara',
              title: 'Head of Sales',
              headline: 'Head of Sales at Acme',
              company: 'Acme',
              location: 'San Francisco',
              linkedinUrl: 'https://www.linkedin.com/in/example',
              linkedinProfileId: 'example',
              peopleId: 'ACwAAAExample',
              profilePictureUrl: '',
              source: 'linkedin_sales_navigator',
              stdFunction: 'sales',
              stdFunctionRoot: 'go-to-market',
              stdGrade: 'leadership',
            },
          ],
        },
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
        expectedOutputSchema: GTM_SEARCH_PEOPLE_SAMPLE_OUTPUT,
      }),
    ).toBe(false);
  });
});
