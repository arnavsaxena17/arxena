import { applyGtmNativeLogicFunctionInputSchema } from '@/workflow/workflow-steps/workflow-actions/logic-function-action/utils/applyGtmNativeLogicFunctionInputSchema';
import { type InputSchema } from 'twenty-shared/workflow';

describe('applyGtmNativeLogicFunctionInputSchema', () => {
  const leftoverUploadProfilesSchema: InputSchema = [
    {
      type: 'object',
      properties: {
        projectId: { type: 'string', label: 'Project ID' },
        people: { type: 'array', label: 'People' },
        candidates: { type: 'array', label: 'Candidates' },
        recruiterId: { type: 'string', label: 'Recruiter ID' },
        workspaceMemberId: { type: 'string', label: 'Workspace member ID' },
        limit: { type: 'number', label: 'Limit' },
      },
    },
  ];

  it('keeps only project, company, people, and limit for upload-profiles', () => {
    const result = applyGtmNativeLogicFunctionInputSchema(
      'upload-profiles',
      leftoverUploadProfilesSchema,
    );

    expect(Object.keys(result?.[0].properties ?? {})).toEqual([
      'projectId',
      'companyId',
      'people',
      'limit',
    ]);
    expect(result?.[0].properties?.projectId).toEqual({
      type: 'record',
      label: 'Project',
      objectNameSingular: 'project',
    });
  });

  it('leaves other logic functions unchanged', () => {
    expect(
      applyGtmNativeLogicFunctionInputSchema(
        'search-people-for-company',
        leftoverUploadProfilesSchema,
      ),
    ).toBe(leftoverUploadProfilesSchema);
  });
});
