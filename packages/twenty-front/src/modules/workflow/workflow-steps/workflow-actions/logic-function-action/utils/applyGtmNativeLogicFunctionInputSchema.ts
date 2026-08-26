import {
  GTM_DETECT_FAKE_PROFILES_LOGIC_FUNCTION_NAME,
  GTM_FILTER_PROFILES_LOGIC_FUNCTION_NAME,
  GTM_SEARCH_COMPANIES_LOGIC_FUNCTION_NAME,
  GTM_SEARCH_JOBS_LOGIC_FUNCTION_NAME,
  GTM_SEARCH_PEOPLE_FOR_COMPANY_LOGIC_FUNCTION_NAME,
  GTM_SEARCH_PEOPLE_LOGIC_FUNCTION_NAME,
  GTM_UPLOAD_PROFILES_LOGIC_FUNCTION_NAME,
} from '@/workflow/workflow-steps/workflow-actions/logic-function-action/constants/gtmNativeLogicFunctionSampleOutput';
import { isDefined, isPlainObject } from 'twenty-shared/utils';
import {
  type FunctionInput,
  type InputSchema,
  type InputSchemaProperty,
} from 'twenty-shared/workflow';

const UPLOAD_PROFILES_INPUT_PROPERTIES: Record<string, InputSchemaProperty> = {
  projectId: {
    type: 'record',
    label: 'Project',
    objectNameSingular: 'project',
  },
  companyId: {
    type: 'record',
    label: 'Company',
    objectNameSingular: 'company',
  },
  people: { type: 'array', label: 'People' },
  limit: { type: 'number', label: 'Limit' },
};

const SEARCH_PEOPLE_FOR_COMPANY_COMPANY_ID: InputSchemaProperty = {
  type: 'record',
  label: 'Company',
  objectNameSingular: 'company',
};

const SEARCH_PEOPLE_FOR_COMPANY_PROJECT_ID: InputSchemaProperty = {
  type: 'record',
  label: 'Project',
  objectNameSingular: 'project',
};

const SEARCH_PEOPLE_FOR_COMPANY_INPUT_PROPERTIES: Record<
  string,
  InputSchemaProperty
> = {
  companyId: SEARCH_PEOPLE_FOR_COMPANY_COMPANY_ID,
  projectId: SEARCH_PEOPLE_FOR_COMPANY_PROJECT_ID,
  jobTitle: { type: 'string', label: 'Job title' },
  limit: { type: 'number', label: 'Limit' },
};

const DETECT_FAKE_PROFILES_INPUT_PROPERTIES: Record<
  string,
  InputSchemaProperty
> = {
  profiles: { type: 'array', label: 'Profiles' },
  profile: { type: 'array', label: 'Full profile' },
  snapshot: { type: 'string', label: 'Snapshot' },
  modelId: { type: 'string', label: 'Model' },
};

const FILTER_PROFILES_INPUT_PROPERTIES: Record<string, InputSchemaProperty> = {
  profiles: { type: 'array', label: 'Profiles', multiline: false },
  prompt: { type: 'string', label: 'Prompt', multiline: true },
  modelId: { type: 'string', label: 'Model' },
};

const SEARCH_PEOPLE_HIDDEN_INPUT_KEYS = new Set(['dataSource', 'accountId']);
const AI_MODEL_DISPLAY_HIDDEN_KEYS = new Set(['modelId']);
const SEARCH_ACTIONS_WITH_LIMIT_LAST = new Set([
  GTM_SEARCH_COMPANIES_LOGIC_FUNCTION_NAME,
  GTM_SEARCH_JOBS_LOGIC_FUNCTION_NAME,
]);

const omitInputSchemaProperties = (
  inputSchema: InputSchema,
  hiddenKeys: Set<string>,
): InputSchema => {
  const root = inputSchema[0];

  if (!isDefined(root?.properties)) {
    return inputSchema;
  }

  return [
    {
      ...root,
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(root.properties).filter(
          ([key]) => !hiddenKeys.has(key),
        ),
      ),
    },
  ];
};

const moveLimitPropertyToEnd = (inputSchema: InputSchema): InputSchema => {
  const root = inputSchema[0];
  const properties = root?.properties;

  if (!isDefined(properties) || !isDefined(properties.limit)) {
    return inputSchema;
  }

  const { limit, ...rest } = properties;

  return [
    {
      ...root,
      type: 'object',
      properties: {
        ...rest,
        limit,
      },
    },
  ];
};

const overlayRecordPicker = (
  existing: InputSchemaProperty | undefined,
  fallback: InputSchemaProperty,
): InputSchemaProperty =>
  isDefined(existing) &&
  (existing.type === 'record' ||
    isDefined(existing.objectNameSingular) ||
    isDefined(existing.objectUniversalIdentifier))
    ? existing
    : fallback;

export const applyGtmNativeLogicFunctionInputSchema = (
  logicFunctionName: string | null | undefined,
  inputSchema: InputSchema | undefined,
): InputSchema | undefined => {
  if (!isDefined(inputSchema) || !isDefined(inputSchema[0])) {
    return inputSchema;
  }

  if (logicFunctionName === GTM_SEARCH_PEOPLE_LOGIC_FUNCTION_NAME) {
    return moveLimitPropertyToEnd(
      omitInputSchemaProperties(inputSchema, SEARCH_PEOPLE_HIDDEN_INPUT_KEYS),
    );
  }

  if (SEARCH_ACTIONS_WITH_LIMIT_LAST.has(logicFunctionName ?? '')) {
    return moveLimitPropertyToEnd(inputSchema);
  }

  const root = inputSchema[0];

  if (logicFunctionName === GTM_SEARCH_PEOPLE_FOR_COMPANY_LOGIC_FUNCTION_NAME) {
    return [
      {
        ...root,
        type: 'object',
        properties: {
          ...SEARCH_PEOPLE_FOR_COMPANY_INPUT_PROPERTIES,
          companyId: overlayRecordPicker(
            root.properties?.companyId,
            SEARCH_PEOPLE_FOR_COMPANY_COMPANY_ID,
          ),
          projectId: overlayRecordPicker(
            root.properties?.projectId,
            SEARCH_PEOPLE_FOR_COMPANY_PROJECT_ID,
          ),
        },
      },
    ];
  }

  if (logicFunctionName === GTM_DETECT_FAKE_PROFILES_LOGIC_FUNCTION_NAME) {
    return [
      {
        ...root,
        type: 'object',
        properties: {
          ...DETECT_FAKE_PROFILES_INPUT_PROPERTIES,
        },
      },
    ];
  }

  if (logicFunctionName === GTM_FILTER_PROFILES_LOGIC_FUNCTION_NAME) {
    return [
      {
        ...root,
        type: 'object',
        properties: {
          ...FILTER_PROFILES_INPUT_PROPERTIES,
        },
      },
    ];
  }

  if (logicFunctionName !== GTM_UPLOAD_PROFILES_LOGIC_FUNCTION_NAME) {
    return inputSchema;
  }

  const projectId = root.properties?.projectId;
  const companyId = root.properties?.companyId;

  return [
    {
      ...root,
      type: 'object',
      properties: {
        ...UPLOAD_PROFILES_INPUT_PROPERTIES,
        ...(isDefined(projectId) &&
        (projectId.type === 'record' ||
          isDefined(projectId.objectNameSingular) ||
          isDefined(projectId.objectUniversalIdentifier))
          ? { projectId }
          : {}),
        ...(isDefined(companyId) &&
        (companyId.type === 'record' ||
          isDefined(companyId.objectNameSingular) ||
          isDefined(companyId.objectUniversalIdentifier))
          ? { companyId }
          : {}),
      },
    },
  ];
};

const isEmptyPlainObject = (value: unknown): boolean =>
  isPlainObject(value) && Object.keys(value).length === 0;

export const normalizeGtmNativeLogicFunctionInput = (
  logicFunctionName: string | null | undefined,
  functionInput: FunctionInput,
): FunctionInput => {
  if (logicFunctionName !== GTM_DETECT_FAKE_PROFILES_LOGIC_FUNCTION_NAME) {
    return functionInput;
  }

  return {
    ...functionInput,
    ...(isEmptyPlainObject(functionInput.profile) ? { profile: null } : {}),
    ...(isEmptyPlainObject(functionInput.snapshot) ? { snapshot: null } : {}),
  };
};

export const getGtmNativeLogicFunctionFormFields = ({
  logicFunctionName,
  inputSchema,
  functionInput,
}: {
  logicFunctionName: string | null | undefined;
  inputSchema: InputSchema | undefined;
  functionInput: FunctionInput;
}): {
  inputSchema: InputSchema | undefined;
  functionInput: FunctionInput;
  modelId?: unknown;
  showAiModelSelect: boolean;
} => {
  const showAiModelSelect =
    logicFunctionName === GTM_DETECT_FAKE_PROFILES_LOGIC_FUNCTION_NAME ||
    logicFunctionName === GTM_FILTER_PROFILES_LOGIC_FUNCTION_NAME;

  if (!showAiModelSelect) {
    return { inputSchema, functionInput, showAiModelSelect };
  }

  const { modelId, ...functionInputWithoutModelId } = functionInput;

  return {
    inputSchema: isDefined(inputSchema)
      ? omitInputSchemaProperties(inputSchema, AI_MODEL_DISPLAY_HIDDEN_KEYS)
      : inputSchema,
    functionInput: functionInputWithoutModelId,
    modelId,
    showAiModelSelect,
  };
};
