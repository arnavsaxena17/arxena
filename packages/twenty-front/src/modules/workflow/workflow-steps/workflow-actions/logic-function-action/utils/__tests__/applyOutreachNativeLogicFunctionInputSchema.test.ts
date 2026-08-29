import {
  applyOutreachNativeLogicFunctionInputSchema,
  getOutreachNativeLogicFunctionFormFields,
  normalizeOutreachNativeLogicFunctionInput,
} from '@/workflow/workflow-steps/workflow-actions/logic-function-action/utils/applyOutreachNativeLogicFunctionInputSchema';
import { type InputSchema } from 'twenty-shared/workflow';

describe('applyOutreachNativeLogicFunctionInputSchema', () => {
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

  it('keeps project, company, people, candidate, and limit for upload-profiles', () => {
    const result = applyOutreachNativeLogicFunctionInputSchema(
      'upload-profiles',
      leftoverUploadProfilesSchema,
    );

    expect(Object.keys(result?.[0].properties ?? {})).toEqual([
      'projectId',
      'companyId',
      'people',
      'candidateId',
      'limit',
    ]);
    expect(result?.[0].properties?.projectId).toEqual({
      type: 'record',
      label: 'Project',
      objectNameSingular: 'project',
    });
    expect(result?.[0].properties?.candidateId).toEqual({
      type: 'record',
      label: 'Candidate',
      objectNameSingular: 'candidate',
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

    const result = applyOutreachNativeLogicFunctionInputSchema(
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
      applyOutreachNativeLogicFunctionInputSchema(
        'fetch-linkedin-profile',
        leftoverUploadProfilesSchema,
      ),
    ).toBe(leftoverUploadProfilesSchema);
  });

  it('hides data source and account ID and keeps limit last for search-people', () => {
    const leftoverSearchPeopleSchema: InputSchema = [
      {
        type: 'object',
        properties: {
          limit: { type: 'number', label: 'Limit' },
          naturalLanguage: { type: 'string', label: 'Natural language' },
          searchUrl: { type: 'string', label: 'LinkedIn search URL' },
          companyName: { type: 'string', label: 'Company name' },
          dataSource: { type: 'string', label: 'Data source' },
          accountId: { type: 'string', label: 'Account ID' },
        },
      },
    ];

    const result = applyOutreachNativeLogicFunctionInputSchema(
      'search-people',
      leftoverSearchPeopleSchema,
    );

    expect(Object.keys(result?.[0].properties ?? {})).toEqual([
      'naturalLanguage',
      'searchUrl',
      'companyName',
      'limit',
    ]);
  });

  it.each(['search-companies', 'search-jobs'] as const)(
    'keeps limit last for %s',
    (logicFunctionName) => {
      const leftoverSearchSchema: InputSchema = [
        {
          type: 'object',
          properties: {
            limit: { type: 'number', label: 'Limit' },
            keywords: { type: 'string', label: 'Keywords' },
            location: { type: 'string', label: 'Location' },
          },
        },
      ];

      const result = applyOutreachNativeLogicFunctionInputSchema(
        logicFunctionName,
        leftoverSearchSchema,
      );

      expect(Object.keys(result?.[0].properties ?? {})).toEqual([
        'keywords',
        'location',
        'limit',
      ]);
    },
  );

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

    const result = applyOutreachNativeLogicFunctionInputSchema(
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
    const inputSchema = applyOutreachNativeLogicFunctionInputSchema(
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

    const formFields = getOutreachNativeLogicFunctionFormFields({
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
      normalizeOutreachNativeLogicFunctionInput('detect-fake-profiles', {
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

    const result = applyOutreachNativeLogicFunctionInputSchema(
      'filter-profiles',
      leftoverFilterProfilesSchema,
    );

    expect(Object.keys(result?.[0].properties ?? {})).toEqual([
      'profiles',
      'onlyOnePersonPerCompany',
      'prompt',
      'modelId',
    ]);
    expect(result?.[0].properties?.prompt).toEqual({
      type: 'string',
      label: 'Prompt',
      multiline: true,
    });
    expect(result?.[0].properties?.profiles).toEqual({
      type: 'array',
      label: 'Profiles',
      multiline: false,
    });
    expect(result?.[0].properties?.onlyOnePersonPerCompany).toEqual({
      type: 'boolean',
      label: 'Only one person per company',
    });
  });

  it('hides modelId from the filter-profiles form and keeps it for save', () => {
    const inputSchema = applyOutreachNativeLogicFunctionInputSchema(
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

    const formFields = getOutreachNativeLogicFunctionFormFields({
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
      'onlyOnePersonPerCompany',
      'prompt',
    ]);
  });

  it('defaults onlyOnePersonPerCompany to false for filter-profiles', () => {
    expect(
      normalizeOutreachNativeLogicFunctionInput('filter-profiles', {
        profiles: '{{people}}',
        prompt: 'decision makers',
      }),
    ).toEqual({
      profiles: '{{people}}',
      prompt: 'decision makers',
      onlyOnePersonPerCompany: false,
    });
  });
});
