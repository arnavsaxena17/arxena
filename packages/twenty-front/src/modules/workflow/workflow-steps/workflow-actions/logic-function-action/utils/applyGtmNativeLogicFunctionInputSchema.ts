import { GTM_UPLOAD_PROFILES_LOGIC_FUNCTION_NAME } from '@/workflow/workflow-steps/workflow-actions/logic-function-action/constants/gtmNativeLogicFunctionSampleOutput';
import { isDefined } from 'twenty-shared/utils';
import { type InputSchema, type InputSchemaProperty } from 'twenty-shared/workflow';

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

export const applyGtmNativeLogicFunctionInputSchema = (
  logicFunctionName: string | null | undefined,
  inputSchema: InputSchema | undefined,
): InputSchema | undefined => {
  if (
    logicFunctionName !== GTM_UPLOAD_PROFILES_LOGIC_FUNCTION_NAME ||
    !isDefined(inputSchema) ||
    !isDefined(inputSchema[0])
  ) {
    return inputSchema;
  }

  const root = inputSchema[0];
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
