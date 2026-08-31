import { getOutputSchemaFromValue } from 'twenty-shared/logic-function';

export const OUTREACH_WF_ERROR_HANDLING = {
  retryOnFailure: { value: false },
  continueOnFailure: { value: false },
};

export const OUTREACH_WF_MEMBER_STEP_ID = 'b8e1d001-4a11-4c11-8c11-000000000001';
export const OUTREACH_WF_PROFILE_STEP_ID = 'b8e1d002-4a22-4c22-8c22-000000000002';
/** Separate member/profile path for "no company name" so IF_ELSE skip does not kill the company path join. */
export const OUTREACH_WF_MEMBER_NO_COMPANY_STEP_ID =
  'c7a10007-4a11-4c11-8c11-000000000001';
export const OUTREACH_WF_PROFILE_NO_COMPANY_STEP_ID =
  'c7a10008-4a22-4c22-8c22-000000000002';

export const OUTREACH_WF_AGENT_LINKEDIN = '__AGENT_linkedin_message__';
export const OUTREACH_WF_AGENT_EMAIL = '__AGENT_fallback_email__';
export const OUTREACH_WF_AGENT_REPLY = '__AGENT_reply__';

export const OUTREACH_WF_HARVEST_PROJECT_ID = '__PROJECT_OUTREACH_HARVEST__';

export const OUTREACH_WF_FIELD = {
  candidateId: '__FIELD_candidate.id__',
  memberId: '__FIELD_workspaceMember.id__',
  profileMemberId: '__FIELD_workspaceMemberProfile.workspaceMemberId__',
  chatCandidateId: '__FIELD_chatMessage.candidateId__',
  outreachSequenceStage: '__FIELD_candidate.outreachSequenceStage__',
  jobCompanyName: '__FIELD_candidate.jobCompanyName__',
  projectsId: '__FIELD_candidate.projectsId__',
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

export const OUTREACH_WF_AI_REPLY_OUTPUT = {
  message: {
    isLeaf: true,
    type: 'string',
    label: 'message',
    value: '',
  },
  intent: {
    isLeaf: true,
    type: 'string',
    label: 'intent',
    value: '',
  },
  proposedSlots: {
    isLeaf: true,
    type: 'string',
    label: 'proposedSlots',
    value: '',
  },
};

const v = (stepId: string, path: string) => `{{${stepId}.${path}}}`;

export const gtmWfTriggerAfter = (field: string) =>
  `{{trigger.properties.after.${field}}}`;

export const gtmWfMemberId = (memberStepId: string = OUTREACH_WF_MEMBER_STEP_ID) =>
  v(memberStepId, 'first.id');

export const gtmWfProfilePhone = () =>
  v(OUTREACH_WF_PROFILE_STEP_ID, 'first.phoneNumber');

export const gtmWfProfileEmail = () =>
  v(OUTREACH_WF_PROFILE_STEP_ID, 'first.email');

export const gtmWfFindId = (findStepId: string) => v(findStepId, 'first.id');

export const gtmWfFindField = (findStepId: string, field: string) =>
  v(findStepId, `first.${field}`);

// Pipe-separated so WhatsApp body sanitizer keeps contact + draft in {{2}}
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
    `Title: ${gtmWfFindField(findId, 'jobTitle')}`,
    `Company: ${gtmWfFindField(findId, 'jobCompanyName')}`,
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
          recordFilterGroups: [
            { id: groupId, logicalOperator: 'AND' },
          ],
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
          { id: ifBranchId, filterGroupId: groupId, nextStepIds: ifNextStepIds },
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
            WHATSAPP_OFFICIAL: gtmWfProfilePhone(),
            WHATSAPP_UNIPILE: gtmWfProfilePhone(),
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

export const gtmWfMemberAndProfileSteps = (
  nextStepIds: string[],
  {
    memberStepId = OUTREACH_WF_MEMBER_STEP_ID,
    profileStepId = OUTREACH_WF_PROFILE_STEP_ID,
    memberStepName = 'Load workspace member',
    profileStepName = 'Load workspace member profile',
  }: {
    memberStepId?: string;
    profileStepId?: string;
    memberStepName?: string;
    profileStepName?: string;
  } = {},
): StepBase[] => [
  gtmWfFindRecordsStep({
    id: memberStepId,
    name: memberStepName,
    objectName: 'workspaceMember',
    nextStepIds: [profileStepId],
  }),
  gtmWfFindRecordsStep({
    id: profileStepId,
    name: profileStepName,
    objectName: 'workspaceMemberProfile',
    fieldMetadataId: OUTREACH_WF_FIELD.profileMemberId,
    filterValue: gtmWfMemberId(memberStepId),
    filterLabel: 'Workspace Member',
    filterType: 'UUID',
    nextStepIds,
  }),
];

export const gtmWfDatabaseEventTrigger = ({
  name,
  eventName,
  nextStepIds,
  fields,
}: {
  name: string;
  eventName: string;
  nextStepIds: string[];
  fields?: string[];
}) => ({
  name,
  type: 'DATABASE_EVENT',
  position: { x: 0, y: 0 },
  settings: {
    eventName,
    outputSchema: {},
    ...(fields && fields.length > 0 ? { fields } : {}),
  },
  nextStepIds,
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
