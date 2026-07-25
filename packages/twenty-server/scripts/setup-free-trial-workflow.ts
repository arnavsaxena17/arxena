import axios from 'axios';
import { StepLogicalOperator, ViewFilterOperand } from 'twenty-shared';
import { v4 } from 'uuid';

const SERVER_URL = process.env.SERVER_URL || 'http://127.0.0.1:3000';
const SERVER_HOST = process.env.SERVER_HOST || 'arxena.localhost';
const GRAPHQL_URL = `${SERVER_URL}/graphql`;
const API_TOKEN = process.env.API_TOKEN;
const TRIGGER_STEP_ID = 'trigger';

const FREE_TRIAL_LEAD_WORKFLOW_NAME =
  'Free Trial Lead — Meeting Follow-up';

const SAMPLE_LEAD = {
  name: 'Arnav Saxena',
  email: 'arnav@arxorg.com',
  company: 'arxorg',
  source: 'homepage_hero' as const,
};

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

const createWorkflow = async (workflowId: string) => {
  const data = await graphqlRequest<{ createWorkflow: { id: string } }>(
    `mutation CreateOneWorkflow($input: WorkflowCreateInput!) {
      createWorkflow(data: $input) { id }
    }`,
    {
      input: {
        id: workflowId,
        name: FREE_TRIAL_LEAD_WORKFLOW_NAME,
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

  const workflowVersionId =
    versionData.workflowVersions.edges[0]?.node.id;

  if (!workflowVersionId) {
    throw new Error('Workflow version was not created');
  }

  return { workflowId: data.createWorkflow.id, workflowVersionId };
};

const updateWorkflowTrigger = async ({
  workflowVersionId,
  nextStepIds,
}: {
  workflowVersionId: string;
  nextStepIds: string[];
}) => {
  await graphqlRequest(
    `mutation UpdateOneWorkflowVersion($id: ID!, $input: WorkflowVersionUpdateInput!) {
      updateWorkflowVersion(id: $id, data: $input) { id }
    }`,
    {
      id: workflowVersionId,
      input: {
        trigger: {
          type: 'DATABASE_EVENT',
          name: 'Opportunity is Created',
          nextStepIds,
          settings: {
            eventName: 'opportunity.created',
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
  const data = await graphqlRequest<{
    createWorkflowVersionStep: WorkflowStep;
  }>(
    `mutation CreateWorkflowVersionStep($input: CreateWorkflowVersionStepInput!) {
      createWorkflowVersionStep(input: $input) {
        id
        name
        type
        valid
        settings
      }
    }`,
    {
      input: {
        workflowVersionId,
        stepType,
        parentStepId,
        parentStepConnectionOptions,
      },
    },
  );

  return data.createWorkflowVersionStep;
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
    `mutation ActivateWorkflowVersion($workflowVersionId: String!) {
      activateWorkflowVersion(workflowVersionId: $workflowVersionId)
    }`,
    { workflowVersionId },
  );
};

const deployFreeTrialWorkflow = async ({
  workflowVersionId,
  connectedAccountId,
  delayMinutes,
  calendlyBookingUrl,
}: {
  workflowVersionId: string;
  connectedAccountId: string;
  delayMinutes: number;
  calendlyBookingUrl: string;
}) => {
  const meetingBranchGroupId = v4();
  const meetingBranchFilterId = v4();
  const meetingBranchId = v4();
  const noMeetingBranchId = v4();

  const delayStep = await createWorkflowStep({
    workflowVersionId,
    stepType: 'DELAY',
    parentStepId: TRIGGER_STEP_ID,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...delayStep,
      name: 'Wait 10 minutes',
      valid: true,
      settings: {
        input: {
          delayType: 'DURATION',
          duration: {
            days: 0,
            hours: 0,
            minutes: delayMinutes,
            seconds: 0,
          },
        },
        outputSchema: {},
        errorHandlingOptions: {
          retryOnFailure: { value: false },
          continueOnFailure: { value: false },
        },
      },
    },
  });

  await updateWorkflowTrigger({
    workflowVersionId,
    nextStepIds: [delayStep.id],
  });

  const findOpportunityStep = await createWorkflowStep({
    workflowVersionId,
    stepType: 'FIND_RECORDS',
    parentStepId: delayStep.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...findOpportunityStep,
      name: 'Refresh Opportunity',
      valid: true,
      settings: {
        input: {
          objectName: 'opportunity',
          limit: 1,
          filter: {
            id: { eq: '{{trigger.recordId}}' },
          },
        },
        outputSchema: {},
        errorHandlingOptions: {
          retryOnFailure: { value: false },
          continueOnFailure: { value: false },
        },
      },
    },
  });

  const findPersonStep = await createWorkflowStep({
    workflowVersionId,
    stepType: 'FIND_RECORDS',
    parentStepId: findOpportunityStep.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...findPersonStep,
      name: 'Find Point of Contact',
      valid: true,
      settings: {
        input: {
          objectName: 'person',
          limit: 1,
          filter: {
            id: {
              eq: `{{${findOpportunityStep.id}.result.first.pointOfContactId}}`,
            },
          },
        },
        outputSchema: {},
        errorHandlingOptions: {
          retryOnFailure: { value: false },
          continueOnFailure: { value: false },
        },
      },
    },
  });

  const ifElseStep = await createWorkflowStep({
    workflowVersionId,
    stepType: 'IF_ELSE',
    parentStepId: findPersonStep.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...ifElseStep,
      name: 'Calendly Meeting Scheduled?',
      valid: true,
      nextStepIds: [],
      settings: {
        input: {
          stepFilterGroups: [
            {
              id: meetingBranchGroupId,
              logicalOperator: StepLogicalOperator.AND,
            },
          ],
          stepFilters: [
            {
              id: meetingBranchFilterId,
              type: 'date',
              stepOutputKey: `{{${findOpportunityStep.id}.result.first.meetingScheduledAt}}`,
              operand: ViewFilterOperand.IS_NOT_EMPTY,
              value: '',
              stepFilterGroupId: meetingBranchGroupId,
            },
          ],
          branches: [
            {
              id: meetingBranchId,
              nextStepIds: [],
              filterGroupId: meetingBranchGroupId,
            },
            {
              id: noMeetingBranchId,
              nextStepIds: [],
            },
          ],
        },
        outputSchema: {},
        errorHandlingOptions: {
          retryOnFailure: { value: false },
          continueOnFailure: { value: false },
        },
      },
    },
  });

  const llmThankYouStep = await createWorkflowStep({
    workflowVersionId,
    stepType: 'AI_AGENT',
    parentStepId: ifElseStep.id,
    parentStepConnectionOptions: { branchId: meetingBranchId },
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...llmThankYouStep,
      name: 'Generate Thank You Email',
      valid: true,
      settings: {
        input: {
          agentId: '',
          systemPrompt:
            'You write concise, warm onboarding emails for Arxena prospects who booked a demo meeting.',
          prompt: [
            'Write a short thank-you email for a free trial lead who scheduled a meeting.',
            `Lead name: {{${findPersonStep.id}.result.first.name.firstName}} {{${findPersonStep.id}.result.first.name.lastName}}`,
            `Company: {{${findOpportunityStep.id}.result.first.name}}`,
            'Tone: professional, friendly, excited about the upcoming meeting.',
            'Return JSON only: { "message": "<email body in HTML>" }',
          ].join('\n'),
        },
        outputSchema: {},
        errorHandlingOptions: {
          retryOnFailure: { value: false },
          continueOnFailure: { value: false },
        },
      },
    },
  });

  const emailThankYouStep = await createWorkflowStep({
    workflowVersionId,
    stepType: 'SEND_EMAIL',
    parentStepId: llmThankYouStep.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...emailThankYouStep,
      name: 'Send Thank You Email',
      valid: true,
      settings: {
        input: {
          connectedAccountId,
          email: `{{${findPersonStep.id}.result.first.emails.primaryEmail}}`,
          subject: 'Thanks for scheduling time with Arxena',
          body: `{{${llmThankYouStep.id}.result.message}}`,
        },
        outputSchema: {
          success: { isLeaf: true, type: 'boolean' },
        },
        errorHandlingOptions: {
          retryOnFailure: { value: false },
          continueOnFailure: { value: false },
        },
      },
    },
  });

  const llmReminderStep = await createWorkflowStep({
    workflowVersionId,
    stepType: 'AI_AGENT',
    parentStepId: ifElseStep.id,
    parentStepConnectionOptions: { branchId: noMeetingBranchId },
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...llmReminderStep,
      name: 'Generate Scheduling Reminder',
      valid: true,
      settings: {
        input: {
          agentId: '',
          systemPrompt:
            'You write concise follow-up emails encouraging Arxena free trial leads to book a demo.',
          prompt: [
            'Write a short email asking the lead to pick a meeting time.',
            `Lead name: {{${findPersonStep.id}.result.first.name.firstName}} {{${findPersonStep.id}.result.first.name.lastName}}`,
            `Company: {{${findOpportunityStep.id}.result.first.name}}`,
            `Include this booking link: ${calendlyBookingUrl}`,
            'Tone: helpful, not pushy.',
            'Return JSON only: { "message": "<email body in HTML>" }',
          ].join('\n'),
        },
        outputSchema: {},
        errorHandlingOptions: {
          retryOnFailure: { value: false },
          continueOnFailure: { value: false },
        },
      },
    },
  });

  const emailReminderStep = await createWorkflowStep({
    workflowVersionId,
    stepType: 'SEND_EMAIL',
    parentStepId: llmReminderStep.id,
  });

  await updateWorkflowStep({
    workflowVersionId,
    step: {
      ...emailReminderStep,
      name: 'Send Scheduling Reminder',
      valid: true,
      settings: {
        input: {
          connectedAccountId,
          email: `{{${findPersonStep.id}.result.first.emails.primaryEmail}}`,
          subject: 'Pick a time to connect with Arxena',
          body: `{{${llmReminderStep.id}.result.message}}`,
        },
        outputSchema: {
          success: { isLeaf: true, type: 'boolean' },
        },
        errorHandlingOptions: {
          retryOnFailure: { value: false },
          continueOnFailure: { value: false },
        },
      },
    },
  });

  return {
    delayStepId: delayStep.id,
    findOpportunityStepId: findOpportunityStep.id,
    findPersonStepId: findPersonStep.id,
    ifElseStepId: ifElseStep.id,
    emailThankYouStepId: emailThankYouStep.id,
    emailReminderStepId: emailReminderStep.id,
  };
};

const createSampleLeadRecords = async () => {
  let companyId: string;

  try {
    const company = await graphqlRequest<{
      createCompany: { id: string; name: string };
    }>(
      `mutation CreateCompany($input: CompanyCreateInput!) {
        createCompany(data: $input) { id name }
      }`,
      {
        input: {
          name: SAMPLE_LEAD.company,
          domainName: {
            primaryLinkUrl: 'https://arxorg.com',
            primaryLinkLabel: 'arxorg.com',
          },
        },
      },
    );
    companyId = company.createCompany.id;
  } catch {
    const existingCompany = await graphqlRequest<{
      companies: { edges: Array<{ node: { id: string } }> };
    }>(
      `query FindCompany($filter: CompanyFilterInput!) {
        companies(filter: $filter, first: 1) {
          edges { node { id } }
        }
      }`,
      {
        filter: {
          name: { eq: SAMPLE_LEAD.company },
        },
      },
    );
    companyId = existingCompany.companies.edges[0]?.node.id;
    if (!companyId) {
      throw new Error('Could not create or find sample company');
    }
  }

  let personId: string;

  const existingPerson = await graphqlRequest<{
    people: { edges: Array<{ node: { id: string } }> };
  }>(
    `query FindPerson($filter: PersonFilterInput!) {
      people(filter: $filter, first: 1) {
        edges { node { id } }
      }
    }`,
    {
      filter: {
        emails: { primaryEmail: { eq: SAMPLE_LEAD.email } },
      },
    },
  );

  personId = existingPerson.people.edges[0]?.node.id;

  if (!personId) {
    const person = await graphqlRequest<{
      createPerson: { id: string };
    }>(
      `mutation CreatePerson($input: PersonCreateInput!) {
        createPerson(data: $input) { id }
      }`,
      {
        input: {
          name: { firstName: 'Arnav', lastName: 'Saxena' },
          emails: { primaryEmail: SAMPLE_LEAD.email },
          companyId,
        },
      },
    );
    personId = person.createPerson.id;
  }

  const opportunity = await graphqlRequest<{
    createOpportunity: { id: string; name: string };
  }>(
    `mutation CreateOpportunity($input: OpportunityCreateInput!) {
      createOpportunity(data: $input) { id name }
    }`,
    {
      input: {
        name: `Free Trial — Arnav Saxena @ ${SAMPLE_LEAD.company}`,
        stage: 'NEW',
        companyId,
        pointOfContactId: personId,
      },
    },
  );

  return {
    companyId,
    personId,
    opportunityId: opportunity.createOpportunity.id,
  };
};

const main = async () => {
  const connectedAccountId = process.env.FREE_TRIAL_WORKFLOW_CONNECTED_ACCOUNT_ID;

  if (!connectedAccountId) {
    throw new Error('FREE_TRIAL_WORKFLOW_CONNECTED_ACCOUNT_ID is required');
  }

  const workflowId = process.env.FREE_TRIAL_WORKFLOW_ID || v4();
  const { workflowVersionId } = await createWorkflow(workflowId);

  const stepIds = await deployFreeTrialWorkflow({
    workflowVersionId,
    connectedAccountId,
    delayMinutes: Number(process.env.FREE_TRIAL_WORKFLOW_DELAY_MINUTES || 10),
    calendlyBookingUrl:
      process.env.NEXT_PUBLIC_CALENDLY_URL || 'https://calendly.com/arxena/30min',
  });

  await activateWorkflowVersion(workflowVersionId);

  const sampleRecords = await createSampleLeadRecords();

  console.log('Free trial workflow setup complete');
  console.log(`Workflow ID: ${workflowId}`);
  console.log(`Workflow version ID: ${workflowVersionId}`);
  console.log('Sample CRM records:', sampleRecords);
  console.log('Workflow step IDs:', stepIds);
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Failed to set up free trial workflow:', message);
  process.exit(1);
});
