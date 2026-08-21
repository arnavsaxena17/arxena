import {
  WORKFLOW_FORM_REGISTRY_NAMES,
  type WorkflowFormRegistryName,
} from './workflow-form-template.registry';

export type WorkflowFormFlowFieldSpec = {
  name: string;
  type: string;
  label: string;
};

// Fixed Flow form keys by type so webhook can map back via formSnapshot types
export const FLOW_FIELD_KEY_BY_TYPE = {
  BOOLEAN: 'boolean_value',
  TEXT: 'text_value',
  NUMBER: 'number_value',
  DATE: 'date_value',
  SELECT: 'select_value',
  MULTI_SELECT: 'multi_select_value',
} as const;

type FlowComponent = Record<string, unknown>;

const buildFieldComponent = (type: string): FlowComponent | null => {
  switch (type) {
    case 'BOOLEAN':
      return {
        type: 'RadioButtonsGroup',
        name: FLOW_FIELD_KEY_BY_TYPE.BOOLEAN,
        label: 'Decision',
        required: true,
        'data-source': [
          { id: 'true', title: 'Yes / Approve' },
          { id: 'false', title: 'No / Reject' },
        ],
      };
    case 'TEXT':
      return {
        type: 'TextArea',
        name: FLOW_FIELD_KEY_BY_TYPE.TEXT,
        label: 'Text',
        required: true,
        // Prefill + hint from flow_action_data (components outside Form)
        'init-value': '${data.text_init_value}',
        'helper-text': '${data.text_helper}',
      };
    case 'NUMBER':
      return {
        type: 'TextInput',
        name: FLOW_FIELD_KEY_BY_TYPE.NUMBER,
        label: 'Number',
        required: true,
        'input-type': 'number',
        'init-value': '${data.number_init_value}',
        'helper-text': '${data.number_helper}',
      };
    case 'DATE':
      return {
        type: 'DatePicker',
        name: FLOW_FIELD_KEY_BY_TYPE.DATE,
        label: 'Date',
        required: true,
        'init-value': '${data.date_init_value}',
      };
    case 'SELECT':
      return {
        type: 'Dropdown',
        name: FLOW_FIELD_KEY_BY_TYPE.SELECT,
        label: 'Select',
        required: true,
        'data-source': '${data.select_options}',
        'init-value': '${data.select_init_value}',
      };
    case 'MULTI_SELECT':
      return {
        type: 'CheckboxGroup',
        name: FLOW_FIELD_KEY_BY_TYPE.MULTI_SELECT,
        label: 'Multi-select',
        required: true,
        'data-source': '${data.multi_select_options}',
        'init-value': '${data.multi_select_init_value}',
      };
    default:
      return null;
  }
};

const buildCompletePayload = (types: string[]): Record<string, string> => {
  return types.reduce<Record<string, string>>((payload, type) => {
    const key =
      FLOW_FIELD_KEY_BY_TYPE[type as keyof typeof FLOW_FIELD_KEY_BY_TYPE];

    if (key) {
      payload[key] = `\${form.${key}}`;
    }

    return payload;
  }, {});
};

const buildScreenDataSchema = (
  types: string[],
): Record<string, unknown> => {
  const data: Record<string, unknown> = {
    context_heading: {
      type: 'string',
      __example__: 'Please complete this workflow form.',
    },
  };

  if (types.includes('TEXT')) {
    data.text_init_value = {
      type: 'string',
      __example__: 'Sample response text',
    };
    data.text_helper = {
      type: 'string',
      __example__: 'Enter your notes',
    };
  }

  if (types.includes('NUMBER')) {
    data.number_init_value = {
      type: 'string',
      __example__: '42',
    };
    data.number_helper = {
      type: 'string',
      __example__: 'Enter a number',
    };
  }

  if (types.includes('DATE')) {
    data.date_init_value = {
      type: 'string',
      __example__: '2026-08-12',
    };
  }

  if (types.includes('SELECT')) {
    data.select_options = {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
        },
      },
      __example__: [
        { id: 'option_a', title: 'Option A' },
        { id: 'option_b', title: 'Option B' },
      ],
    };
    data.select_init_value = {
      type: 'string',
      __example__: 'option_a',
    };
  }

  if (types.includes('MULTI_SELECT')) {
    data.multi_select_options = {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
        },
      },
      __example__: [
        { id: 'option_a', title: 'Option A' },
        { id: 'option_b', title: 'Option B' },
      ],
    };
    data.multi_select_init_value = {
      type: 'array',
      items: { type: 'string' },
      __example__: ['option_a'],
    };
  }

  return data;
};

export const buildWorkflowFormFlowJson = (
  types: string[],
): Record<string, unknown> => {
  const normalizedTypes = [...new Set(types.map((type) => type.toUpperCase()))];
  const fieldComponents = normalizedTypes
    .map((type) => buildFieldComponent(type))
    .filter((component): component is FlowComponent => component !== null);

  // Generic fallback: free-text + yes/no when no typed fields matched
  if (fieldComponents.length === 0) {
    fieldComponents.push(
      {
        type: 'RadioButtonsGroup',
        name: FLOW_FIELD_KEY_BY_TYPE.BOOLEAN,
        label: 'Decision',
        required: true,
        'data-source': [
          { id: 'true', title: 'Yes / Approve' },
          { id: 'false', title: 'No / Reject' },
        ],
      },
      {
        type: 'TextArea',
        name: FLOW_FIELD_KEY_BY_TYPE.TEXT,
        label: 'Notes',
        required: false,
        'init-value': '${data.text_init_value}',
        'helper-text': '${data.text_helper}',
      },
    );
    normalizedTypes.push('BOOLEAN', 'TEXT');
  }

  // Static navigate Flow (no endpoint) — options/context arrive via flow_action_data
  return {
    version: '6.0',
    routing_model: {
      FORM_SCREEN: [],
    },
    screens: [
      {
        id: 'FORM_SCREEN',
        title: 'Workflow form',
        terminal: true,
        success: true,
        data: buildScreenDataSchema(normalizedTypes),
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'TextHeading',
              text: 'Workflow form',
            },
            {
              type: 'TextBody',
              text: '${data.context_heading}',
            },
            ...fieldComponents,
            {
              type: 'Footer',
              label: 'Submit',
              'on-click-action': {
                name: 'complete',
                payload: buildCompletePayload(normalizedTypes),
              },
            },
          ],
        },
      },
    ],
  };
};

export const getFlowTypesForRegistryName = (
  registryName: WorkflowFormRegistryName,
): string[] => {
  switch (registryName) {
    case WORKFLOW_FORM_REGISTRY_NAMES.BOOLEAN_TEXT:
      return ['BOOLEAN', 'TEXT'];
    case WORKFLOW_FORM_REGISTRY_NAMES.TEXT:
      return ['TEXT'];
    case WORKFLOW_FORM_REGISTRY_NAMES.NUMBER:
      return ['NUMBER'];
    case WORKFLOW_FORM_REGISTRY_NAMES.DATE:
      return ['DATE'];
    case WORKFLOW_FORM_REGISTRY_NAMES.SELECT:
      return ['SELECT'];
    case WORKFLOW_FORM_REGISTRY_NAMES.MULTI_SELECT:
      return ['MULTI_SELECT'];
    case WORKFLOW_FORM_REGISTRY_NAMES.TEXT_NUMBER_DATE:
      return ['TEXT', 'NUMBER', 'DATE'];
    case WORKFLOW_FORM_REGISTRY_NAMES.GENERIC:
      return ['BOOLEAN', 'TEXT'];
    default:
      return [];
  }
};

export const getFlowNameForRegistry = (
  registryName: WorkflowFormRegistryName,
): string => {
  return `flow_${registryName}`;
};

export const getFlowTemplateNameForRegistry = (
  registryName: WorkflowFormRegistryName,
): string => {
  // v2 templates include Backdrop {{1}} + Details {{2}}.
  // Do not use legacy `*_flow` names — several are single-variable.
  return `${registryName}_flow_v2`;
};

// Map Flow response keys onto form field names using snapshot field types
export const mapFlowResponseToFormFields = (
  flowResponse: Record<string, unknown>,
  formSnapshot: Array<{ name: string; type: string }>,
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  const usedFlowKeys = new Set<string>();

  for (const field of formSnapshot) {
    const type = field.type.toUpperCase();
    const flowKey =
      FLOW_FIELD_KEY_BY_TYPE[type as keyof typeof FLOW_FIELD_KEY_BY_TYPE];

    if (!flowKey || usedFlowKeys.has(flowKey)) {
      continue;
    }

    if (!(flowKey in flowResponse)) {
      continue;
    }

    usedFlowKeys.add(flowKey);
    const raw = flowResponse[flowKey];

    if (type === 'BOOLEAN') {
      result[field.name] =
        raw === true ||
        raw === 'true' ||
        raw === 'Yes / Approve' ||
        raw === 'Yes';
    } else if (type === 'NUMBER') {
      result[field.name] =
        typeof raw === 'number' ? raw : Number(String(raw));
    } else if (type === 'MULTI_SELECT') {
      result[field.name] = Array.isArray(raw) ? raw : [raw];
    } else {
      result[field.name] = raw;
    }
  }

  return result;
};
