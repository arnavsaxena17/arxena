import { type AgentResponseSchema } from 'twenty-shared/ai';
import { type BaseOutputSchemaV2 } from 'twenty-shared/workflow';

export type AiFilteringFieldLike = {
  name: string;
  type: string;
  description?: string;
  enumValues?: string[];
};

const toAgentFieldType = (
  fieldType: string,
): 'string' | 'number' | 'boolean' => {
  const normalized = fieldType.toLowerCase();

  if (normalized === 'boolean') {
    return 'boolean';
  }

  if (normalized === 'number') {
    return 'number';
  }

  return 'string';
};

export const aiFilteringFieldsToAgentResponseSchema = (
  fields: AiFilteringFieldLike[],
): AgentResponseSchema => {
  const properties: AgentResponseSchema['properties'] = {};
  const required: string[] = [];

  for (const field of fields) {
    if (!field.name.trim()) {
      continue;
    }

    properties[field.name] = {
      type: toAgentFieldType(field.type),
      description: field.description || field.name,
    };
    required.push(field.name);
  }

  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  };
};

export const aiFilteringFieldsToOutputSchema = (
  fields: AiFilteringFieldLike[],
): BaseOutputSchemaV2 => {
  const outputSchema: BaseOutputSchemaV2 = {
    success: {
      isLeaf: true,
      type: 'boolean',
      label: 'Success',
      value: null,
    },
    total: {
      isLeaf: true,
      type: 'number',
      label: 'Total',
      value: null,
    },
    candidates: {
      isLeaf: true,
      type: 'array',
      label: 'Candidates',
      value: null,
    },
  };

  for (const field of fields) {
    if (!field.name.trim()) {
      continue;
    }

    outputSchema[field.name] = {
      isLeaf: true,
      type: toAgentFieldType(field.type),
      label: field.name,
      value: null,
    };
  }

  return outputSchema;
};

export const WORKFLOW_AI_FILTERING_SAMPLE_CANDIDATES = [
  {
    id: 'sample-1',
    name: 'Arapa Hara',
    title: 'Head of Sales',
    company: 'Acme',
    location: 'San Francisco',
  },
  {
    id: 'sample-2',
    name: 'Jordan Lee',
    title: 'SDR',
    company: 'Acme',
    location: 'New York',
  },
] as const;

export const WORKFLOW_AI_FILTERING_SAMPLE_OUTPUT = {
  success: true,
  total: 2,
  candidates: [
    {
      ...WORKFLOW_AI_FILTERING_SAMPLE_CANDIDATES[0],
      aiFilter: {
        isSeniorGtm: true,
        fitBand: 'strong',
      },
    },
    {
      ...WORKFLOW_AI_FILTERING_SAMPLE_CANDIDATES[1],
      aiFilter: {
        isSeniorGtm: false,
        fitBand: 'no',
      },
    },
  ],
};
