import axios from 'axios';
import { StepLogicalOperator, ViewFilterOperand } from 'twenty-shared';
import { v4, v5 as uuidv5 } from 'uuid';

const SERVER_URL = process.env.SERVER_URL || 'http://127.0.0.1:3000';
const SERVER_HOST = process.env.SERVER_HOST || 'arxena.localhost';
const GRAPHQL_URL = `${SERVER_URL}/graphql`;
const API_TOKEN = process.env.API_TOKEN;
const TRIGGER_STEP_ID = 'trigger';
const OUTREACH_PROJECT_ID = process.env.OUTREACH_PROJECT_ID || '';
const OUTREACH_PROJECT_NAME = process.env.OUTREACH_PROJECT_NAME || '';
const DELAY_DAYS = Number(process.env.OUTREACH_DELAY_DAYS || '3');
const DELAY_SECONDS =
  process.env.OUTREACH_DELAY_MS !== undefined
    ? Math.max(1, Math.round(Number(process.env.OUTREACH_DELAY_MS) / 1000))
    : 0;
const OUTREACH_WORKSPACE_MEMBER_ID = process.env.OUTREACH_WORKSPACE_MEMBER_ID || '';
const OUTREACH_CONNECTED_ACCOUNT_ID = process.env.OUTREACH_CONNECTED_ACCOUNT_ID || '';
const OUTREACH_HARVEST_HOURS = Number(process.env.OUTREACH_HARVEST_HOURS || '6');
const OUTREACH_HARVEST_QUERY = process.env.OUTREACH_HARVEST_QUERY || '';

const WORKFLOW_HARVEST_NAME = 'Harvest — LinkedIn Companies';
const WORKFLOW_SEARCH_NAME = 'Company Created → ICP People Search';
const WORKFLOW_B_NAME = 'Outreach — Per Enrolled Person';
const WORKFLOW_ACCEPT_NAME = 'Outreach — Enrolled Person Updated';
const WORKFLOW_C_NAME = 'Outreach — Reply';
const WORKFLOW_MEETING_NAME = 'Outreach — Meeting Booked';
const OUTREACH_LOGIC_FUNCTION_ID_NAMESPACE = '7c3e1a90-4b2d-4f11-9c6a-2e8f0d1b5a44';

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

type WorkflowStep = {
  id: string;
  name: string;
  type: string;
  valid: boolean;
  nextStepIds?: string[];
  settings: Record<string, unknown>;
};

type WorkflowVersionStepChanges = {
  stepsDiff?: Array<{
    type: string;
    path?: Array<string | number>;
    value?: WorkflowStep | WorkflowStep[] | unknown;
  }>;
  triggerDiff?: unknown;
};

const extractCreatedStep = (
  changes: WorkflowVersionStepChanges,
  preferredId: string,
): WorkflowStep => {
  const stepsDiff = changes.stepsDiff ?? [];

  const createDiff = stepsDiff.find((diff) => {
    if (diff.type !== 'CREATE') {
      return false;
    }

    const value = diff.value as WorkflowStep | undefined;

    return isDefinedWorkflowStep(value);
  });

  if (createDiff && isDefinedWorkflowStep(createDiff.value)) {
    return createDiff.value;
  }

  const changeDiff = stepsDiff.find((diff) => {
    if (diff.type !== 'CHANGE' || !Array.isArray(diff.value)) {
      return false;
    }

    return diff.value.some(
      (value) =>
        isDefinedWorkflowStep(value) &&
        (value.id === preferredId || preferredId.length > 0),
    );
  });

  if (changeDiff && Array.isArray(changeDiff.value)) {
    const matchingValue = changeDiff.value.find(
      (value) => isDefinedWorkflowStep(value) && value.id === preferredId,
    );

    if (isDefinedWorkflowStep(matchingValue)) {
      return matchingValue;
    }

    const firstValue = changeDiff.value.find(isDefinedWorkflowStep);

    if (isDefinedWorkflowStep(firstValue)) {
      return firstValue;
    }
  }

  throw new Error(
    `Could not extract created workflow step ${preferredId} from stepsDiff`,
  );
};

const isDefinedWorkflowStep = (
  value: unknown,
): value is WorkflowStep =>
  typeof value === 'object' &&
  value !== null &&
  'id' in value &&
  typeof (value as WorkflowStep).id === 'string';

const graphqlRequest = async <T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> => {
  if (!API_TOKEN) {
    throw new Error('API_TOKEN environment variable is required');
  }

  const response = await axios.post<GraphQLResponse<T>>(
    GRAPHQL_URL,
    { query, variables },
    {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
        Host: SERVER_HOST,
      },
    },
  );

  if (response.data.errors?.length) {
    throw new Error(
      response.data.errors
        .map((error) => {
          const extra = JSON.stringify(
            (error as { extensions?: unknown }).extensions ?? {},
          );

          return extra === '{}'
            ? error.message
            : `${error.message} ${extra}`;
        })
        .join('; '),
    );
  }

  if (!response.data.data) {
    throw new Error('GraphQL response did not include data');
  }

  return response.data.data;
};

const createWorkflow = async (workflowId: string, name: string) => {
  const data = await graphqlRequest<{ createWorkflow: { id: string } }>(
    `mutation CreateOneWorkflow($input: WorkflowCreateInput!) {
      createWorkflow(data: $input) { id }
    }`,
    {
      input: {
        id: workflowId,
        name,
      },
    },
  );

  const versionData = await graphqlRequest<{
    workflowVersions: { edges: Array<{ node: { id: string } }> };
  }>(
    `query GetWorkflowVersion($workflowId: ID!) {
      workflowVersions(
        filter: { workflowId: { eq: $workflowId } }
        orderBy: { createdAt: DescNullsLast }
        first: 1
      ) {
        edges { node { id } }
      }
    }`,
    { workflowId: data.createWorkflow.id },
  );

  const workflowVersionId = versionData.workflowVersions.edges[0]?.node.id;

  if (!workflowVersionId) {
    throw new Error('Workflow version was not created');
  }

  await waitForWorkflowVersion(workflowVersionId);

  return { workflowId: data.createWorkflow.id, workflowVersionId };
};

const waitForWorkflowVersion = async (workflowVersionId: string) => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const data = await graphqlRequest<{
      workflowVersions: { edges: Array<{ node: { id: string } }> };
    }>(
      `query GetWorkflowVersionById($workflowVersionId: ID!) {
        workflowVersions(filter: { id: { eq: $workflowVersionId } } first: 1) {
          edges { node { id } }
        }
      }`,
      { workflowVersionId },
    );

    if (
      data.workflowVersions.edges.some(
        (edge) => edge.node.id === workflowVersionId,
      )
    ) {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 150);
    });
  }

  throw new Error(`Workflow version ${workflowVersionId} was not readable`);
};

const updateWorkflowTrigger = async ({
  workflowVersionId,
  name,
  eventName,
  nextStepIds,
  fields,
}: {
  workflowVersionId: string;
  name: string;
  eventName: string;
  nextStepIds: string[];
  fields?: string[];
}) => {
  // Dedicated mutation required — CRM updateWorkflowVersion blocks trigger writes
  await graphqlRequest(
    `mutation UpdateWorkflowVersionTrigger($input: UpdateWorkflowVersionTriggerInput!) {
      updateWorkflowVersionTrigger(input: $input) { trigger }
    }`,
    {
      input: {
        workflowVersionId,
        trigger: {
          type: 'DATABASE_EVENT',
          name,
          nextStepIds,
          position: { x: 0, y: 0 },
          settings: {
            eventName,
            outputSchema: {},
            ...(fields && fields.length > 0 ? { fields } : {}),
          },
        },
      },
    },
  );

  await waitForTrigger(workflowVersionId);
};

const waitForTrigger = async (workflowVersionId: string) => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const data = await graphqlRequest<{
      workflowVersions: {
        edges: Array<{ node: { id: string; trigger: unknown } }>;
      };
    }>(
      `query GetWorkflowVersionTrigger($workflowVersionId: ID!) {
        workflowVersions(filter: { id: { eq: $workflowVersionId } } first: 1) {
          edges { node { id trigger } }
        }
      }`,
      { workflowVersionId },
    );

    const node = data.workflowVersions.edges.find(
      (edge) => edge.node.id === workflowVersionId,
    )?.node;

    if (node?.trigger) {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 150);
    });
  }

  throw new Error(
    `Workflow version ${workflowVersionId} still has no trigger after update`,
  );
};

const updateCronTrigger = async ({
  workflowVersionId,
  name,
  nextStepIds,
  hours,
}: {
  workflowVersionId: string;
  name: string;
  nextStepIds: string[];
  hours: number;
}) => {
  await graphqlRequest(
    `mutation UpdateWorkflowVersionTrigger($input: UpdateWorkflowVersionTriggerInput!) {
      updateWorkflowVersionTrigger(input: $input) { trigger }
    }`,
    {
      input: {
        workflowVersionId,
        trigger: {
          type: 'CRON',
          name,
          nextStepIds,
          position: { x: 0, y: 0 },
          settings: {
            type: 'HOURS',
            schedule: { hour: hours, minute: 0 },
            outputSchema: {},
          },
        },
      },
    },
  );

  await waitForTrigger(workflowVersionId);
};

const createWorkflowStep = async ({
  workflowVersionId,
  stepType,
  parentStepId,
  parentStepConnectionOptions,
  defaultSettings,
}: {
  workflowVersionId: string;
  stepType: string;
  parentStepId: string;
  parentStepConnectionOptions?: { branchId?: string };
  defaultSettings?: Record<string, unknown>;
}) => {
  const stepId = v4();
  const data = await graphqlRequest<{
    createWorkflowVersionStep: WorkflowVersionStepChanges;
  }>(
    `mutation CreateWorkflowVersionStep($input: CreateWorkflowVersionStepInput!) {
      createWorkflowVersionStep(input: $input) {
        stepsDiff
        triggerDiff
      }
    }`,
    {
      input: {
        id: stepId,
        workflowVersionId,
        stepType,
        parentStepId,
        parentStepConnectionOptions,
        ...(defaultSettings ? { defaultSettings } : {}),
      },
    },
  );

  return extractCreatedStep(data.createWorkflowVersionStep, stepId);
};

const updateWorkflowStep = async ({
  workflowVersionId,
  step,
}: {
  workflowVersionId: string;
  step: WorkflowStep;
}) => {
  await graphqlRequest(
    `mutation UpdateWorkflowVersionStep($input: UpdateWorkflowVersionStepInput!) {
      updateWorkflowVersionStep(input: $input) { id }
    }`,
    {
      input: {
        workflowVersionId,
        step,
      },
    },
  );
};

const activateWorkflowVersion = async (workflowVersionId: string) => {
  await graphqlRequest(
    `mutation ActivateWorkflowVersion($workflowVersionId: UUID!) {
      activateWorkflowVersion(workflowVersionId: $workflowVersionId)
    }`,
    { workflowVersionId },
  );
};

const delaySettings = () => {
  if (DELAY_SECONDS > 0) {
    return {
      delayType: 'DURATION',
      duration: {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: DELAY_SECONDS,
      },
    };
  }

  return {
    delayType: 'DURATION',
    duration: {
      days: DELAY_DAYS,
      hours: 0,
      minutes: 0,
      seconds: 0,
    },
  };
};

const errorHandling = {
  retryOnFailure: { value: false },
  continueOnFailure: { value: false },
};

const formNotifyOnPending = (contextTemplate: string, detailsTemplate: string) => ({
  channels: ['WHATSAPP_OFFICIAL'],
  contextTemplate,
  detailsTemplate,
  whatsappOfficialRegistryName: 'wf_form_boolean_text',
});

const formDetailsFromFind = (findStepId: string, draftStepId: string) =>
  `Contact: {{${findStepId}.first.name}} | Title: {{${findStepId}.first.jobTitle}} | Company: {{${findStepId}.first.jobCompanyName}} | Draft: {{${draftStepId}.message}}`;

const formDetailsFromTrigger = (draftStepId: string) =>
  `Contact: {{trigger.properties.after.name}} | Title: {{trigger.properties.after.jobTitle}} | Company: {{trigger.properties.after.jobCompanyName}} | Draft: {{${draftStepId}.message}}`;

const queuedFilterSettings = (groupId: string, filterId: string, stage: string) => ({
  input: {
    stepFilterGroups: [
      {
        id: groupId,
        logicalOperator: StepLogicalOperator.AND,
      },
    ],
    stepFilters: [
      {
        id: filterId,
        type: 'SELECT',
        stepOutputKey: '{{trigger.properties.after.outreachSequenceStage}}',
        operand: ViewFilterOperand.IS,
        value: stage,
        stepFilterGroupId: groupId,
      },
    ],
  },
  outputSchema: {},
  errorHandlingOptions: errorHandling,
});

const recordStageFilterSettings = (
  stepId: string,
  groupId: string,
  filterId: string,
  stage: string,
) => ({
  input: {
    stepFilterGroups: [
      {
        id: groupId,
        logicalOperator: StepLogicalOperator.AND,
      },
    ],
    stepFilters: [
      {
        id: filterId,
        type: 'SELECT',
        stepOutputKey: `{{${stepId}.first.outreachSequenceStage}}`,
        operand: ViewFilterOperand.IS,
        value: stage,
        stepFilterGroupId: groupId,
      },
    ],
  },
  outputSchema: {},
  errorHandlingOptions: errorHandling,
});

const logicFunctionIdFor = (name: string) => {
  const workspaceId = process.env.WORKSPACE_ID;

  if (!workspaceId) {
    return undefined;
  }

  return uuidv5(`${workspaceId}:${name}`, OUTREACH_LOGIC_FUNCTION_ID_NAMESPACE);
};

const deployWorkflowSearch = async (workflowVersionId: string) => {
  const workspaceId = process.env.WORKSPACE_ID;
  const searchLogicFunctionId = workspaceId
    ? uuidv5(
        `${workspaceId}:search-people-for-company`,
        OUTREACH_LOGIC_FUNCTION_ID_NAMESPACE,
      )
    : process.env.OUTREACH_SEARCH_PEOPLE_FOR_COMPANY_LOGIC_FUNCTION_ID;
  const uploadLogicFunctionId = workspaceId
    ? uuidv5(`${workspaceId}:upload-profiles`, OUTREACH_LOGIC_FUNCTION_ID_NAMESPACE)
    : process.env.OUTREACH_UPLOAD_PROFILES_LOGIC_FUNCTION_ID;

  await updateWorkflowTrigger({
    workflowVersionId,
    name: 'Company is Created',
    eventName: 'company.created',
    nextStepIds: [],
  });

  if (!searchLogicFunctionId || !uploadLogicFunctionId) {
    throw new Error(
      'WORKSPACE_ID (or OUTREACH_*_LOGIC_FUNCTION_ID) is required to seed company search + upload-profiles',
    );
  }

  const searchPeople = await createWorkflowStep({
    workflowVersionId,
    stepType: 'LOGIC_FUNCTION',
    parentStepId: TRIGGER_STEP_ID,
    defaultSettings: {
      input: {
        logicFunctionId: searchLogicFunctionId,
      },
    },
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...searchPeople,
      name: 'Search people for company',
      valid: true,
      settings: {
        input: {
          logicFunctionId: searchLogicFunctionId,
          logicFunctionInput: {
            companyId: '{{trigger.properties.after.id}}',
          },
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  await updateWorkflowTrigger({
    workflowVersionId,
    name: 'Company is Created',
    eventName: 'company.created',
    nextStepIds: [searchPeople.id],
  });

  const uploadProfiles = await createWorkflowStep({
    workflowVersionId,
    stepType: 'LOGIC_FUNCTION',
    parentStepId: searchPeople.id,
    defaultSettings: {
      input: {
        logicFunctionId: uploadLogicFunctionId,
      },
    },
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...uploadProfiles,
      name: 'Upload profiles',
      valid: true,
      settings: {
        input: {
          logicFunctionId: uploadLogicFunctionId,
          logicFunctionInput: {
            projectId: `{{${searchPeople.id}.projectId}}`,
            people: `{{${searchPeople.id}.people}}`,
          },
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  return {
    searchPeopleId: searchPeople.id,
    uploadProfilesId: uploadProfiles.id,
  };
};

const deployWorkflowB = async (workflowVersionId: string) => {
  const queuedGroupId = v4();
  const queuedFilterId = v4();

  await updateWorkflowTrigger({
    workflowVersionId,
    name: 'Candidate is Created',
    eventName: 'candidate.created',
    nextStepIds: [],
  });

  const filterQueued = await createWorkflowStep({
    workflowVersionId,
    stepType: 'FILTER',
    parentStepId: TRIGGER_STEP_ID,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...filterQueued,
      name: 'Only QUEUED candidates',
      valid: true,
      settings: queuedFilterSettings(queuedGroupId, queuedFilterId, 'QUEUED'),
    },
  });

  await updateWorkflowTrigger({
    workflowVersionId,
    name: 'Candidate is Created',
    eventName: 'candidate.created',
    nextStepIds: [filterQueued.id],
  });

  const findCandidate = await createWorkflowStep({
    workflowVersionId,
    stepType: 'FIND_RECORDS',
    parentStepId: filterQueued.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...findCandidate,
      name: 'Load Candidate',
      valid: true,
      settings: {
        input: {
          objectName: 'candidate',
          limit: 1,
          filter: {
            id: { eq: '{{trigger.properties.after.id}}' },
          },
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  const sendConnect = await createWorkflowStep({
    workflowVersionId,
    stepType: 'SEND_LINKEDIN_CONNECTION_REQUEST',
    parentStepId: findCandidate.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...sendConnect,
      name: 'Send LinkedIn connection',
      valid: true,
      settings: {
        input: {
          workspaceMemberId: OUTREACH_WORKSPACE_MEMBER_ID,
          linkedinProfileId: `{{${findCandidate.id}.first.linkedinProfileId}}`,
          linkedinUrl: `{{${findCandidate.id}.first.linkedinUrl.primaryLinkUrl}}`,
          message: 'Happy to connect — would love to share how we help GTM teams.',
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  const markConnectionSent = await createWorkflowStep({
    workflowVersionId,
    stepType: 'UPDATE_RECORD',
    parentStepId: sendConnect.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...markConnectionSent,
      name: 'Mark CONNECTION_SENT',
      valid: true,
      settings: {
        input: {
          objectName: 'candidate',
          objectRecordId: `{{${findCandidate.id}.first.id}}`,
          objectRecord: {
            outreachSequenceStage: 'CONNECTION_SENT',
          },
          fieldsToUpdate: ['outreachSequenceStage'],
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  const waitAcceptOrEmail = await createWorkflowStep({
    workflowVersionId,
    stepType: 'DELAY',
    parentStepId: markConnectionSent.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...waitAcceptOrEmail,
      name: 'Wait 3 days for accept',
      valid: true,
      settings: {
        input: delaySettings(),
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  const findAfterDelay = await createWorkflowStep({
    workflowVersionId,
    stepType: 'FIND_RECORDS',
    parentStepId: waitAcceptOrEmail.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...findAfterDelay,
      name: 'Reload candidate after wait',
      valid: true,
      settings: {
        input: {
          objectName: 'candidate',
          limit: 1,
          filter: { id: { eq: '{{trigger.properties.after.id}}' } },
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  const stillSentGroupId = v4();
  const stillSentFilterId = v4();
  const filterStillSent = await createWorkflowStep({
    workflowVersionId,
    stepType: 'FILTER',
    parentStepId: findAfterDelay.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...filterStillSent,
      name: 'Still CONNECTION_SENT',
      valid: true,
      settings: recordStageFilterSettings(
        findAfterDelay.id,
        stillSentGroupId,
        stillSentFilterId,
        'CONNECTION_SENT',
      ),
    },
  });

  const enrichLogicFunctionId = logicFunctionIdFor('enrich-contact');
  let emailParentId = filterStillSent.id;

  if (enrichLogicFunctionId) {
    const enrichContact = await createWorkflowStep({
      workflowVersionId,
      stepType: 'LOGIC_FUNCTION',
      parentStepId: emailParentId,
      defaultSettings: { input: { logicFunctionId: enrichLogicFunctionId } },
    });

    await updateWorkflowStep({
      workflowVersionId,
      step: {
        ...enrichContact,
        name: 'Enrich email',
        valid: true,
        settings: {
          input: {
            logicFunctionId: enrichLogicFunctionId,
            logicFunctionInput: {
              candidateId: `{{${findAfterDelay.id}.first.id}}`,
              linkedinUrl: `{{${findAfterDelay.id}.first.linkedinUrl.primaryLinkUrl}}`,
            },
          },
          outputSchema: {},
          errorHandlingOptions: errorHandling,
        },
      },
    });
    emailParentId = enrichContact.id;
  }

  const draftEmail = await createWorkflowStep({
    workflowVersionId,
    stepType: 'AI_AGENT',
    parentStepId: emailParentId,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...draftEmail,
      name: 'Draft fallback email',
      valid: true,
      settings: {
        input: {
          agentId: '',
          prompt: [
            'Draft a short ICP-aligned email because the LinkedIn connection was not accepted.',
            `Name: {{${findAfterDelay.id}.first.name}}`,
            `Title: {{${findAfterDelay.id}.first.jobTitle}}`,
            'Do not invent LinkedIn facts. Return JSON only: { "subject": "<subject>", "message": "<body>" }',
          ].join('\n'),
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  const approveEmailForm = await createWorkflowStep({
    workflowVersionId,
    stepType: 'FORM',
    parentStepId: draftEmail.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...approveEmailForm,
      name: 'Approve / edit email',
      valid: true,
      settings: {
        input: [
          {
            id: v4(),
            name: 'approve',
            label: 'Approve send',
            type: 'BOOLEAN',
            value: true,
          },
          {
            id: v4(),
            name: 'editedBody',
            label: 'Edited message',
            type: 'TEXT',
            value: `{{${draftEmail.id}.message}}`,
          },
        ],
        notifyOnPending: formNotifyOnPending(
          'Review fallback email',
          formDetailsFromFind(findAfterDelay.id, draftEmail.id),
        ),
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  const saveDraft = await createWorkflowStep({
    workflowVersionId,
    stepType: 'DRAFT_EMAIL',
    parentStepId: approveEmailForm.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...saveDraft,
      name: 'Save email draft',
      valid: true,
      settings: {
        input: {
          connectedAccountId: OUTREACH_CONNECTED_ACCOUNT_ID,
          recipients: {
            to: enrichLogicFunctionId
              ? `{{${emailParentId}.email}}`
              : '',
            cc: '',
            bcc: '',
          },
          subject: `{{${draftEmail.id}.subject}}`,
          body: `{{${approveEmailForm.id}.editedBody}}`,
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  const sendEmail = await createWorkflowStep({
    workflowVersionId,
    stepType: 'SEND_EMAIL',
    parentStepId: saveDraft.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...sendEmail,
      name: 'Send email',
      valid: true,
      settings: {
        input: {
          connectedAccountId: OUTREACH_CONNECTED_ACCOUNT_ID,
          recipients: {
            to: enrichLogicFunctionId
              ? `{{${emailParentId}.email}}`
              : '',
            cc: '',
            bcc: '',
          },
          subject: `{{${draftEmail.id}.subject}}`,
          body: `{{${approveEmailForm.id}.editedBody}}`,
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  const markEmailSent = await createWorkflowStep({
    workflowVersionId,
    stepType: 'UPDATE_RECORD',
    parentStepId: sendEmail.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...markEmailSent,
      name: 'Mark EMAIL_SENT',
      valid: true,
      settings: {
        input: {
          objectName: 'candidate',
          objectRecordId: `{{${findAfterDelay.id}.first.id}}`,
          objectRecord: {
            outreachSequenceStage: 'EMAIL_SENT',
          },
          fieldsToUpdate: ['outreachSequenceStage'],
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  return {
    filterQueuedId: filterQueued.id,
    findCandidateId: findCandidate.id,
    sendConnectId: sendConnect.id,
    markConnectionSentId: markConnectionSent.id,
    waitAcceptOrEmailId: waitAcceptOrEmail.id,
  };
};

const deployWorkflowAccept = async (workflowVersionId: string) => {
  const workspaceId = process.env.WORKSPACE_ID;
  const fetchMessagesLogicFunctionId = workspaceId
    ? uuidv5(
        `${workspaceId}:fetch-linkedin-messages`,
        OUTREACH_LOGIC_FUNCTION_ID_NAMESPACE,
      )
    : process.env.OUTREACH_FETCH_LINKEDIN_MESSAGES_LOGIC_FUNCTION_ID;
  const fetchLogicFunctionId = workspaceId
    ? uuidv5(
        `${workspaceId}:fetch-linkedin-profile`,
        OUTREACH_LOGIC_FUNCTION_ID_NAMESPACE,
      )
    : process.env.OUTREACH_FETCH_LINKEDIN_PROFILE_LOGIC_FUNCTION_ID;

  await updateWorkflowTrigger({
    workflowVersionId,
    name: 'Candidate is Updated',
    eventName: 'candidate.updated',
    fields: ['outreachSequenceStage'],
    nextStepIds: [],
  });

  const stageRouter = await createWorkflowStep({
    workflowVersionId,
    stepType: 'IF_ELSE',
    parentStepId: TRIGGER_STEP_ID,
  });

  const acceptedGroupIdForRouter = v4();
  const acceptedFilterIdForRouter = v4();
  const acceptedBranchId = v4();
  const elseBranchId = v4();

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...stageRouter,
      name: 'Route by outreach stage',
      valid: true,
      nextStepIds: [],
      settings: {
        input: {
          stepFilterGroups: [
            { id: acceptedGroupIdForRouter, logicalOperator: StepLogicalOperator.AND },
          ],
          stepFilters: [
            {
              id: acceptedFilterIdForRouter,
              type: 'SELECT',
              value: 'CONNECTION_ACCEPTED',
              operand: ViewFilterOperand.IS,
              stepOutputKey: '{{trigger.properties.after.outreachSequenceStage}}',
              stepFilterGroupId: acceptedGroupIdForRouter,
              positionInStepFilterGroup: 0,
            },
          ],
          branches: [
            {
              id: acceptedBranchId,
              filterGroupId: acceptedGroupIdForRouter,
              nextStepIds: [],
            },
            { id: elseBranchId, nextStepIds: [] },
          ],
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  await updateWorkflowTrigger({
    workflowVersionId,
    name: 'Candidate is Updated',
    eventName: 'candidate.updated',
    fields: ['outreachSequenceStage'],
    nextStepIds: [stageRouter.id],
  });

  const findCandidate = await createWorkflowStep({
    workflowVersionId,
    stepType: 'FIND_RECORDS',
    parentStepId: stageRouter.id,
    parentStepConnectionOptions: { branchId: acceptedBranchId },
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...findCandidate,
      name: 'Load Candidate',
      valid: true,
      settings: {
        input: {
          objectName: 'candidate',
          limit: 1,
          filter: {
            id: { eq: '{{trigger.properties.after.id}}' },
          },
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  let parentId = findCandidate.id;

  if (fetchMessagesLogicFunctionId) {
    const fetchMessages = await createWorkflowStep({
      workflowVersionId,
      stepType: 'LOGIC_FUNCTION',
      parentStepId: parentId,
      defaultSettings: {
        input: {
          logicFunctionId: fetchMessagesLogicFunctionId,
        },
      },
    });

    await updateWorkflowStep({
      workflowVersionId,
      step: {
        ...fetchMessages,
        name: 'Fetch LinkedIn messages',
        valid: true,
        settings: {
          input: {
            logicFunctionId: fetchMessagesLogicFunctionId,
            logicFunctionInput: {
              candidateId: `{{${findCandidate.id}.first.id}}`,
              linkedinProfileId: `{{${findCandidate.id}.first.linkedinProfileId}}`,
              linkedinUrl: `{{${findCandidate.id}.first.linkedinUrl.primaryLinkUrl}}`,
            },
          },
          outputSchema: {},
          errorHandlingOptions: errorHandling,
        },
      },
    });
    parentId = fetchMessages.id;
  }

  if (fetchLogicFunctionId) {
    const fetchProfile = await createWorkflowStep({
      workflowVersionId,
      stepType: 'LOGIC_FUNCTION',
      parentStepId: parentId,
      defaultSettings: {
        input: {
          logicFunctionId: fetchLogicFunctionId,
        },
      },
    });

    await updateWorkflowStep({
      workflowVersionId,
      step: {
        ...fetchProfile,
        name: 'Fetch LinkedIn profile',
        valid: true,
        settings: {
          input: {
            logicFunctionId: fetchLogicFunctionId,
            logicFunctionInput: {
              candidateId: `{{${findCandidate.id}.first.id}}`,
              linkedinProfileId: `{{${findCandidate.id}.first.linkedinProfileId}}`,
              linkedinUrl: `{{${findCandidate.id}.first.linkedinUrl.primaryLinkUrl}}`,
            },
          },
          outputSchema: {},
          errorHandlingOptions: errorHandling,
        },
      },
    });
    parentId = fetchProfile.id;
  }

  const draftMessage = await createWorkflowStep({
    workflowVersionId,
    stepType: 'AI_AGENT',
    parentStepId: parentId,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...draftMessage,
      name: 'Draft first LinkedIn message',
      valid: true,
      settings: {
        input: {
          agentId: '',
          prompt: [
            'Draft a short first LinkedIn message after the connection was accepted.',
            'Prioritise rapport. Meeting is a light close, not a calendar dump.',
            `Name: {{${findCandidate.id}.first.name}}`,
            `Title: {{${findCandidate.id}.first.jobTitle}}`,
            'Return JSON only: { "message": "<body>" }',
          ].join('\n'),
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  const approveForm = await createWorkflowStep({
    workflowVersionId,
    stepType: 'FORM',
    parentStepId: draftMessage.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...approveForm,
      name: 'Approve / edit first message',
      valid: true,
      settings: {
        input: [
          {
            id: v4(),
            name: 'approve',
            label: 'Approve send',
            type: 'BOOLEAN',
            value: true,
          },
          {
            id: v4(),
            name: 'editedBody',
            label: 'Edited message',
            type: 'TEXT',
            value: `{{${draftMessage.id}.message}}`,
          },
        ],
        notifyOnPending: formNotifyOnPending(
          'Review first LinkedIn message',
          formDetailsFromFind(findCandidate.id, draftMessage.id),
        ),
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  const sendMessage = await createWorkflowStep({
    workflowVersionId,
    stepType: 'SEND_LINKEDIN_MESSAGE',
    parentStepId: approveForm.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...sendMessage,
      name: 'Send LinkedIn message',
      valid: true,
      settings: {
        input: {
          workspaceMemberId: OUTREACH_WORKSPACE_MEMBER_ID,
          candidateId: `{{${findCandidate.id}.first.id}}`,
          linkedinProfileId: `{{${findCandidate.id}.first.linkedinProfileId}}`,
          body: `{{${approveForm.id}.editedBody}}`,
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  const waitFollowUp = await createWorkflowStep({
    workflowVersionId,
    stepType: 'DELAY',
    parentStepId: sendMessage.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...waitFollowUp,
      name: 'Wait 2–5 days before follow-up',
      valid: true,
      settings: {
        input: delaySettings(),
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  let followUpParentId = waitFollowUp.id;

  for (let followUpIndex = 1; followUpIndex <= 3; followUpIndex += 1) {
    const findFollowUp = await createWorkflowStep({
      workflowVersionId,
      stepType: 'FIND_RECORDS',
      parentStepId: followUpParentId,
    });

    await updateWorkflowStep({
      workflowVersionId,
      step: {
        ...findFollowUp,
        name: `Reload candidate before follow-up ${followUpIndex}`,
        valid: true,
        settings: {
          input: {
            objectName: 'candidate',
            limit: 1,
            filter: { id: { eq: '{{trigger.properties.after.id}}' } },
          },
          outputSchema: {},
          errorHandlingOptions: errorHandling,
        },
      },
    });

    const followGroupId = v4();
    const followFilterId = v4();
    const filterStillOpen = await createWorkflowStep({
      workflowVersionId,
      stepType: 'FILTER',
      parentStepId: findFollowUp.id,
    });

    await updateWorkflowStep({
      workflowVersionId,
      step: {
        ...filterStillOpen,
        name: `No reply yet (follow-up ${followUpIndex})`,
        valid: true,
        settings: recordStageFilterSettings(
          findFollowUp.id,
          followGroupId,
          followFilterId,
          'CONNECTION_ACCEPTED',
        ),
      },
    });

    const draftFollowUp = await createWorkflowStep({
      workflowVersionId,
      stepType: 'AI_AGENT',
      parentStepId: filterStillOpen.id,
    });

    await updateWorkflowStep({
      workflowVersionId,
      step: {
        ...draftFollowUp,
        name: `Draft LinkedIn follow-up ${followUpIndex}`,
        valid: true,
        settings: {
          input: {
            agentId: '',
            prompt: [
              `Draft LinkedIn follow-up ${followUpIndex} of 3. Escalate value, do not pressure.`,
              followUpIndex === 3
                ? 'This is the breakup note if they are silent.'
                : '',
              `Name: {{${findFollowUp.id}.first.name}}`,
              'Return JSON only: { "message": "<body>" }',
            ]
              .filter(Boolean)
              .join('\n'),
          },
          outputSchema: {},
          errorHandlingOptions: errorHandling,
        },
      },
    });

    const approveFollowUp = await createWorkflowStep({
      workflowVersionId,
      stepType: 'FORM',
      parentStepId: draftFollowUp.id,
    });

    await updateWorkflowStep({
      workflowVersionId,
      step: {
        ...approveFollowUp,
        name: `Approve follow-up ${followUpIndex}`,
        valid: true,
        settings: {
          input: [
            {
              id: v4(),
              name: 'approve',
              label: 'Approve send',
              type: 'BOOLEAN',
              value: true,
            },
            {
              id: v4(),
              name: 'editedBody',
              label: 'Edited message',
              type: 'TEXT',
              value: `{{${draftFollowUp.id}.message}}`,
            },
          ],
          notifyOnPending: formNotifyOnPending(
            `Review LinkedIn follow-up ${followUpIndex}`,
            formDetailsFromFind(findFollowUp.id, draftFollowUp.id),
          ),
          outputSchema: {},
          errorHandlingOptions: errorHandling,
        },
      },
    });

    const sendFollowUp = await createWorkflowStep({
      workflowVersionId,
      stepType: 'SEND_LINKEDIN_MESSAGE',
      parentStepId: approveFollowUp.id,
    });

    await updateWorkflowStep({
      workflowVersionId,
      step: {
        ...sendFollowUp,
        name: `Send follow-up ${followUpIndex}`,
        valid: true,
        settings: {
          input: {
            workspaceMemberId: OUTREACH_WORKSPACE_MEMBER_ID,
            candidateId: `{{${findFollowUp.id}.first.id}}`,
            linkedinProfileId: `{{${findFollowUp.id}.first.linkedinProfileId}}`,
            body: `{{${approveFollowUp.id}.editedBody}}`,
          },
          outputSchema: {},
          errorHandlingOptions: errorHandling,
        },
      },
    });

    const markFollowUp = await createWorkflowStep({
      workflowVersionId,
      stepType: 'UPDATE_RECORD',
      parentStepId: sendFollowUp.id,
    });

    await updateWorkflowStep({
      workflowVersionId,
      step: {
        ...markFollowUp,
        name: `Stamp follow-up ${followUpIndex}`,
        valid: true,
        settings: {
          input: {
            objectName: 'candidate',
            objectRecordId: `{{${findFollowUp.id}.first.id}}`,
            objectRecord: {
              linkedinFollowUpCount: followUpIndex,
              ...(followUpIndex === 3
                ? { outreachSequenceStage: 'FAILED_NO_REPLY' }
                : {}),
            },
            fieldsToUpdate:
              followUpIndex === 3
                ? ['linkedinFollowUpCount', 'outreachSequenceStage']
                : ['linkedinFollowUpCount'],
          },
          outputSchema: {},
          errorHandlingOptions: errorHandling,
        },
      },
    });

    followUpParentId = markFollowUp.id;

    if (followUpIndex < 3) {
      const waitNext = await createWorkflowStep({
        workflowVersionId,
        stepType: 'DELAY',
        parentStepId: followUpParentId,
      });

      await updateWorkflowStep({
        workflowVersionId,
        step: {
          ...waitNext,
          name: `Wait before follow-up ${followUpIndex + 1}`,
          valid: true,
          settings: {
            input: delaySettings(),
            outputSchema: {},
            errorHandlingOptions: errorHandling,
          },
        },
      });
      followUpParentId = waitNext.id;
    }
  }

  return {
    filterAcceptedId: filterAccepted.id,
    findCandidateId: findCandidate.id,
    draftMessageId: draftMessage.id,
    approveFormId: approveForm.id,
    sendMessageId: sendMessage.id,
    waitFollowUpId: waitFollowUp.id,
  };
};

const deployWorkflowC = async (workflowVersionId: string) => {
  const repliedGroupId = v4();
  const repliedFilterId = v4();

  await updateWorkflowTrigger({
    workflowVersionId,
    name: 'Candidate is Updated',
    eventName: 'candidate.updated',
    nextStepIds: [],
  });

  const filterReplied = await createWorkflowStep({
    workflowVersionId,
    stepType: 'FILTER',
    parentStepId: TRIGGER_STEP_ID,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...filterReplied,
      name: 'Only REPLIED candidates',
      valid: true,
      settings: queuedFilterSettings(
        repliedGroupId,
        repliedFilterId,
        'REPLIED',
      ),
    },
  });

  await updateWorkflowTrigger({
    workflowVersionId,
    name: 'Candidate is Updated',
    eventName: 'candidate.updated',
    nextStepIds: [filterReplied.id],
  });

  const findMessages = await createWorkflowStep({
    workflowVersionId,
    stepType: 'FIND_RECORDS',
    parentStepId: filterReplied.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...findMessages,
      name: 'Load inbound WhatsApp / LinkedIn messages',
      valid: true,
      settings: {
        input: {
          objectName: 'chatMessage',
          limit: 20,
          filter: {
            candidateId: { eq: '{{trigger.properties.after.id}}' },
          },
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  const calendarLogicFunctionId = logicFunctionIdFor(
    'get-calendar-availability',
  );
  let replyParentId = findMessages.id;

  if (calendarLogicFunctionId) {
    const calendarSlots = await createWorkflowStep({
      workflowVersionId,
      stepType: 'LOGIC_FUNCTION',
      parentStepId: replyParentId,
      defaultSettings: {
        input: { logicFunctionId: calendarLogicFunctionId },
      },
    });

    await updateWorkflowStep({
      workflowVersionId,
      step: {
        ...calendarSlots,
        name: 'Get calendar availability',
        valid: true,
        settings: {
          input: {
            logicFunctionId: calendarLogicFunctionId,
            logicFunctionInput: {
              workspaceMemberId: OUTREACH_WORKSPACE_MEMBER_ID,
              days: 5,
              slotMinutes: 30,
            },
          },
          outputSchema: {},
          errorHandlingOptions: errorHandling,
        },
      },
    });
    replyParentId = calendarSlots.id;
  }

  const draftReply = await createWorkflowStep({
    workflowVersionId,
    stepType: 'AI_AGENT',
    parentStepId: replyParentId,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...draftReply,
      name: 'Draft reply',
      valid: true,
      settings: {
        input: {
          agentId: '',
          prompt: [
            'Build rapport. Goal is a meeting, not a hard close.',
            'Use canonical chatMessage.messageObj or concatenated chatMessage.message.',
            calendarLogicFunctionId
              ? `Only propose times from these slots: {{${replyParentId}.slots}}. Never invent times.`
              : 'Do not invent calendar times.',
            'Return JSON only: { "message": "<body>", "intent": "interested|not_now|times_proposed|book|unsubscribe", "proposedSlots": [] }',
          ].join('\n'),
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  const approveForm = await createWorkflowStep({
    workflowVersionId,
    stepType: 'FORM',
    parentStepId: draftReply.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...approveForm,
      name: 'Approve / edit reply',
      valid: true,
      settings: {
        input: [
          {
            id: v4(),
            name: 'approve',
            label: 'Approve send',
            type: 'BOOLEAN',
            value: true,
          },
          {
            id: v4(),
            name: 'editedBody',
            label: 'Edited message',
            type: 'TEXT',
            value: `{{${draftReply.id}.message}}`,
          },
        ],
        notifyOnPending: formNotifyOnPending(
          'Review inbound reply',
          formDetailsFromTrigger(draftReply.id),
        ),
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  const sendReply = await createWorkflowStep({
    workflowVersionId,
    stepType: 'SEND_LINKEDIN_MESSAGE',
    parentStepId: approveForm.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...sendReply,
      name: 'Send reply',
      valid: true,
      settings: {
        input: {
          workspaceMemberId: OUTREACH_WORKSPACE_MEMBER_ID,
          candidateId: '{{trigger.properties.after.id}}',
          linkedinProfileId: '{{trigger.properties.after.linkedinProfileId}}',
          body: `{{${approveForm.id}.editedBody}}`,
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  return {
    filterRepliedId: filterReplied.id,
    findMessagesId: findMessages.id,
    draftReplyId: draftReply.id,
    approveFormId: approveForm.id,
    sendReplyId: sendReply.id,
  };
};

const deployWorkflowHarvest = async (
  workflowVersionId: string,
  projectId: string,
) => {
  const searchCompaniesId = logicFunctionIdFor('search-companies');
  const upsertCompaniesId = logicFunctionIdFor('upsert-companies');

  if (!searchCompaniesId || !upsertCompaniesId) {
    throw new Error(
      'WORKSPACE_ID is required to seed harvest search-companies + upsert-companies',
    );
  }

  await updateCronTrigger({
    workflowVersionId,
    name: 'Every few hours',
    nextStepIds: [],
    hours: OUTREACH_HARVEST_HOURS,
  });

  const searchCompanies = await createWorkflowStep({
    workflowVersionId,
    stepType: 'LOGIC_FUNCTION',
    parentStepId: TRIGGER_STEP_ID,
    defaultSettings: { input: { logicFunctionId: searchCompaniesId } },
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...searchCompanies,
      name: 'Search LinkedIn companies',
      valid: true,
      settings: {
        input: {
          logicFunctionId: searchCompaniesId,
          logicFunctionInput: {
            query: OUTREACH_HARVEST_QUERY,
            keywords: OUTREACH_HARVEST_QUERY,
            ...(OUTREACH_HARVEST_QUERY.includes('linkedin.com')
              ? { url: OUTREACH_HARVEST_QUERY }
              : {}),
            projectId,
            limit: 100,
          },
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  await updateCronTrigger({
    workflowVersionId,
    name: 'Every few hours',
    nextStepIds: [searchCompanies.id],
    hours: OUTREACH_HARVEST_HOURS,
  });

  const upsertCompanies = await createWorkflowStep({
    workflowVersionId,
    stepType: 'LOGIC_FUNCTION',
    parentStepId: searchCompanies.id,
    defaultSettings: { input: { logicFunctionId: upsertCompaniesId } },
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...upsertCompanies,
      name: 'Upsert companies to CRM',
      valid: true,
      settings: {
        input: {
          logicFunctionId: upsertCompaniesId,
          logicFunctionInput: {
            projectId,
            companies: `{{${searchCompanies.id}.companies}}`,
          },
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  return {
    searchCompaniesId: searchCompanies.id,
    upsertCompaniesId: upsertCompanies.id,
  };
};

const deployWorkflowMeeting = async (workflowVersionId: string) => {
  const bookedGroupId = v4();
  const bookedFilterId = v4();

  await updateWorkflowTrigger({
    workflowVersionId,
    name: 'Candidate is Updated',
    eventName: 'candidate.updated',
    nextStepIds: [],
  });

  const filterBooked = await createWorkflowStep({
    workflowVersionId,
    stepType: 'FILTER',
    parentStepId: TRIGGER_STEP_ID,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...filterBooked,
      name: 'Only MEETING_BOOKED',
      valid: true,
      settings: queuedFilterSettings(
        bookedGroupId,
        bookedFilterId,
        'MEETING_BOOKED',
      ),
    },
  });

  await updateWorkflowTrigger({
    workflowVersionId,
    name: 'Candidate is Updated',
    eventName: 'candidate.updated',
    nextStepIds: [filterBooked.id],
  });

  const approveMeeting = await createWorkflowStep({
    workflowVersionId,
    stepType: 'FORM',
    parentStepId: filterBooked.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...approveMeeting,
      name: 'Confirm meeting times',
      valid: true,
      settings: {
        input: [
          {
            id: v4(),
            name: 'approve',
            label: 'Send calendar invite',
            type: 'BOOLEAN',
            value: true,
          },
          {
            id: v4(),
            name: 'startsAt',
            label: 'Starts at (ISO)',
            type: 'TEXT',
            value: '',
          },
          {
            id: v4(),
            name: 'endsAt',
            label: 'Ends at (ISO)',
            type: 'TEXT',
            value: '',
          },
        ],
        notifyOnPending: formNotifyOnPending(
          'Confirm calendar invite',
          [
            'Set start/end then approve to invite both sides.',
            'Contact: {{trigger.properties.after.name}}',
            'Title: {{trigger.properties.after.jobTitle}}',
            'Company: {{trigger.properties.after.jobCompanyName}}',
          ].join(' | '),
        ),
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  const createEvent = await createWorkflowStep({
    workflowVersionId,
    stepType: 'CREATE_CALENDAR_EVENT',
    parentStepId: approveMeeting.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...createEvent,
      name: 'Create calendar invite',
      valid: true,
      settings: {
        input: {
          connectedAccountId: OUTREACH_CONNECTED_ACCOUNT_ID,
          title: 'Intro call',
          description: 'GTM outreach meeting',
          location: '',
          startsAt: `{{${approveMeeting.id}.startsAt}}`,
          endsAt: `{{${approveMeeting.id}.endsAt}}`,
          isFullDay: false,
          timeZone: '',
          attendees: '',
          sendInvitations: true,
          addConferencing: true,
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  return {
    filterBookedId: filterBooked.id,
    approveMeetingId: approveMeeting.id,
    createEventId: createEvent.id,
  };
};

const bindProjectOutreachWorkflow = async (workflowBId: string) => {
  const filter = OUTREACH_PROJECT_ID
    ? { id: { eq: OUTREACH_PROJECT_ID } }
    : OUTREACH_PROJECT_NAME
      ? { name: { eq: OUTREACH_PROJECT_NAME } }
      : undefined;

  const projects = await graphqlRequest<{
    projects: {
      edges: Array<{
        node: { id: string; name?: string; icpSpec?: string | null };
      }>;
    };
  }>(
    `query FindOutreachProject($filter: ProjectFilterInput) {
      projects(
        filter: $filter
        first: 20
        orderBy: { updatedAt: DescNullsLast }
      ) {
        edges { node { id name icpSpec } }
      }
    }`,
    { filter },
  );

  const nodes = projects.projects.edges.map((edge) => edge.node);
  const project =
    nodes.find((node) => node.id === OUTREACH_PROJECT_ID) ??
    nodes.find((node) => node.name === OUTREACH_PROJECT_NAME) ??
    nodes.find((node) => (node.name ?? '').startsWith('GTM')) ??
    nodes.find((node) => Boolean(node.icpSpec)) ??
    nodes[0];

  const projectId = project?.id;

  if (!projectId) {
    console.warn(
      'No Project found by OUTREACH_PROJECT_ID / OUTREACH_PROJECT_NAME / GTM name prefix; skip outreachWorkflowId bind',
    );

    return null;
  }

  await graphqlRequest(
    `mutation UpdateProject($id: ID!, $data: ProjectUpdateInput!) {
      updateProject(id: $id, data: $data) { id }
    }`,
    {
      id: projectId,
      data: {
        outreachWorkflowId: workflowBId,
        outreachSendMode: 'APPROVAL',
        maxPersonasPerCompany: 2,
        inMailFallbackEnabled: false,
        sendTimezone: 'Asia/Kolkata',
        sendWindowStart: '08:00',
        sendWindowEnd: '10:00',
        // icpSpec: JSON.stringify({
          // std_function: ['talent acquisition', 'people'],
          // std_grade: ['leadership', 'mid'],
          // buyerTitles: ['Head of Talent', 'VP People'],
        // }),
        // complianceCopy:
        //   'Stop if not interested or unsubscribe. Do not pressure. Respect OOO.',
      },
    },
  );

  return projectId;
};

const main = async () => {
  const workflowSearchId =
    process.env.OUTREACH_WORKFLOW_SEARCH_ID || v4();
  const workflowBId = process.env.OUTREACH_WORKFLOW_B_ID || v4();
  const workflowAcceptId =
    process.env.OUTREACH_WORKFLOW_ACCEPT_ID || v4();

  const workflowSearch = await createWorkflow(
    workflowSearchId,
    WORKFLOW_SEARCH_NAME,
  );
  const stepIdsSearch = await deployWorkflowSearch(
    workflowSearch.workflowVersionId,
  );
  await activateWorkflowVersion(workflowSearch.workflowVersionId);

  const workflowB = await createWorkflow(workflowBId, WORKFLOW_B_NAME);
  const stepIdsB = await deployWorkflowB(workflowB.workflowVersionId);
  await activateWorkflowVersion(workflowB.workflowVersionId);

  const workflowAccept = await createWorkflow(
    workflowAcceptId,
    WORKFLOW_ACCEPT_NAME,
  );
  const stepIdsAccept = await deployWorkflowAccept(
    workflowAccept.workflowVersionId,
  );
  await activateWorkflowVersion(workflowAccept.workflowVersionId);

  const projectId = await bindProjectOutreachWorkflow(workflowB.workflowId);

  let stepIdsHarvest: Record<string, string> | undefined;

  if (projectId) {
    const workflowHarvestId =
      process.env.OUTREACH_WORKFLOW_HARVEST_ID || v4();
    const workflowHarvest = await createWorkflow(
      workflowHarvestId,
      WORKFLOW_HARVEST_NAME,
    );
    stepIdsHarvest = await deployWorkflowHarvest(
      workflowHarvest.workflowVersionId,
      projectId,
    );
    await activateWorkflowVersion(workflowHarvest.workflowVersionId);
    console.log(`Workflow harvest: ${workflowHarvest.workflowId}`);
  } else {
    console.warn('Skip harvest workflow — no Project id to tag projectIds');
  }

  console.log('GTM outreach workflows setup complete');
  console.log(`Workflow search (company created): ${workflowSearch.workflowId}`);
  console.log(`Workflow B (per candidate): ${workflowB.workflowId}`);
  console.log(`Workflow candidate updated: ${workflowAccept.workflowId}`);
  console.log(`Project bind: ${projectId ?? 'skipped'}`);
  console.log('Open /outreach-home?workflowId=' + workflowB.workflowId);
  console.log('Step IDs search:', stepIdsSearch);
  console.log('Step IDs B:', stepIdsB);
  console.log('Step IDs candidate updated:', stepIdsAccept);
  if (stepIdsHarvest) {
    console.log('Step IDs harvest:', stepIdsHarvest);
  }
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Failed to set up GTM outreach workflows:', message);
  process.exit(1);
});

