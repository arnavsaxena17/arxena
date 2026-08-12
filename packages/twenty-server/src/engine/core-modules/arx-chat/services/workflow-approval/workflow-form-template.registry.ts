export const WORKFLOW_FORM_REGISTRY_NAMES = {
  BOOLEAN: 'wf_form_boolean',
  BOOLEAN_TEXT: 'wf_form_boolean_text',
  TEXT: 'wf_form_text',
  NUMBER: 'wf_form_number',
  DATE: 'wf_form_date',
  SELECT: 'wf_form_select',
  MULTI_SELECT: 'wf_form_multi_select',
  TEXT_NUMBER_DATE: 'wf_form_text_number_date',
  GENERIC: 'wf_form_generic',
  HOSTED: 'wf_form_hosted',
} as const;

export type WorkflowFormRegistryName =
  (typeof WORKFLOW_FORM_REGISTRY_NAMES)[keyof typeof WORKFLOW_FORM_REGISTRY_NAMES];

export type WorkflowFormTemplateKind =
  | 'boolean_qr'
  | 'hosted_url'
  | 'flow_or_url';

export type WorkflowFormFieldSignatureInput = {
  type: string;
};

export type WorkflowFormRegistryEntry = {
  name: WorkflowFormRegistryName;
  // Sorted type keys that match this entry (empty = catch-all / forced)
  signatureTypes: string[];
  templateKind: WorkflowFormTemplateKind;
};

const KNOWN_FORM_FIELD_TYPES = new Set([
  'BOOLEAN',
  'TEXT',
  'NUMBER',
  'DATE',
  'SELECT',
  'MULTI_SELECT',
  'RECORD',
]);

export const WORKFLOW_FORM_TEMPLATE_REGISTRY: WorkflowFormRegistryEntry[] = [
  {
    name: WORKFLOW_FORM_REGISTRY_NAMES.BOOLEAN,
    signatureTypes: ['BOOLEAN'],
    templateKind: 'boolean_qr',
  },
  {
    name: WORKFLOW_FORM_REGISTRY_NAMES.BOOLEAN_TEXT,
    signatureTypes: ['BOOLEAN', 'TEXT'],
    templateKind: 'flow_or_url',
  },
  {
    name: WORKFLOW_FORM_REGISTRY_NAMES.TEXT,
    signatureTypes: ['TEXT'],
    templateKind: 'flow_or_url',
  },
  {
    name: WORKFLOW_FORM_REGISTRY_NAMES.NUMBER,
    signatureTypes: ['NUMBER'],
    templateKind: 'flow_or_url',
  },
  {
    name: WORKFLOW_FORM_REGISTRY_NAMES.DATE,
    signatureTypes: ['DATE'],
    templateKind: 'flow_or_url',
  },
  {
    name: WORKFLOW_FORM_REGISTRY_NAMES.SELECT,
    signatureTypes: ['SELECT'],
    templateKind: 'flow_or_url',
  },
  {
    name: WORKFLOW_FORM_REGISTRY_NAMES.MULTI_SELECT,
    signatureTypes: ['MULTI_SELECT'],
    templateKind: 'flow_or_url',
  },
  {
    name: WORKFLOW_FORM_REGISTRY_NAMES.TEXT_NUMBER_DATE,
    signatureTypes: ['DATE', 'NUMBER', 'TEXT'],
    templateKind: 'flow_or_url',
  },
  {
    name: WORKFLOW_FORM_REGISTRY_NAMES.GENERIC,
    signatureTypes: [],
    templateKind: 'flow_or_url',
  },
  {
    name: WORKFLOW_FORM_REGISTRY_NAMES.HOSTED,
    signatureTypes: [],
    templateKind: 'hosted_url',
  },
];

const REGISTRY_BY_NAME = new Map(
  WORKFLOW_FORM_TEMPLATE_REGISTRY.map((entry) => [entry.name, entry]),
);

const EXACT_SIGNATURE_ENTRIES = WORKFLOW_FORM_TEMPLATE_REGISTRY.filter(
  (entry) => entry.signatureTypes.length > 0,
);

export const computeFormFieldSignature = (
  fields: WorkflowFormFieldSignatureInput[],
): string => {
  const normalizedTypes = fields
    .map((field) => field.type.trim().toUpperCase())
    .filter((type) => type.length > 0)
    .sort();

  return normalizedTypes.join('+');
};

const getRegistryEntryByName = (
  name: string,
): WorkflowFormRegistryEntry | undefined => {
  return REGISTRY_BY_NAME.get(name as WorkflowFormRegistryName);
};

export const resolveWorkflowFormRegistryEntry = (
  fields: WorkflowFormFieldSignatureInput[],
  optionalForcedName?: string,
): WorkflowFormRegistryEntry => {
  if (optionalForcedName) {
    const forcedEntry = getRegistryEntryByName(optionalForcedName);

    if (forcedEntry) {
      return forcedEntry;
    }
  }

  const hostedEntry = getRegistryEntryByName(
    WORKFLOW_FORM_REGISTRY_NAMES.HOSTED,
  )!;
  const genericEntry = getRegistryEntryByName(
    WORKFLOW_FORM_REGISTRY_NAMES.GENERIC,
  )!;

  const normalizedTypes = fields
    .map((field) => field.type.trim().toUpperCase())
    .filter((type) => type.length > 0);

  const hasRecord = normalizedTypes.includes('RECORD');
  const hasUnknownType = normalizedTypes.some(
    (type) => !KNOWN_FORM_FIELD_TYPES.has(type),
  );

  if (hasRecord || hasUnknownType || normalizedTypes.length === 0) {
    return hostedEntry;
  }

  const signature = computeFormFieldSignature(fields);

  const exactMatch = EXACT_SIGNATURE_ENTRIES.find(
    (entry) => entry.signatureTypes.join('+') === signature,
  );

  if (exactMatch) {
    return exactMatch;
  }

  return genericEntry;
};

// Meta URL button dynamic suffix: token/fill → /workflow-approval/{token}/fill
export const buildWorkflowApprovalFillPath = (token: string): string => {
  return `${token}/fill`;
};
