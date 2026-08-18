import axios from 'axios';
import { StepLogicalOperator, ViewFilterOperand } from 'twenty-shared';
import { v4, v5 as uuidv5 } from 'uuid';

const SERVER_URL = process.env.SERVER_URL || 'http://127.0.0.1:3000';
const SERVER_HOST = process.env.SERVER_HOST || 'arxena.localhost';
const GRAPHQL_URL = `${SERVER_URL}/graphql`;
const API_TOKEN = process.env.API_TOKEN;
const TRIGGER_STEP_ID = 'trigger';
const GTM_RUN_KEY = process.env.GTM_RUN_KEY || 'gtm-demo-run-1';
const DELAY_DAYS = Number(process.env.GTM_OUTREACH_DELAY_DAYS || '3');
const DELAY_SECONDS =
  process.env.GTM_DELAY_MS !== undefined
    ? Math.max(1, Math.round(Number(process.env.GTM_DELAY_MS) / 1000))
    : 0;

const WORKFLOW_B_NAME = 'GTM Outreach — Per Candidate';
const WORKFLOW_ACCEPT_NAME = 'GTM Outreach — Connection Accepted';
const WORKFLOW_C_NAME = 'GTM Outreach — Reply';
const GTM_LOGIC_FUNCTION_ID_NAMESPACE = '7c3e1a90-4b2d-4f11-9c6a-2e8f0d1b5a44';

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

    return (
      isDefinedWorkflowStep(value) && value.id === preferredId
    );
  });

  if (createDiff && isDefinedWorkflowStep(createDiff.value)) {
    return createDiff.value;
  }

  const changeDiff = stepsDiff.find((diff) => {
    if (diff.type !== 'CHANGE' || !Array.isArray(diff.value)) {
      return false;
    }

    const firstValue = diff.value[0];

    return isDefinedWorkflowStep(firstValue) && firstValue.id === preferredId;
  });

  if (changeDiff && Array.isArray(changeDiff.value)) {
    const firstValue = changeDiff.value[0];

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
      response.data.errors.map((error) => error.message).join('; '),
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

  return { workflowId: data.createWorkflow.id, workflowVersionId };
};

const updateWorkflowTrigger = async ({
  workflowVersionId,
  name,
  eventName,
  nextStepIds,
}: {
  workflowVersionId: string;
  name: string;
  eventName: string;
  nextStepIds: string[];
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
          settings: {
            eventName,
            outputSchema: {},
          },
        },
      },
    },
  );
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
        stepOutputKey: '{{trigger.outreachSequenceStage}}',
        operand: ViewFilterOperand.IS,
        value: stage,
        stepFilterGroupId: groupId,
      },
    ],
  },
  outputSchema: {},
  errorHandlingOptions: errorHandling,
});

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
            id: { eq: '{{trigger.recordId}}' },
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
          workspaceMemberId: '',
          linkedinProfileId: `{{${findCandidate.id}.result.first.linkedinProfileId}}`,
          linkedinUrl: `{{${findCandidate.id}.result.first.linkedinUrl.primaryLinkUrl}}`,
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
          objectRecordId: `{{${findCandidate.id}.result.first.id}}`,
          objectRecord: {
            outreachSequenceStage: 'CONNECTION_SENT',
            connectionStatus: 'SENT',
          },
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
  };
};

const deployWorkflowAccept = async (workflowVersionId: string) => {
  const acceptedGroupId = v4();
  const acceptedFilterId = v4();
  const workspaceId = process.env.WORKSPACE_ID;
  const fetchLogicFunctionId = workspaceId
    ? uuidv5(
        `${workspaceId}:fetch-linkedin-profile`,
        GTM_LOGIC_FUNCTION_ID_NAMESPACE,
      )
    : process.env.GTM_FETCH_LINKEDIN_PROFILE_LOGIC_FUNCTION_ID;

  await updateWorkflowTrigger({
    workflowVersionId,
    name: 'Candidate is Updated',
    eventName: 'candidate.updated',
    nextStepIds: [],
  });

  const filterAccepted = await createWorkflowStep({
    workflowVersionId,
    stepType: 'FILTER',
    parentStepId: TRIGGER_STEP_ID,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...filterAccepted,
      name: 'Only ACCEPTED candidates',
      valid: true,
      settings: queuedFilterSettings(
        acceptedGroupId,
        acceptedFilterId,
        'CONNECTION_ACCEPTED',
      ),
    },
  });

  await updateWorkflowTrigger({
    workflowVersionId,
    name: 'Candidate is Updated',
    eventName: 'candidate.updated',
    nextStepIds: [filterAccepted.id],
  });

  const findCandidate = await createWorkflowStep({
    workflowVersionId,
    stepType: 'FIND_RECORDS',
    parentStepId: filterAccepted.id,
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
            id: { eq: '{{trigger.recordId}}' },
          },
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  let parentId = findCandidate.id;

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
              candidateId: `{{${findCandidate.id}.result.first.id}}`,
              linkedinProfileId: `{{${findCandidate.id}.result.first.linkedinProfileId}}`,
              linkedinUrl: `{{${findCandidate.id}.result.first.linkedinUrl.primaryLinkUrl}}`,
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
            `Name: {{${findCandidate.id}.result.first.name}}`,
            `Title: {{${findCandidate.id}.result.first.jobTitle}}`,
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
            value: `{{${draftMessage.id}.result.message}}`,
          },
        ],
        notifyOnPending: formNotifyOnPending(
          'Review first LinkedIn message',
          `Draft: {{${draftMessage.id}.result.message}}`,
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
          workspaceMemberId: '',
          linkedinProfileId: `{{${findCandidate.id}.result.first.linkedinProfileId}}`,
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
          objectName: 'whatsappMessage',
          limit: 20,
          filter: {
            candidateId: { eq: '{{trigger.recordId}}' },
          },
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  const draftReply = await createWorkflowStep({
    workflowVersionId,
    stepType: 'AI_AGENT',
    parentStepId: findMessages.id,
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
            'Draft a reply using the latest inbound whatsappMessage.message texts.',
            'Do not book a meeting automatically.',
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
            value: `{{${draftReply.id}.result.message}}`,
          },
        ],
        notifyOnPending: formNotifyOnPending(
          'Review inbound reply',
          `Draft: {{${draftReply.id}.result.message}}`,
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
          workspaceMemberId: '',
          linkedinProfileId: '{{trigger.linkedinProfileId}}',
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

const bindProjectOutreachWorkflow = async (workflowBId: string) => {
  const projects = await graphqlRequest<{
    projects: {
      edges: Array<{
        node: { id: string; name?: string; gtmRunKey?: string };
      }>;
    };
  }>(
    `query FindGtmProject($filter: ProjectFilterInput!) {
      projects(filter: $filter, first: 5) {
        edges { node { id name gtmRunKey } }
      }
    }`,
    {
      filter: {
        gtmRunKey: { eq: GTM_RUN_KEY },
      },
    },
  );

  const projectId = projects.projects.edges[0]?.node.id;

  if (!projectId) {
    console.warn(
      `No Project with gtmRunKey=${GTM_RUN_KEY}; skip outreachWorkflowId bind`,
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
        sendTimezone: 'America/Los_Angeles',
        sendWindowStart: '09:00',
        sendWindowEnd: '17:00',
        maxConnectsPerDay: 25,
        maxConnectsPerWeek: 100,
        minConnectGapMinutes: 60,
        minMessageGapMinutes: 15,
        maxCommentsPerDay: 20,
        maxEmailsPerDay: 50,
        icpSpec: JSON.stringify({
          std_function: ['talent acquisition', 'people'],
          std_grade: ['leadership', 'mid'],
          buyerTitles: ['Head of Talent', 'VP People'],
        }),
        complianceCopy:
          'Stop if not interested or unsubscribe. Do not pressure. Respect OOO.',
      },
    },
  );

  return projectId;
};

const main = async () => {
  const workflowBId = process.env.GTM_OUTREACH_WORKFLOW_B_ID || v4();
  const workflowAcceptId =
    process.env.GTM_OUTREACH_WORKFLOW_ACCEPT_ID || v4();
  const workflowCId = process.env.GTM_OUTREACH_WORKFLOW_C_ID || v4();

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

  const workflowC = await createWorkflow(workflowCId, WORKFLOW_C_NAME);
  const stepIdsC = await deployWorkflowC(workflowC.workflowVersionId);
  await activateWorkflowVersion(workflowC.workflowVersionId);

  const projectId = await bindProjectOutreachWorkflow(workflowB.workflowId);

  console.log('GTM outreach workflows setup complete');
  console.log(`Workflow B (per candidate): ${workflowB.workflowId}`);
  console.log(`Workflow accept: ${workflowAccept.workflowId}`);
  console.log(`Workflow C (reply): ${workflowC.workflowId}`);
  console.log(`Project bind: ${projectId ?? 'skipped'}`);
  console.log('Open /gtm-home?workflowId=' + workflowB.workflowId);
  console.log('Step IDs B:', stepIdsB);
  console.log('Step IDs accept:', stepIdsAccept);
  console.log('Step IDs C:', stepIdsC);
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Failed to set up GTM outreach workflows:', message);
  process.exit(1);
});

