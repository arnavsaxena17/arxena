// Standard (manual) draft messages for the Candidate Sequencer. Templates live
// on the workspace member and use {{variable}} tokens that the render step
// resolves per candidate. Shared so Setup preview and the server render agree.

export const OUTREACH_DRAFT_TEMPLATE_KEYS = [
  'connectionNote',
  'firstMessage',
  'followUp1',
  'followUp2',
  'followUp3',
] as const;

export type OutreachDraftTemplateKey =
  (typeof OUTREACH_DRAFT_TEMPLATE_KEYS)[number];

export const OUTREACH_DRAFT_TEMPLATE_FIELD_NAMES: Record<
  OutreachDraftTemplateKey,
  string
> = {
  connectionNote: 'outreachDraftConnectionNote',
  firstMessage: 'outreachDraftFirstMessage',
  followUp1: 'outreachDraftFollowUp1',
  followUp2: 'outreachDraftFollowUp2',
  followUp3: 'outreachDraftFollowUp3',
};

// JSON on the workspace member: { [templateKey]: WorkflowAttachment[] }
export const OUTREACH_DRAFT_ATTACHMENTS_FIELD_NAME = 'outreachDraftAttachments';

export const OUTREACH_DRAFT_TEMPLATE_LABELS: Record<
  OutreachDraftTemplateKey,
  string
> = {
  connectionNote: 'Connection note',
  firstMessage: 'First message',
  followUp1: 'Follow-up 1',
  followUp2: 'Follow-up 2',
  followUp3: 'Follow-up 3',
};

// LinkedIn rejects longer invitation notes.
export const OUTREACH_DRAFT_CONNECTION_NOTE_MAX_LENGTH = 300;

export type OutreachDraftVariableKey =
  | 'person.firstName'
  | 'person.fullName'
  | 'company.name'
  | 'sender.name'
  | 'sender.website';

export type OutreachDraftVariable = {
  key: OutreachDraftVariableKey;
  label: string;
  token: string;
  sampleValue: string;
};

const toToken = (key: OutreachDraftVariableKey) => `{{${key}}}`;

export const OUTREACH_DRAFT_VARIABLES: OutreachDraftVariable[] = [
  {
    key: 'person.firstName',
    label: 'Person First Name',
    token: toToken('person.firstName'),
    sampleValue: 'Priya',
  },
  {
    key: 'person.fullName',
    label: 'Person Full Name',
    token: toToken('person.fullName'),
    sampleValue: 'Priya Sharma',
  },
  {
    key: 'company.name',
    label: 'Company Name',
    token: toToken('company.name'),
    sampleValue: 'Acme Retail',
  },
  {
    key: 'sender.name',
    label: 'Sender Name',
    token: toToken('sender.name'),
    sampleValue: 'Arnav Saxena',
  },
  {
    key: 'sender.website',
    label: 'Sender Website',
    token: toToken('sender.website'),
    sampleValue: 'www.example.com',
  },
];

export const OUTREACH_DRAFT_DEFAULT_TEMPLATES: Record<
  OutreachDraftTemplateKey,
  string
> = {
  connectionNote: [
    'Hi,',
    'Looking forward to connecting with you.',
    'Regards,',
    toToken('sender.name'),
  ].join('\n'),
  firstMessage: [
    `Hi ${toToken('person.firstName')},`,
    `I’ve spent 30+ years as a CEO managing P&Ls of over ₹3,000 Cr across retail and consumer brands. I’ve distilled that experience into an AI-powered platform that helps businesses like ${toToken('company.name')} accelerate profitable growth.`,
    `Could we set up a 30-minute call? I’d like to walk you through the platform so you can evaluate the value it could bring to ${toToken('company.name')}.`,
    'Best,',
    toToken('sender.name'),
    toToken('sender.website'),
  ].join('\n'),
  followUp1: [
    'Hello,',
    'I was circling back to check here.',
    'The platform is easy to adopt, costs a fraction of other tools and delivers immediate benefits. Would love to catch up and tell you more. Let me know if we can connect over a short call?',
    'I’m attaching a small note for reference.',
    toToken('sender.name'),
  ].join('\n'),
  followUp2: [
    'Hi,',
    'Did you get a chance to see my previous messages? Omniways is a real-time AI Agent that has completely changed tactical decision making in our existing clients towards direct margin improvements.',
    'I would love to show you a quick preview. Please let me know?',
    toToken('sender.name'),
  ].join('\n'),
  followUp3: [
    'Hi,',
    'Tried reaching you a few times but haven’t heard back. Please suggest how we can take this forward, would you like to recommend me to someone in your company to take this forward?',
    toToken('sender.name'),
  ].join('\n'),
};

export type OutreachDraftTemplateValues = Partial<
  Record<OutreachDraftVariableKey, string | null | undefined>
>;

const KNOWN_VARIABLE_KEYS = new Set<string>(
  OUTREACH_DRAFT_VARIABLES.map((variable) => variable.key),
);

const TOKEN_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g;
// Single-brace placeholders such as {Sender Name} are never resolved.
const STRAY_BRACE_PATTERN = /(?<!\{)\{(?!\{)[^{}]*\}(?!\})/g;

export const extractOutreachDraftTemplateVariableKeys = (
  template: string,
): string[] => {
  const keys: string[] = [];

  for (const match of template.matchAll(TOKEN_PATTERN)) {
    if (!keys.includes(match[1])) {
      keys.push(match[1]);
    }
  }

  return keys;
};

export type OutreachDraftTemplateRenderResult = {
  message: string;
  // Variables used by the template whose value is empty. They block sending.
  missingVariableKeys: string[];
  unknownVariableKeys: string[];
};

export const renderOutreachDraftTemplate = (
  template: string,
  values: OutreachDraftTemplateValues,
): OutreachDraftTemplateRenderResult => {
  const missingVariableKeys: string[] = [];
  const unknownVariableKeys: string[] = [];

  const message = template.replace(TOKEN_PATTERN, (_token, rawKey: string) => {
    const key = rawKey.trim();

    if (!KNOWN_VARIABLE_KEYS.has(key)) {
      if (!unknownVariableKeys.includes(key)) {
        unknownVariableKeys.push(key);
      }

      return '';
    }

    const value = values[key as OutreachDraftVariableKey]?.trim() ?? '';

    if (value === '') {
      if (!missingVariableKeys.includes(key)) {
        missingVariableKeys.push(key);
      }
    }

    return value;
  });

  return { message, missingVariableKeys, unknownVariableKeys };
};

export type OutreachDraftTemplateValidation = {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  renderedMessage: string;
};

const getVariableLabel = (key: string): string =>
  OUTREACH_DRAFT_VARIABLES.find((variable) => variable.key === key)?.label ??
  key;

export const validateOutreachDraftTemplate = ({
  templateKey,
  template,
  values,
}: {
  templateKey: OutreachDraftTemplateKey;
  template: string;
  // Values of the sample candidate/sender used for the preview.
  values: OutreachDraftTemplateValues;
}): OutreachDraftTemplateValidation => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (template.trim() === '') {
    return {
      isValid: false,
      errors: ['Template is empty.'],
      warnings,
      renderedMessage: '',
    };
  }

  const strayBraces = template.match(STRAY_BRACE_PATTERN) ?? [];

  if (strayBraces.length > 0) {
    errors.push(
      `Unsupported placeholder ${strayBraces.join(', ')}. Insert variables with the variable picker.`,
    );
  }

  const rendered = renderOutreachDraftTemplate(template, values);

  if (rendered.unknownVariableKeys.length > 0) {
    errors.push(
      `Unknown variable${rendered.unknownVariableKeys.length > 1 ? 's' : ''}: ${rendered.unknownVariableKeys.join(', ')}.`,
    );
  }

  if (rendered.missingVariableKeys.length > 0) {
    errors.push(
      `No value for ${rendered.missingVariableKeys.map(getVariableLabel).join(', ')}. The send is blocked when a variable is empty.`,
    );
  }

  if (
    templateKey === 'connectionNote' &&
    rendered.message.length > OUTREACH_DRAFT_CONNECTION_NOTE_MAX_LENGTH
  ) {
    errors.push(
      `Connection note is ${rendered.message.length} characters; LinkedIn allows ${OUTREACH_DRAFT_CONNECTION_NOTE_MAX_LENGTH}.`,
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    renderedMessage: rendered.message,
  };
};
