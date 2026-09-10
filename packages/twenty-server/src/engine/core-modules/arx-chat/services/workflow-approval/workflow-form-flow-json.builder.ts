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

export const FLOW_BOOLEAN_DECISION = {
  YES: 'yes',
  NO: 'no',
  MODIFY: 'modify',
} as const;

type FlowComponent = Record<string, unknown>;

const APPROVE_FLOW_BOOLEAN_VALUES = new Set([
  true,
  'true',
  FLOW_BOOLEAN_DECISION.YES,
  FLOW_BOOLEAN_DECISION.MODIFY,
  'Yes',
  'Yes / Approve',
  'Modify',
]);

const REJECT_FLOW_BOOLEAN_VALUES = new Set([
  false,
  'false',
  FLOW_BOOLEAN_DECISION.NO,
  'No',
  'No / Reject',
]);

export const mapFlowBooleanValueToApprove = (raw: unknown): boolean => {
  if (REJECT_FLOW_BOOLEAN_VALUES.has(raw as never)) {
    return false;
  }

  if (APPROVE_FLOW_BOOLEAN_VALUES.has(raw as never)) {
    return true;
  }

  return raw === true || raw === 'true';
};

export const isModifyFlowBooleanValue = (raw: unknown): boolean => {
  return raw === FLOW_BOOLEAN_DECISION.MODIFY || raw === 'Modify';
};

const buildYesNoModifyRadio = (): FlowComponent => ({
  type: 'RadioButtonsGroup',
  name: FLOW_FIELD_KEY_BY_TYPE.BOOLEAN,
  label: 'Decision',
  required: true,
  'data-source': [
    { id: FLOW_BOOLEAN_DECISION.YES, title: 'Yes' },
    { id: FLOW_BOOLEAN_DECISION.NO, title: 'No' },
    { id: FLOW_BOOLEAN_DECISION.MODIFY, title: 'Modify' },
  ],
});

// BOOLEAN + TEXT → Yes / No / Modify; text box only when Modify is selected
const buildYesNoModifyFieldComponents = (): FlowComponent[] => [
  {
    type: 'Form',
    name: 'flow_form',
    'init-values': {
      [FLOW_FIELD_KEY_BY_TYPE.TEXT]: '${data.text_init_value}',
    },
    children: [
      {
        type: 'TextBody',
        text: '${data.details_body}',
      },
      buildYesNoModifyRadio(),
      {
        type: 'TextCaption',
        text: 'Draft to send:',
      },
      {
        type: 'TextBody',
        text: '${data.text_init_value}',
      },
      {
        type: 'Switch',
        value: `\${form.${FLOW_FIELD_KEY_BY_TYPE.BOOLEAN}}`,
        cases: {
          [FLOW_BOOLEAN_DECISION.MODIFY]: [
            {
              type: 'TextArea',
              name: FLOW_FIELD_KEY_BY_TYPE.TEXT,
              label: 'Modified message',
              required: true,
              'helper-text': '${data.text_helper}',
            },
          ],
        },
      },
      {
        type: 'Footer',
        label: 'Submit',
        'on-click-action': {
          name: 'complete',
          payload: {
            [FLOW_FIELD_KEY_BY_TYPE.BOOLEAN]: `\${form.${FLOW_FIELD_KEY_BY_TYPE.BOOLEAN}}`,
            [FLOW_FIELD_KEY_BY_TYPE.TEXT]: `\${form.${FLOW_FIELD_KEY_BY_TYPE.TEXT}}`,
          },
        },
      },
    ],
  },
];

const buildFieldComponent = (type: string): FlowComponent | null => {
  switch (type) {
    case 'BOOLEAN':
      return {
        type: 'RadioButtonsGroup',
        name: FLOW_FIELD_KEY_BY_TYPE.BOOLEAN,
        label: 'Decision',
        required: true,
        'data-source': [
          { id: FLOW_BOOLEAN_DECISION.YES, title: 'Yes' },
          { id: FLOW_BOOLEAN_DECISION.NO, title: 'No' },
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

const buildScreenDataSchema = (types: string[]): Record<string, unknown> => {
  const data: Record<string, unknown> = {
    context_heading: {
      type: 'string',
      __example__: 'Please complete this workflow form.',
    },
    details_body: {
      type: 'string',
      __example__:
        'Contact: Jane Doe\nCompany: Acme Corp\nDraft: Hi Jane — quick note.',
    },
  };

  if (types.includes('TEXT')) {
    data.text_init_value = {
      type: 'string',
      __example__: 'Sample response text',
    };
    data.text_helper = {
      type: 'string',
      __example__: 'Edit the message that will go out',
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
  const hasBoolean = normalizedTypes.includes('BOOLEAN');
  const hasText = normalizedTypes.includes('TEXT');
  const useYesNoModify = hasBoolean && hasText;

  let fieldComponents: FlowComponent[];
  let embedsYesNoModifyForm = useYesNoModify;

  if (useYesNoModify) {
    const otherTypes = normalizedTypes.filter(
      (type) => type !== 'BOOLEAN' && type !== 'TEXT',
    );

    fieldComponents = [
      ...buildYesNoModifyFieldComponents(),
      ...otherTypes
        .map((type) => buildFieldComponent(type))
        .filter((component): component is FlowComponent => component !== null),
    ];
  } else {
    fieldComponents = normalizedTypes
      .map((type) => buildFieldComponent(type))
      .filter((component): component is FlowComponent => component !== null);
  }

  // Generic fallback: Yes / No / Modify + conditional text when no typed fields matched
  if (fieldComponents.length === 0) {
    fieldComponents.push(...buildYesNoModifyFieldComponents());
    normalizedTypes.push('BOOLEAN', 'TEXT');
    embedsYesNoModifyForm = true;
  }

  // Static navigate Flow (no endpoint) — options/context arrive via flow_action_data
  const screenChildren: FlowComponent[] = [
    {
      type: 'TextHeading',
      text: 'Workflow form',
    },
    {
      type: 'TextBody',
      text: '${data.context_heading}',
    },
    ...(embedsYesNoModifyForm
      ? []
      : [
          {
            type: 'TextBody',
            text: '${data.details_body}',
          } as FlowComponent,
        ]),
    ...fieldComponents,
  ];

  // Yes/No/Modify Form already includes its Submit footer
  if (!embedsYesNoModifyForm) {
    screenChildren.push({
      type: 'Footer',
      label: 'Submit',
      'on-click-action': {
        name: 'complete',
        payload: buildCompletePayload(normalizedTypes),
      },
    });
  }

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
          children: screenChildren,
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
    case WORKFLOW_FORM_REGISTRY_NAMES.DATE:
      return ['DATE'];
    case WORKFLOW_FORM_REGISTRY_NAMES.SELECT:
      return ['SELECT'];
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
  version: 'v2' | 'v3' | 'v4' = 'v2',
): string => {
  // v2: Request {{1}} + Details {{2}} (one-line params; Meta forbids \n in values)
  // v3: locked name after Utility→Marketing reclass — do not recreate
  // v4: Request {{1}} + Record {{2}} + Workspace {{3}} + Summary {{4}} with static newlines
  return `${registryName}_flow_${version}`;
};

export const usesStructuredFlowTemplate = (
  registryName: WorkflowFormRegistryName,
): boolean => {
  return registryName === WORKFLOW_FORM_REGISTRY_NAMES.BOOLEAN_TEXT;
};

export const getPreferredStructuredFlowVersion = (): 'v4' => 'v4';

// Map Flow response keys onto form field names using snapshot field types
export const mapFlowResponseToFormFields = (
  flowResponse: Record<string, unknown>,
  formSnapshot: Array<{ name: string; type: string; value?: unknown }>,
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  const usedFlowKeys = new Set<string>();
  const booleanRaw = flowResponse[FLOW_FIELD_KEY_BY_TYPE.BOOLEAN];
  const isApprove = mapFlowBooleanValueToApprove(booleanRaw);
  const isModify = isModifyFlowBooleanValue(booleanRaw);

  for (const field of formSnapshot) {
    const type = field.type.toUpperCase();
    const flowKey =
      FLOW_FIELD_KEY_BY_TYPE[type as keyof typeof FLOW_FIELD_KEY_BY_TYPE];

    if (!flowKey || usedFlowKeys.has(flowKey)) {
      continue;
    }

    if (!(flowKey in flowResponse)) {
      // Yes (send as-is): Flow hides the text box, so keep the resolved draft
      if (
        type === 'TEXT' &&
        isApprove &&
        isModify === false &&
        field.value !== undefined &&
        field.value !== null &&
        field.value !== ''
      ) {
        result[field.name] = field.value;
      }

      continue;
    }

    usedFlowKeys.add(flowKey);
    const raw = flowResponse[flowKey];

    if (type === 'BOOLEAN') {
      result[field.name] = mapFlowBooleanValueToApprove(raw);
    } else if (type === 'NUMBER') {
      result[field.name] = typeof raw === 'number' ? raw : Number(String(raw));
    } else if (type === 'MULTI_SELECT') {
      result[field.name] = Array.isArray(raw) ? raw : [raw];
    } else if (type === 'TEXT') {
      const textValue = typeof raw === 'string' ? raw.trim() : raw;

      // Empty modify box should not wipe the draft — fall back to snapshot
      if (
        (textValue === undefined || textValue === null || textValue === '') &&
        isApprove &&
        field.value !== undefined &&
        field.value !== null &&
        field.value !== ''
      ) {
        result[field.name] = field.value;
      } else {
        result[field.name] = textValue;
      }
    } else {
      result[field.name] = raw;
    }
  }

  return result;
};
