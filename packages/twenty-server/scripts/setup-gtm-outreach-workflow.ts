import axios from 'axios';
import { StepLogicalOperator, ViewFilterOperand } from 'twenty-shared';
import { v4 } from 'uuid';

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
const WORKFLOW_C_NAME = 'GTM Outreach — Reply to Meeting';

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
}: {
  workflowVersionId: string;
  stepType: string;
  parentStepId: string;
  parentStepConnectionOptions?: { branchId?: string };
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

const deployWorkflowB = async (workflowVersionId: string) => {
  const firstDegreeGroupId = v4();
  const firstDegreeFilterId = v4();
  const firstDegreeBranchId = v4();
  const secondDegreeBranchId = v4();

  const acceptedGroupId = v4();
  const acceptedFilterId = v4();
  const acceptedBranchId = v4();
  const ignoredBranchId = v4();

  const inMailGroupId = v4();
  const inMailFilterId = v4();
  const inMailBranchId = v4();
  const emailBranchId = v4();

  // Trigger must exist before createWorkflowVersionStep can attach to it
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
      settings: {
        input: {
          stepFilterGroups: [
            {
              id: v4(),
              logicalOperator: StepLogicalOperator.AND,
            },
          ],
          stepFilters: [
            {
              id: v4(),
              type: 'SELECT',
              stepOutputKey: '{{trigger.outreachSequenceStage}}',
              operand: ViewFilterOperand.IS,
              value: 'QUEUED',
              stepFilterGroupId: firstDegreeGroupId,
            },
          ],
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  // Re-create filter with correct group id linkage
  const queuedGroupId = v4();
  const queuedFilterId = v4();

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...filterQueued,
      name: 'Only QUEUED candidates',
      valid: true,
      settings: {
        input: {
          stepFilterGroups: [
            {
              id: queuedGroupId,
              logicalOperator: StepLogicalOperator.AND,
            },
          ],
          stepFilters: [
            {
              id: queuedFilterId,
              type: 'SELECT',
              stepOutputKey: '{{trigger.outreachSequenceStage}}',
              operand: ViewFilterOperand.IS,
              value: 'QUEUED',
              stepFilterGroupId: queuedGroupId,
            },
          ],
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
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

  const degreeIfElse = await createWorkflowStep({
    workflowVersionId,
    stepType: 'IF_ELSE',
    parentStepId: findCandidate.id,
  });

  const updateFirstDegree = await createWorkflowStep({
    workflowVersionId,
    stepType: 'UPDATE_RECORD',
    parentStepId: degreeIfElse.id,
    parentStepConnectionOptions: { branchId: firstDegreeBranchId },
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...updateFirstDegree,
      name: 'Mark 1st-degree pending message',
      valid: true,
      settings: {
        input: {
          objectName: 'candidate',
          objectRecordId: `{{${findCandidate.id}.result.first.id}}`,
          objectRecord: {
            pendingChannel: 'OTHER',
            pendingMessageBody:
              'Draft 1st-degree LinkedIn/email message (approval or auto)',
            outreachSequenceStage: 'CONNECTION_ACCEPTED',
          },
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  const formApproveFirst = await createWorkflowStep({
    workflowVersionId,
    stepType: 'FORM',
    parentStepId: updateFirstDegree.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...formApproveFirst,
      name: 'Approve 1st-degree send (skip if AUTO)',
      valid: true,
      settings: {
        input: [
          {
            id: v4(),
            name: 'approveSend',
            label: 'Approve send',
            type: 'BOOLEAN',
            value: true,
          },
        ],
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  const sendLinkedInMessage = await createWorkflowStep({
    workflowVersionId,
    stepType: 'SEND_LINKEDIN_MESSAGE',
    parentStepId: formApproveFirst.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...sendLinkedInMessage,
      name: 'Send LinkedIn message (1st degree)',
      valid: true,
      settings: {
        input: {
          linkedinUrl: `{{${findCandidate.id}.result.first.linkedinLink.primaryLinkUrl}}`,
          message: `{{${findCandidate.id}.result.first.pendingMessageBody}}`,
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  const sendConnect = await createWorkflowStep({
    workflowVersionId,
    stepType: 'SEND_LINKEDIN_CONNECTION_REQUEST',
    parentStepId: degreeIfElse.id,
    parentStepConnectionOptions: { branchId: secondDegreeBranchId },
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...sendConnect,
      name: 'Send LinkedIn connection (2nd+)',
      valid: true,
      settings: {
        input: {
          linkedinUrl: `{{${findCandidate.id}.result.first.linkedinLink.primaryLinkUrl}}`,
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

  const waitAccept = await createWorkflowStep({
    workflowVersionId,
    stepType: 'DELAY',
    parentStepId: markConnectionSent.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...waitAccept,
      name: 'Wait for connection accept',
      valid: true,
      settings: {
        input: delaySettings(),
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  const refreshCandidate = await createWorkflowStep({
    workflowVersionId,
    stepType: 'FIND_RECORDS',
    parentStepId: waitAccept.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...refreshCandidate,
      name: 'Refresh Candidate connection status',
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

  const acceptedIfElse = await createWorkflowStep({
    workflowVersionId,
    stepType: 'IF_ELSE',
    parentStepId: refreshCandidate.id,
  });

  const approveAccepted = await createWorkflowStep({
    workflowVersionId,
    stepType: 'FORM',
    parentStepId: acceptedIfElse.id,
    parentStepConnectionOptions: { branchId: acceptedBranchId },
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...approveAccepted,
      name: 'Approve post-accept LI message',
      valid: true,
      settings: {
        input: [
          {
            id: v4(),
            name: 'approveSend',
            label: 'Approve send',
            type: 'BOOLEAN',
            value: true,
          },
        ],
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  const sendAfterAccept = await createWorkflowStep({
    workflowVersionId,
    stepType: 'SEND_LINKEDIN_MESSAGE',
    parentStepId: approveAccepted.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...sendAfterAccept,
      name: 'Send LI message after accept',
      valid: true,
      settings: {
        input: {
          linkedinUrl: `{{${refreshCandidate.id}.result.first.linkedinLink.primaryLinkUrl}}`,
          message:
            'Thanks for connecting — quick note on how we help teams map ICP buyers.',
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  const inMailIfElse = await createWorkflowStep({
    workflowVersionId,
    stepType: 'IF_ELSE',
    parentStepId: acceptedIfElse.id,
    parentStepConnectionOptions: { branchId: ignoredBranchId },
  });

  const sendInMail = await createWorkflowStep({
    workflowVersionId,
    stepType: 'SEND_LINKEDIN_INMAIL',
    parentStepId: inMailIfElse.id,
    parentStepConnectionOptions: { branchId: inMailBranchId },
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...sendInMail,
      name: 'InMail fallback',
      valid: true,
      settings: {
        input: {
          linkedinUrl: `{{${refreshCandidate.id}.result.first.linkedinLink.primaryLinkUrl}}`,
          subject: 'Quick intro',
          message: 'Sharing a short note on ICP outreach for your team.',
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  const markEnriching = await createWorkflowStep({
    workflowVersionId,
    stepType: 'UPDATE_RECORD',
    parentStepId: inMailIfElse.id,
    parentStepConnectionOptions: { branchId: emailBranchId },
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...markEnriching,
      name: 'Mark EMAIL_ENRICHING',
      valid: true,
      settings: {
        input: {
          objectName: 'candidate',
          objectRecordId: `{{${refreshCandidate.id}.result.first.id}}`,
          objectRecord: {
            outreachSequenceStage: 'EMAIL_ENRICHING',
            enrichStatus: 'RUNNING',
          },
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  const email1 = await createWorkflowStep({
    workflowVersionId,
    stepType: 'SEND_EMAIL',
    parentStepId: markEnriching.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...email1,
      name: 'Email 1',
      valid: true,
      settings: {
        input: {
          email: `{{${refreshCandidate.id}.result.first.email.primaryEmail}}`,
          subject: 'Intro — GTM Command',
          body: 'Hi — reaching out about mapping ICP buyers for your team.',
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  const delayEmail2 = await createWorkflowStep({
    workflowVersionId,
    stepType: 'DELAY',
    parentStepId: email1.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...delayEmail2,
      name: 'Wait before email 2',
      valid: true,
      settings: {
        input: delaySettings(),
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  const email2 = await createWorkflowStep({
    workflowVersionId,
    stepType: 'SEND_EMAIL',
    parentStepId: delayEmail2.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...email2,
      name: 'Email 2',
      valid: true,
      settings: {
        input: {
          email: `{{${refreshCandidate.id}.result.first.email.primaryEmail}}`,
          subject: 'Following up',
          body: 'Circling back in case this was buried.',
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  const delayEmail3 = await createWorkflowStep({
    workflowVersionId,
    stepType: 'DELAY',
    parentStepId: email2.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...delayEmail3,
      name: 'Wait before email 3',
      valid: true,
      settings: {
        input: delaySettings(),
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  const email3 = await createWorkflowStep({
    workflowVersionId,
    stepType: 'SEND_EMAIL',
    parentStepId: delayEmail3.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...email3,
      name: 'Email 3',
      valid: true,
      settings: {
        input: {
          email: `{{${refreshCandidate.id}.result.first.email.primaryEmail}}`,
          subject: 'Last note',
          body: 'Happy to close the loop if timing is off — otherwise glad to share a short demo.',
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...degreeIfElse,
      name: 'Connection degree == 1?',
      valid: true,
      nextStepIds: [],
      settings: {
        input: {
          stepFilterGroups: [
            {
              id: firstDegreeGroupId,
              logicalOperator: StepLogicalOperator.AND,
            },
          ],
          stepFilters: [
            {
              id: firstDegreeFilterId,
              type: 'NUMBER',
              stepOutputKey: `{{${findCandidate.id}.result.first.connectionDegree}}`,
              operand: ViewFilterOperand.IS,
              value: '1',
              stepFilterGroupId: firstDegreeGroupId,
            },
          ],
          branches: [
            {
              id: firstDegreeBranchId,
              nextStepIds: [updateFirstDegree.id],
              filterGroupId: firstDegreeGroupId,
            },
            {
              id: secondDegreeBranchId,
              nextStepIds: [sendConnect.id],
            },
          ],
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...acceptedIfElse,
      name: 'Connection accepted?',
      valid: true,
      nextStepIds: [],
      settings: {
        input: {
          stepFilterGroups: [
            {
              id: acceptedGroupId,
              logicalOperator: StepLogicalOperator.AND,
            },
          ],
          stepFilters: [
            {
              id: acceptedFilterId,
              type: 'SELECT',
              stepOutputKey: `{{${refreshCandidate.id}.result.first.connectionStatus}}`,
              operand: ViewFilterOperand.IS,
              value: 'ACCEPTED',
              stepFilterGroupId: acceptedGroupId,
            },
          ],
          branches: [
            {
              id: acceptedBranchId,
              nextStepIds: [approveAccepted.id],
              filterGroupId: acceptedGroupId,
            },
            {
              id: ignoredBranchId,
              nextStepIds: [inMailIfElse.id],
            },
          ],
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...inMailIfElse,
      name: 'InMail fallback enabled?',
      valid: true,
      nextStepIds: [],
      settings: {
        input: {
          stepFilterGroups: [
            {
              id: inMailGroupId,
              logicalOperator: StepLogicalOperator.AND,
            },
          ],
          stepFilters: [
            {
              id: inMailFilterId,
              type: 'BOOLEAN',
              // Project.inMailFallbackEnabled is checked via candidate pending flag in live runs;
              // seed uses a placeholder path — simulator sets connectionStatus IGNORED + email path.
              stepOutputKey: `{{${refreshCandidate.id}.result.first.pendingChannel}}`,
              operand: ViewFilterOperand.IS,
              value: 'INMAIL',
              stepFilterGroupId: inMailGroupId,
            },
          ],
          branches: [
            {
              id: inMailBranchId,
              nextStepIds: [sendInMail.id],
              filterGroupId: inMailGroupId,
            },
            {
              id: emailBranchId,
              nextStepIds: [markEnriching.id],
            },
          ],
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  return {
    filterQueuedId: filterQueued.id,
    findCandidateId: findCandidate.id,
    degreeIfElseId: degreeIfElse.id,
    sendConnectId: sendConnect.id,
    waitAcceptId: waitAccept.id,
    email1Id: email1.id,
    email3Id: email3.id,
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
      settings: {
        input: {
          stepFilterGroups: [
            {
              id: repliedGroupId,
              logicalOperator: StepLogicalOperator.AND,
            },
          ],
          stepFilters: [
            {
              id: repliedFilterId,
              type: 'SELECT',
              stepOutputKey: '{{trigger.outreachSequenceStage}}',
              operand: ViewFilterOperand.IS,
              value: 'REPLIED',
              stepFilterGroupId: repliedGroupId,
            },
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
    nextStepIds: [filterReplied.id],
  });

  const markNegotiating = await createWorkflowStep({
    workflowVersionId,
    stepType: 'UPDATE_RECORD',
    parentStepId: filterReplied.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...markNegotiating,
      name: 'Mark NEGOTIATING',
      valid: true,
      settings: {
        input: {
          objectName: 'candidate',
          objectRecordId: '{{trigger.recordId}}',
          objectRecord: {
            outreachSequenceStage: 'NEGOTIATING',
            pendingMessageBody:
              'Objective: negotiate an online meeting time.',
          },
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  const createMeeting = await createWorkflowStep({
    workflowVersionId,
    stepType: 'CREATE_CALENDAR_EVENT',
    parentStepId: markNegotiating.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...createMeeting,
      name: 'Book meeting',
      valid: true,
      settings: {
        input: {
          title: 'GTM intro meeting',
          description: 'Booked from GTM outreach reply workflow',
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  const markBooked = await createWorkflowStep({
    workflowVersionId,
    stepType: 'UPDATE_RECORD',
    parentStepId: createMeeting.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...markBooked,
      name: 'Mark MEETING_BOOKED',
      valid: true,
      settings: {
        input: {
          objectName: 'candidate',
          objectRecordId: '{{trigger.recordId}}',
          objectRecord: {
            outreachSequenceStage: 'MEETING_BOOKED',
          },
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  const createColdCallTask = await createWorkflowStep({
    workflowVersionId,
    stepType: 'CREATE_RECORD',
    parentStepId: markBooked.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...createColdCallTask,
      name: 'Create cold-call task',
      valid: true,
      settings: {
        input: {
          objectName: 'task',
          objectRecord: {
            title: 'Cold call — GTM follow-up',
            bodyV2: {
              blocknote: JSON.stringify([
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: 'Enrich phone and add to cold call list after meeting booked.',
                    },
                  ],
                },
              ]),
              markdown:
                'Enrich phone and add to cold call list after meeting booked.',
            },
          },
        },
        outputSchema: {},
        errorHandlingOptions: errorHandling,
      },
    },
  });

  return {
    filterRepliedId: filterReplied.id,
    createMeetingId: createMeeting.id,
    createColdCallTaskId: createColdCallTask.id,
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
  const workflowCId = process.env.GTM_OUTREACH_WORKFLOW_C_ID || v4();

  const workflowB = await createWorkflow(workflowBId, WORKFLOW_B_NAME);
  const stepIdsB = await deployWorkflowB(workflowB.workflowVersionId);

  await activateWorkflowVersion(workflowB.workflowVersionId);

  const workflowC = await createWorkflow(workflowCId, WORKFLOW_C_NAME);
  const stepIdsC = await deployWorkflowC(workflowC.workflowVersionId);

  await activateWorkflowVersion(workflowC.workflowVersionId);

  const projectId = await bindProjectOutreachWorkflow(workflowB.workflowId);

  console.log('GTM outreach workflows setup complete');
  console.log(`Workflow B (per candidate): ${workflowB.workflowId}`);
  console.log(`Workflow C (reply→meeting): ${workflowC.workflowId}`);
  console.log(`Project bind: ${projectId ?? 'skipped'}`);
  console.log('Open /gtm-home?workflowId=' + workflowB.workflowId);
  console.log('Step IDs B:', stepIdsB);
  console.log('Step IDs C:', stepIdsC);
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Failed to set up GTM outreach workflows:', message);
  process.exit(1);
});
