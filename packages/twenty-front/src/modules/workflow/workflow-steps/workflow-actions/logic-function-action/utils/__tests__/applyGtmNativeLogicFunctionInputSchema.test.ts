import {
  applyGtmNativeLogicFunctionInputSchema,
  getGtmNativeLogicFunctionFormFields,
  normalizeGtmNativeLogicFunctionInput,
} from '@/workflow/workflow-steps/workflow-actions/logic-function-action/utils/applyGtmNativeLogicFunctionInputSchema';
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

  it('adds job title and keeps company/project/limit for search-people-for-company', () => {
    const leftoverSearchPeopleForCompanySchema: InputSchema = [
      {
        type: 'object',
        properties: {
          companyId: {
            type: 'record',
            label: 'Company',
            objectNameSingular: 'company',
          },
          projectId: {
            type: 'record',
            label: 'Project',
            objectNameSingular: 'project',
          },
          limit: { type: 'number', label: 'Limit' },
        },
      },
    ];

    const result = applyGtmNativeLogicFunctionInputSchema(
      'search-people-for-company',
      leftoverSearchPeopleForCompanySchema,
    );

    expect(Object.keys(result?.[0].properties ?? {})).toEqual([
      'companyId',
      'projectId',
      'jobTitle',
      'limit',
    ]);
    expect(result?.[0].properties?.jobTitle).toEqual({
      type: 'string',
      label: 'Job title',
    });
    expect(result?.[0].properties?.companyId).toEqual({
      type: 'record',
      label: 'Company',
      objectNameSingular: 'company',
    });
  });

  it('leaves unrelated logic functions unchanged', () => {
    expect(
      applyGtmNativeLogicFunctionInputSchema(
        'search-companies',
        leftoverUploadProfilesSchema,
      ),
    ).toBe(leftoverUploadProfilesSchema);
  });

  it('hides data source and account ID for search-people', () => {
    const leftoverSearchPeopleSchema: InputSchema = [
      {
        type: 'object',
        properties: {
          naturalLanguage: { type: 'string', label: 'Natural language' },
          companyName: { type: 'string', label: 'Company name' },
          dataSource: { type: 'string', label: 'Data source' },
          accountId: { type: 'string', label: 'Account ID' },
          limit: { type: 'number', label: 'Limit' },
        },
      },
    ];

    const result = applyGtmNativeLogicFunctionInputSchema(
      'search-people',
      leftoverSearchPeopleSchema,
    );

    expect(Object.keys(result?.[0].properties ?? {})).toEqual([
      'naturalLanguage',
      'companyName',
      'limit',
    ]);
  });

  it('overlays detect-fake-profiles inputs with profiles first and model last', () => {
    const leftoverDetectFakeProfilesSchema: InputSchema = [
      {
        type: 'object',
        properties: {
          profile: { type: 'object', label: 'Profile' },
          snapshot: { type: 'object', label: 'Snapshot' },
          profiles: { type: 'array', label: 'Profiles' },
          modelId: { type: 'string', label: 'Model ID' },
        },
      },
    ];

    const result = applyGtmNativeLogicFunctionInputSchema(
      'detect-fake-profiles',
      leftoverDetectFakeProfilesSchema,
    );

    expect(Object.keys(result?.[0].properties ?? {})).toEqual([
      'profiles',
      'profile',
      'snapshot',
      'modelId',
    ]);
    expect(result?.[0].properties?.profile).toEqual({
      type: 'array',
      label: 'Full profile',
    });
    expect(result?.[0].properties?.snapshot).toEqual({
      type: 'string',
      label: 'Snapshot',
    });
    expect(result?.[0].properties?.modelId).toEqual({
      type: 'string',
      label: 'Model',
    });
  });

  it('hides modelId from the detect-fake-profiles form and keeps it for save', () => {
    const inputSchema = applyGtmNativeLogicFunctionInputSchema(
      'detect-fake-profiles',
      [
        {
          type: 'object',
          properties: {
            profile: { type: 'object', label: 'Profile' },
            snapshot: { type: 'object', label: 'Snapshot' },
            profiles: { type: 'array', label: 'Profiles' },
            modelId: { type: 'string', label: 'Model ID' },
          },
        },
      ],
    );

    const formFields = getGtmNativeLogicFunctionFormFields({
      logicFunctionName: 'detect-fake-profiles',
      inputSchema,
      functionInput: {
        profiles: '{{people}}',
        profile: null,
        snapshot: null,
        modelId: 'nous/tencent/hy3:free',
      },
    });

    expect(formFields.showAiModelSelect).toBe(true);
    expect(formFields.modelId).toBe('nous/tencent/hy3:free');
    expect(Object.keys(formFields.functionInput)).toEqual([
      'profiles',
      'profile',
      'snapshot',
    ]);
    expect(Object.keys(formFields.inputSchema?.[0].properties ?? {})).toEqual([
      'profiles',
      'profile',
      'snapshot',
    ]);
  });

  it('clears empty profile and snapshot objects for detect-fake-profiles', () => {
    expect(
      normalizeGtmNativeLogicFunctionInput('detect-fake-profiles', {
        profile: {},
        snapshot: {},
        profiles: null,
        modelId: null,
      }),
    ).toEqual({
      profile: null,
      snapshot: null,
      profiles: null,
      modelId: null,
    });
  });

  it('overlays filter-profiles inputs with profiles, prompt, and model', () => {
    const leftoverFilterProfilesSchema: InputSchema = [
      {
        type: 'object',
        properties: {
          prompt: { type: 'string', label: 'Prompt' },
          profiles: { type: 'array', label: 'Profiles' },
          modelId: { type: 'string', label: 'Model ID' },
        },
      },
    ];

    const result = applyGtmNativeLogicFunctionInputSchema(
      'filter-profiles',
      leftoverFilterProfilesSchema,
    );

    expect(Object.keys(result?.[0].properties ?? {})).toEqual([
      'profiles',
      'prompt',
      'modelId',
    ]);
    expect(result?.[0].properties?.prompt).toEqual({
      type: 'string',
      label: 'Prompt',
    });
  });

  it('hides modelId from the filter-profiles form and keeps it for save', () => {
    const inputSchema = applyGtmNativeLogicFunctionInputSchema(
      'filter-profiles',
      [
        {
          type: 'object',
          properties: {
            profiles: { type: 'array', label: 'Profiles' },
            prompt: { type: 'string', label: 'Prompt' },
            modelId: { type: 'string', label: 'Model ID' },
          },
        },
      ],
    );

    const formFields = getGtmNativeLogicFunctionFormFields({
      logicFunctionName: 'filter-profiles',
      inputSchema,
      functionInput: {
        profiles: '{{people}}',
        prompt: 'senior engineers in fintech',
        modelId: 'nous/tencent/hy3:free',
      },
    });

    expect(formFields.showAiModelSelect).toBe(true);
    expect(formFields.modelId).toBe('nous/tencent/hy3:free');
    expect(Object.keys(formFields.functionInput)).toEqual([
      'profiles',
      'prompt',
    ]);
    expect(Object.keys(formFields.inputSchema?.[0].properties ?? {})).toEqual([
      'profiles',
      'prompt',
    ]);
  });
});
