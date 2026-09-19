import { getOutputSchemaFromValue } from 'twenty-shared/logic-function';
import { isDefined } from 'twenty-shared/utils';

export const OUTREACH_WF_ERROR_HANDLING = {
  retryOnFailure: { value: false },
  continueOnFailure: { value: false },
};

export const OUTREACH_WF_MEMBER_STEP_ID =
  'b8e1d001-4a11-4c11-8c11-000000000001';
/** Separate member path for "no company name" so IF_ELSE skip does not kill the company path join. */
export const OUTREACH_WF_MEMBER_NO_COMPANY_STEP_ID =
  'c7a10007-4a11-4c11-8c11-000000000001';

export const OUTREACH_WF_AGENT_LINKEDIN = '__AGENT_linkedin_message__';
export const OUTREACH_WF_AGENT_EMAIL = '__AGENT_fallback_email__';
export const OUTREACH_WF_AGENT_REPLY = '__AGENT_reply__';
export const OUTREACH_WF_AGENT_EXTRACT = '__AGENT_extract_signals__';
export const OUTREACH_WF_AGENT_QUALIFY = '__AGENT_qualify_prospect__';

export const OUTREACH_WF_HARVEST_PROJECT_ID = '__PROJECT_OUTREACH_HARVEST__';

export const OUTREACH_WF_FIELD = {
  candidateId: '__FIELD_candidate.id__',
  chatCandidateId: '__FIELD_chatMessage.candidateId__',
  chatCreatedAt: '__FIELD_chatMessage.createdAt__',
  outreachSequenceStage: '__FIELD_candidate.outreachSequenceStage__',
  candidateFlags: '__FIELD_candidate.candidateFlags__',
  // FIND Person filter metadata (identity lives on people, not candidate)
  jobCompanyName: '__FIELD_person.jobCompanyName__',
  peopleJobCompanyName: 'people.jobCompanyName',
  peopleLinkedinProfileId: 'people.linkedinProfileId',
  peopleJobTitle: 'people.jobTitle',
  projectId: '__FIELD_candidate.projectId__',
  createdAt: '__FIELD_candidate.createdAt__',
} as const;

export type OutreachWfFindRecordFilter = {
  fieldMetadataId: string;
  filterValue: string;
  filterType?: string;
  filterLabel?: string;
  filterOperand?: string;
};

export const gtmWfSelectIsValue = (option: string) => JSON.stringify([option]);

export const OUTREACH_WF_AI_MESSAGE_OUTPUT = {
  message: {
    isLeaf: true,
    type: 'string',
    label: 'message',
    value: '',
  },
};

export const OUTREACH_WF_AI_EMAIL_OUTPUT = {
  subject: {
    isLeaf: true,
    type: 'string',
    label: 'subject',
    value: '',
  },
  message: {
    isLeaf: true,
    type: 'string',
    label: 'message',
    value: '',
  },
};

// Copy only. Times, channel and contacts come from the validated signals step.
export const OUTREACH_WF_AI_REPLY_OUTPUT = {
  message: {
    isLeaf: true,
    type: 'string',
    label: 'message',
    value: '',
  },
  emailSubject: {
    isLeaf: true,
    type: 'string',
    label: 'emailSubject',
    value: '',
  },
  emailBody: {
    isLeaf: true,
    type: 'string',
    label: 'emailBody',
    value: '',
  },
  referralMessage: {
    isLeaf: true,
    type: 'string',
    label: 'referralMessage',
    value: '',
  },
  referralCandidateId: {
    isLeaf: true,
    type: 'string',
    label: 'referralCandidateId',
    value: '',
  },
};

export const OUTREACH_WF_AI_EXTRACT_OUTPUT = {
  acceptedSlotIndex: {
    isLeaf: true,
    type: 'number',
    label: 'acceptedSlotIndex',
    value: -1,
  },
  requestedChannelSwitch: {
    isLeaf: true,
    type: 'string',
    label: 'requestedChannelSwitch',
    value: 'NONE',
  },
  prospectEmail: {
    isLeaf: true,
    type: 'string',
    label: 'prospectEmail',
    value: '',
  },
  referralName: {
    isLeaf: true,
    type: 'string',
    label: 'referralName',
    value: '',
  },
  referralEmail: {
    isLeaf: true,
    type: 'string',
    label: 'referralEmail',
    value: '',
  },
  referralPhone: {
    isLeaf: true,
    type: 'string',
    label: 'referralPhone',
    value: '',
  },
  shouldNotRespond: {
    isLeaf: true,
    type: 'boolean',
    label: 'shouldNotRespond',
    value: false,
  },
};

export const OUTREACH_WF_AI_QUALIFY_OUTPUT = {
  go: {
    isLeaf: true,
    type: 'boolean',
    label: 'go',
    value: false,
  },
  score: {
    isLeaf: true,
    type: 'number',
    label: 'score',
    value: 0,
  },
  segment: {
    isLeaf: true,
    type: 'string',
    label: 'segment',
    value: '',
  },
  reason: {
    isLeaf: true,
    type: 'string',
    label: 'reason',
    value: '',
  },
  first_name: {
    isLeaf: true,
    type: 'string',
    label: 'first_name',
    value: '',
  },
  honorific: {
    isLeaf: true,
    type: 'string',
    label: 'honorific',
    value: '',
  },
  company_short: {
    isLeaf: true,
    type: 'string',
    label: 'company_short',
    value: '',
  },
  industry_phrase: {
    isLeaf: true,
    type: 'string',
    label: 'industry_phrase',
    value: '',
  },
  hooks: {
    isLeaf: true,
    type: 'string',
    label: 'hooks',
    value: '',
  },
  likely_systems: {
    isLeaf: true,
    type: 'string',
    label: 'likely_systems',
    value: '',
  },
  matching_problem_statement: {
    isLeaf: true,
    type: 'string',
    label: 'matching_problem_statement',
    value: '',
  },
  referral_source: {
    isLeaf: true,
    type: 'string',
    label: 'referral_source',
    value: '',
  },
};

const v = (stepId: string, path: string) => `{{${stepId}.${path}}}`;

export const gtmWfTriggerAfter = (field: string) =>
  `{{trigger.properties.after.${field}}}`;

export const gtmWfTriggerPayload = (field: string) =>
  `{{trigger.payload.${field}}}`;

export const gtmWfMemberId = (
  memberStepId: string = OUTREACH_WF_MEMBER_STEP_ID,
) => v(memberStepId, 'first.id');

export const gtmWfMemberPhone = (
  memberStepId: string = OUTREACH_WF_MEMBER_STEP_ID,
) => v(memberStepId, 'first.phoneNumber');

export const gtmWfMemberEmail = (
  memberStepId: string = OUTREACH_WF_MEMBER_STEP_ID,
) => v(memberStepId, 'first.userEmail');

export const gtmWfMemberSenderProfile = (
  memberStepId: string = OUTREACH_WF_MEMBER_STEP_ID,
) => v(memberStepId, 'first.outreachSenderProfile');

export const gtmWfFindId = (findStepId: string) => v(findStepId, 'first.id');

export const gtmWfFindField = (findStepId: string, field: string) =>
  v(findStepId, `first.${field}`);

// Pipe-separated at authoring time; send-time formatters turn this into
// Meta-safe one-liners (template {{2}}) or real newlines (Flow / Unipile).
export const gtmWfFormDetailsTemplate = ({
  findId,
  draftStepId,
  extra,
}: {
  findId: string;
  draftStepId?: string;
  extra?: string[];
}): string =>
  [
    `Contact: ${gtmWfFindField(findId, 'name')}`,
    `Title: ${gtmWfFindField(findId, OUTREACH_WF_FIELD.peopleJobTitle)}`,
    `Company: ${gtmWfFindField(findId, OUTREACH_WF_FIELD.peopleJobCompanyName)}`,
    ...(draftStepId ? [`Draft: {{${draftStepId}.message}}`] : []),
    ...(extra ?? []),
  ].join(' | ');

type StepBase = {
  id: string;
  name: string;
  type: string;
  valid: true;
  nextStepIds?: string[];
  settings: Record<string, unknown>;
};

const withNext = (step: StepBase, nextStepIds?: string[]): StepBase =>
  nextStepIds ? { ...step, nextStepIds } : step;

export const gtmWfLogicFunctionStep = ({
  id,
  name,
  logicFunctionId,
  logicFunctionInput,
  sampleOutput,
  nextStepIds,
}: {
  id: string;
  name: string;
  logicFunctionId: string;
  logicFunctionInput: Record<string, unknown>;
  sampleOutput: object;
  nextStepIds?: string[];
}): StepBase =>
  withNext(
    {
      id,
      name,
      type: 'LOGIC_FUNCTION',
      valid: true,
      settings: {
        input: { logicFunctionId, logicFunctionInput },
        outputSchema: getOutputSchemaFromValue(sampleOutput),
        errorHandlingOptions: OUTREACH_WF_ERROR_HANDLING,
      },
    },
    nextStepIds,
  );

export const gtmWfFindRecordsStep = ({
  id,
  name,
  objectName,
  fieldMetadataId,
  filterValue,
  filterType = 'UUID',
  filterLabel = 'Id',
  filterOperand = 'IS',
  filters,
  nextStepIds,
  limit = 1,
  orderBy,
}: {
  id: string;
  name: string;
  objectName: string;
  fieldMetadataId?: string;
  filterValue?: string;
  filterType?: string;
  filterLabel?: string;
  filterOperand?: string;
  filters?: OutreachWfFindRecordFilter[];
  nextStepIds?: string[];
  limit?: number;
  orderBy?: {
    recordSorts?: Array<Record<string, unknown>>;
    gqlOperationOrderBy?: Array<Record<string, unknown>>;
  };
}): StepBase => {
  const groupId = `${id.slice(0, 8)}-0000-4000-8000-00000000f001`;
  const resolvedFilters: OutreachWfFindRecordFilter[] =
    filters && filters.length > 0
      ? filters
      : fieldMetadataId && filterValue
        ? [
            {
              fieldMetadataId,
              filterValue,
              filterType,
              filterLabel,
              filterOperand,
            },
          ]
        : [];

  const filter =
    resolvedFilters.length > 0
      ? {
          recordFilterGroups: [{ id: groupId, logicalOperator: 'AND' }],
          recordFilters: resolvedFilters.map((entry, index) => ({
            id: `${id.slice(0, 8)}-0000-4000-8000-00000000f${String(index + 2).padStart(3, '0')}`,
            type: entry.filterType ?? 'UUID',
            label: entry.filterLabel ?? 'Id',
            value: entry.filterValue,
            operand: entry.filterOperand ?? 'IS',
            displayValue: entry.filterValue,
            fieldMetadataId: entry.fieldMetadataId,
            recordFilterGroupId: groupId,
          })),
        }
      : {};

  return withNext(
    {
      id,
      name,
      type: 'FIND_RECORDS',
      valid: true,
      settings: {
        input: {
          limit,
          filter,
          objectName,
          ...(orderBy ? { orderBy } : {}),
        },
        outputSchema: {},
        errorHandlingOptions: OUTREACH_WF_ERROR_HANDLING,
      },
    },
    nextStepIds,
  );
};

export const gtmWfFilterStep = ({
  id,
  name,
  stepOutputKey,
  value,
  type = 'SELECT',
  fieldMetadataId = OUTREACH_WF_FIELD.outreachSequenceStage,
  nextStepIds,
}: {
  id: string;
  name: string;
  stepOutputKey: string;
  value: string;
  type?: string;
  fieldMetadataId?: string;
  nextStepIds?: string[];
}): StepBase => {
  const groupId = `${id.slice(0, 8)}-0000-4000-8000-00000000a001`;
  const filterId = `${id.slice(0, 8)}-0000-4000-8000-00000000a002`;

  return withNext(
    {
      id,
      name,
      type: 'FILTER',
      valid: true,
      settings: {
        input: {
          stepFilters: [
            {
              id: filterId,
              type,
              value: gtmWfSelectIsValue(value),
              operand: 'IS',
              stepOutputKey,
              stepFilterGroupId: groupId,
              fieldMetadataId,
            },
          ],
          stepFilterGroups: [{ id: groupId, logicalOperator: 'AND' }],
        },
        outputSchema: {},
        errorHandlingOptions: OUTREACH_WF_ERROR_HANDLING,
      },
    },
    nextStepIds,
  );
};

export const gtmWfIfElseStep = ({
  id,
  name,
  stepOutputKey,
  value,
  type = 'TEXT',
  operand = 'IS',
  ifNextStepIds,
  elseNextStepIds,
}: {
  id: string;
  name: string;
  stepOutputKey: string;
  value: string;
  type?: string;
  operand?: string;
  ifNextStepIds: string[];
  elseNextStepIds: string[];
}): StepBase => {
  const groupId = `${id.slice(0, 8)}-0000-4000-8000-00000000b001`;
  const filterId = `${id.slice(0, 8)}-0000-4000-8000-00000000b002`;
  const ifBranchId = `${id.slice(0, 8)}-0000-4000-8000-00000000b003`;
  const elseBranchId = `${id.slice(0, 8)}-0000-4000-8000-00000000b004`;

  return {
    id,
    name,
    type: 'IF_ELSE',
    valid: true,
    nextStepIds: [],
    settings: {
      input: {
        stepFilterGroups: [{ id: groupId, logicalOperator: 'AND' }],
        stepFilters: [
          {
            id: filterId,
            type,
            value: type === 'SELECT' ? gtmWfSelectIsValue(value) : value,
            operand,
            stepOutputKey,
            stepFilterGroupId: groupId,
            positionInStepFilterGroup: 0,
            fieldMetadataId:
              type === 'SELECT'
                ? OUTREACH_WF_FIELD.outreachSequenceStage
                : undefined,
          },
        ],
        branches: [
          {
            id: ifBranchId,
            filterGroupId: groupId,
            nextStepIds: ifNextStepIds,
          },
          { id: elseBranchId, nextStepIds: elseNextStepIds },
        ],
      },
      outputSchema: {},
      errorHandlingOptions: OUTREACH_WF_ERROR_HANDLING,
    },
  };
};

export const gtmWfMultiIfElseStep = ({
  id,
  name,
  branches,
}: {
  id: string;
  name: string;
  branches: Array<{
    id: string;
    filterGroupId?: string;
    filterId?: string;
    stepOutputKey?: string;
    value?: string;
    type?: string;
    operand?: string;
    fieldMetadataId?: string;
    nextStepIds: string[];
  }>;
}): StepBase => {
  const stepFilterGroups: Array<Record<string, unknown>> = [];
  const stepFilters: Array<Record<string, unknown>> = [];
  const ifElseBranches: Array<Record<string, unknown>> = [];

  for (const branch of branches) {
    if (
      !branch.filterGroupId ||
      !branch.filterId ||
      !branch.stepOutputKey ||
      branch.value === undefined
    ) {
      ifElseBranches.push({
        id: branch.id,
        nextStepIds: branch.nextStepIds,
      });
      continue;
    }

    stepFilterGroups.push({
      id: branch.filterGroupId,
      logicalOperator: 'AND',
    });
    const filterType = branch.type ?? 'SELECT';

    stepFilters.push({
      id: branch.filterId,
      type: filterType,
      value:
        filterType === 'SELECT'
          ? gtmWfSelectIsValue(branch.value)
          : branch.value,
      operand: branch.operand ?? 'IS',
      stepOutputKey: branch.stepOutputKey,
      stepFilterGroupId: branch.filterGroupId,
      positionInStepFilterGroup: 0,
      fieldMetadataId:
        branch.fieldMetadataId ??
        (filterType === 'SELECT'
          ? OUTREACH_WF_FIELD.outreachSequenceStage
          : undefined),
    });
    ifElseBranches.push({
      id: branch.id,
      filterGroupId: branch.filterGroupId,
      nextStepIds: branch.nextStepIds,
    });
  }

  return {
    id,
    name,
    type: 'IF_ELSE',
    valid: true,
    nextStepIds: [],
    settings: {
      input: {
        stepFilterGroups,
        stepFilters,
        branches: ifElseBranches,
      },
      outputSchema: {},
      errorHandlingOptions: OUTREACH_WF_ERROR_HANDLING,
    },
  };
};

export const OUTREACH_POST_REPLY_EMAIL_SUBJECT = 'Quick follow-up';

// EMAIL → WhatsApp → LinkedIn default for preferred / last-inbound channel.
// Omit whatsappBranch to collapse to EMAIL → LinkedIn.
export const gtmWfPreferredChannelRouterStep = ({
  id,
  name,
  channelStepOutputKey,
  emailBranch,
  whatsappBranch,
  linkedinBranch,
}: {
  id: string;
  name: string;
  channelStepOutputKey: string;
  emailBranch: {
    id: string;
    filterGroupId: string;
    filterId: string;
    nextStepIds: string[];
  };
  whatsappBranch?: {
    id: string;
    filterGroupId: string;
    filterId: string;
    nextStepIds: string[];
  };
  linkedinBranch: {
    id: string;
    nextStepIds: string[];
  };
}): StepBase =>
  gtmWfMultiIfElseStep({
    id,
    name,
    branches: [
      {
        ...emailBranch,
        stepOutputKey: channelStepOutputKey,
        value: 'EMAIL',
        type: 'TEXT',
        operand: 'CONTAINS',
      },
      ...(isDefined(whatsappBranch)
        ? [
            {
              ...whatsappBranch,
              stepOutputKey: channelStepOutputKey,
              value: 'WHATSAPP',
              type: 'TEXT' as const,
              operand: 'CONTAINS' as const,
            },
          ]
        : []),
      linkedinBranch,
    ],
  });

export const gtmWfAiAgentStep = ({
  id,
  name,
  prompt,
  agentId,
  outputSchema,
  nextStepIds,
}: {
  id: string;
  name: string;
  prompt: string;
  agentId: string;
  outputSchema: Record<string, unknown>;
  nextStepIds?: string[];
}): StepBase =>
  withNext(
    {
      id,
      name,
      type: 'AI_AGENT',
      valid: true,
      settings: {
        input: { prompt, agentId },
        outputSchema,
        errorHandlingOptions: OUTREACH_WF_ERROR_HANDLING,
      },
    },
    nextStepIds,
  );

export const gtmWfFormStep = ({
  id,
  name,
  editedBodyValue,
  contextTemplate,
  detailsTemplate,
  approveLabel = 'Approve send',
  extraFields = [],
  nextStepIds,
}: {
  id: string;
  name: string;
  editedBodyValue?: string;
  contextTemplate: string;
  detailsTemplate: string;
  approveLabel?: string;
  extraFields?: Array<Record<string, unknown>>;
  nextStepIds?: string[];
}): StepBase => {
  const approveFieldId = `${id.slice(0, 8)}-0000-4000-8000-00000000c001`;
  const bodyFieldId = `${id.slice(0, 8)}-0000-4000-8000-00000000c002`;

  const input: Array<Record<string, unknown>> = [
    {
      id: approveFieldId,
      name: 'approve',
      type: 'BOOLEAN',
      label: approveLabel,
      value: true,
    },
    ...(editedBodyValue !== undefined
      ? [
          {
            id: bodyFieldId,
            name: 'editedBody',
            type: 'TEXT',
            label: 'Edited message',
            value: editedBodyValue,
          },
        ]
      : []),
    ...extraFields,
  ];

  return withNext(
    {
      id,
      name,
      type: 'FORM',
      valid: true,
      settings: {
        input,
        outputSchema: {},
        notifyOnPending: {
          channels: ['WHATSAPP_OFFICIAL'],
          contextTemplate,
          detailsTemplate,
          whatsappOfficialRegistryName: 'wf_form_boolean_text',
          recipients: {
            WHATSAPP_OFFICIAL: gtmWfMemberPhone(),
            WHATSAPP_UNIPILE: gtmWfMemberPhone(),
          },
        },
        errorHandlingOptions: OUTREACH_WF_ERROR_HANDLING,
      },
    },
    nextStepIds,
  );
};

export const gtmWfDelayStep = ({
  id,
  name,
  days,
  nextStepIds,
}: {
  id: string;
  name: string;
  days: number;
  nextStepIds?: string[];
}): StepBase =>
  withNext(
    {
      id,
      name,
      type: 'DELAY',
      valid: true,
      settings: {
        input: {
          duration: { days, hours: 0, minutes: 0, seconds: 0 },
          delayType: 'DURATION',
        },
        outputSchema: {},
        errorHandlingOptions: OUTREACH_WF_ERROR_HANDLING,
      },
    },
    nextStepIds,
  );

export const gtmWfUpdateRecordStep = ({
  id,
  name,
  objectRecordId,
  objectRecord,
  nextStepIds,
}: {
  id: string;
  name: string;
  objectRecordId: string;
  objectRecord: Record<string, unknown>;
  nextStepIds?: string[];
}): StepBase =>
  withNext(
    {
      id,
      name,
      type: 'UPDATE_RECORD',
      valid: true,
      settings: {
        input: {
          objectName: 'candidate',
          objectRecord,
          objectRecordId,
          fieldsToUpdate: Object.keys(objectRecord),
        },
        outputSchema: {},
        errorHandlingOptions: OUTREACH_WF_ERROR_HANDLING,
      },
    },
    nextStepIds,
  );

export const gtmWfSendLinkedInMessageStep = ({
  id,
  name,
  body,
  candidateId,
  linkedinProfileId,
  nextStepIds,
}: {
  id: string;
  name: string;
  body: string;
  candidateId: string;
  linkedinProfileId: string;
  nextStepIds?: string[];
}): StepBase =>
  withNext(
    {
      id,
      name,
      type: 'SEND_LINKEDIN_MESSAGE',
      valid: true,
      settings: {
        input: {
          body,
          candidateId,
          linkedinProfileId,
          workspaceMemberId: gtmWfMemberId(),
          files: [],
        },
        outputSchema: {},
        errorHandlingOptions: OUTREACH_WF_ERROR_HANDLING,
      },
    },
    nextStepIds,
  );

export const gtmWfSendEmailStep = ({
  id,
  name,
  to,
  subject,
  body,
  nextStepIds,
}: {
  id: string;
  name: string;
  to: string;
  subject: string;
  body: string;
  nextStepIds?: string[];
}): StepBase =>
  withNext(
    {
      id,
      name,
      type: 'SEND_EMAIL',
      valid: true,
      settings: {
        input: {
          body,
          subject,
          recipients: { cc: '', to, bcc: '' },
          connectedAccountId: '',
        },
        outputSchema: {},
        errorHandlingOptions: OUTREACH_WF_ERROR_HANDLING,
      },
    },
    nextStepIds,
  );

export const gtmWfSendWhatsappMessageStep = ({
  id,
  name,
  phone,
  body,
  candidateId,
  nextStepIds,
}: {
  id: string;
  name: string;
  phone: string;
  body: string;
  candidateId?: string;
  nextStepIds?: string[];
}): StepBase =>
  withNext(
    {
      id,
      name,
      type: 'SEND_WHATSAPP_MESSAGE',
      valid: true,
      settings: {
        input: {
          phone,
          body,
          ...(candidateId ? { candidateId } : {}),
          workspaceMemberId: gtmWfMemberId(),
        },
        outputSchema: {},
        errorHandlingOptions: OUTREACH_WF_ERROR_HANDLING,
      },
    },
    nextStepIds,
  );

// Arx sender fields (phone, outreachSenderProfile, Unipile ids) live on
// workspaceMember after the profile fold — one FIND is enough.
export const gtmWfMemberStep = (
  nextStepIds: string[],
  {
    memberStepId = OUTREACH_WF_MEMBER_STEP_ID,
    memberStepName = 'Load workspace member',
  }: {
    memberStepId?: string;
    memberStepName?: string;
  } = {},
): StepBase =>
  gtmWfFindRecordsStep({
    id: memberStepId,
    name: memberStepName,
    objectName: 'workspaceMember',
    nextStepIds,
  });

export const gtmWfDatabaseEventTrigger = ({
  name,
  eventName,
  nextStepIds,
  fields,
  filter,
}: {
  name: string;
  eventName: string;
  nextStepIds: string[];
  fields?: string[];
  filter?: Record<string, unknown>;
}) => ({
  name,
  type: 'DATABASE_EVENT',
  position: { x: 0, y: 0 },
  settings: {
    eventName,
    outputSchema: {},
    ...(fields && fields.length > 0 ? { fields } : {}),
    ...(filter ? { filter } : {}),
  },
  nextStepIds,
});

// Stages a candidate may enter the sequencer on. Disjoint from stamps the
// reply agent / UPDATE_RECORD nodes write except MEETING_BOOKED, which
// intentionally re-enters the meeting-booked branch after calendar create.
// Safe non-entry stamps: CONNECTION_SENT, DEFERRED, EMAIL_SENT, FAILED_ENRICH,
// WAITING_REPLY, FAILED_NO_REPLY.
export const OUTREACH_WF_ENTRY_STAGES = [
  'QUEUED',
  'CONNECTION_ACCEPTED',
  'REPLIED',
  'MEETING_BOOKED',
] as const;

export const OUTREACH_WF_ENTRY_STAGES_WITHOUT_MEETING_BOOKED = [
  'QUEUED',
  'CONNECTION_ACCEPTED',
  'REPLIED',
] as const;

const OUTREACH_WF_ENTRY_STAGE_FILTER_GROUP_ID =
  '7d3a1b90-5c2e-4f18-9a64-2b8e0c1d3f45';
const OUTREACH_WF_ENTRY_STAGE_FILTER_ID =
  '8e4b2ca1-6d3f-4a29-8b75-3c9f1d2e4a56';
const OUTREACH_WF_ENTRY_START_OUTREACH_FILTER_ID =
  '9f5c3db2-7e40-4b3a-9c86-4d0a2e3f5b67';
const OUTREACH_WF_ENTRY_STOP_OUTREACH_FILTER_ID =
  'a06d4ec3-8f51-4c4b-ad97-5e1b3f4a6c78';

// Evaluated against the event payload before a run is created, so noise stamps
// never enqueue a throwaway run. startOutreach / stopOutreach live in
// candidateFlags (same JSON as startChat), nested under the after payload.
export const gtmWfEntryStageTriggerFilter = ({
  includeMeetingBooked = true,
}: {
  includeMeetingBooked?: boolean;
} = {}) => ({
  stepFilterGroups: [
    { id: OUTREACH_WF_ENTRY_STAGE_FILTER_GROUP_ID, logicalOperator: 'AND' },
  ],
  stepFilters: [
    {
      id: OUTREACH_WF_ENTRY_STAGE_FILTER_ID,
      type: 'SELECT',
      value: JSON.stringify(
        includeMeetingBooked
          ? OUTREACH_WF_ENTRY_STAGES
          : OUTREACH_WF_ENTRY_STAGES_WITHOUT_MEETING_BOOKED,
      ),
      operand: 'IS',
      stepOutputKey: gtmWfTriggerAfter('outreachSequenceStage'),
      stepFilterGroupId: OUTREACH_WF_ENTRY_STAGE_FILTER_GROUP_ID,
      positionInStepFilterGroup: 0,
      fieldMetadataId: OUTREACH_WF_FIELD.outreachSequenceStage,
    },
    {
      id: OUTREACH_WF_ENTRY_START_OUTREACH_FILTER_ID,
      type: 'BOOLEAN',
      value: 'true',
      operand: 'IS',
      stepOutputKey: gtmWfTriggerAfter('candidateFlags.startOutreach'),
      stepFilterGroupId: OUTREACH_WF_ENTRY_STAGE_FILTER_GROUP_ID,
      positionInStepFilterGroup: 1,
      fieldMetadataId: OUTREACH_WF_FIELD.candidateFlags,
    },
    {
      id: OUTREACH_WF_ENTRY_STOP_OUTREACH_FILTER_ID,
      type: 'BOOLEAN',
      value: 'false',
      operand: 'IS',
      stepOutputKey: gtmWfTriggerAfter('candidateFlags.stopOutreach'),
      stepFilterGroupId: OUTREACH_WF_ENTRY_STAGE_FILTER_GROUP_ID,
      positionInStepFilterGroup: 2,
      fieldMetadataId: OUTREACH_WF_FIELD.candidateFlags,
    },
  ],
});

export const gtmWfManualTrigger = ({
  name = 'Launch manually',
  icon = 'IconUsersPlus',
  nextStepIds,
}: {
  name?: string;
  icon?: string;
  nextStepIds: string[];
}) => ({
  name,
  type: 'MANUAL',
  position: { x: 0, y: 0 },
  settings: {
    outputSchema: {},
    icon,
    availability: { type: 'GLOBAL' },
  },
  nextStepIds,
});

export const gtmWfManualRecordTrigger = ({
  name = 'Launch manually',
  icon = 'IconHandMove',
  objectNameSingular,
  nextStepIds,
  isPinned = true,
}: {
  name?: string;
  icon?: string;
  objectNameSingular: string;
  nextStepIds: string[];
  isPinned?: boolean;
}) => ({
  name,
  type: 'MANUAL',
  position: { x: 0, y: 0 },
  settings: {
    outputSchema: {},
    icon,
    isPinned,
    objectType: objectNameSingular,
    availability: {
      type: 'SINGLE_RECORD' as const,
      objectNameSingular,
    },
  },
  nextStepIds,
});

// Rewrite DATABASE_EVENT trigger paths to MANUAL single-record payload paths.
export const rewriteTriggerAfterPathsToPayload = <T>(value: T): T =>
  JSON.parse(
    JSON.stringify(value).replaceAll(
      '{{trigger.properties.after.',
      '{{trigger.payload.',
    ),
  );
