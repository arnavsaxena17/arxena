import axios from 'axios';
import { randomUUID } from 'crypto';

const GRAPHQL_URL =
  process.env.GRAPHQL_URL || 'http://arxena-2.localhost:3000/graphql';
const API_TOKEN = process.env.API_TOKEN;
const RECIPIENT_PHONE = process.env.WA_RECIPIENT || '918411937769';
const TRIGGER_STEP_ID = 'trigger';

if (!API_TOKEN) {
  throw new Error('API_TOKEN is required');
}

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

type FormField = {
  id: string;
  name: string;
  label: string;
  type: string;
  placeholder?: string;
  value?: unknown;
  settings?: Record<string, unknown>;
};

type FormCase = {
  name: string;
  registryName?: string;
  fields: FormField[];
};

const FORM_CASES: FormCase[] = [
  {
    name: 'WA Form Test — BOOLEAN',
    registryName: 'wf_form_boolean',
    fields: [
      {
        id: randomUUID(),
        name: 'approve',
        label: 'Approve',
        type: 'BOOLEAN',
      },
    ],
  },
  {
    name: 'WA Form Test — TEXT',
    registryName: 'wf_form_text',
    fields: [
      {
        id: randomUUID(),
        name: 'notes',
        label: 'Notes',
        type: 'TEXT',
        placeholder: 'Enter your notes',
        value: 'Sample: please review outreach draft and reply with edits.',
      },
    ],
  },
  {
    name: 'WA Form Test — NUMBER',
    registryName: 'wf_form_number',
    fields: [
      {
        id: randomUUID(),
        name: 'amount',
        label: 'Amount',
        type: 'NUMBER',
        placeholder: 'e.g. 1000',
        value: 250,
      },
    ],
  },
  {
    name: 'WA Form Test — DATE',
    registryName: 'wf_form_date',
    fields: [
      {
        id: randomUUID(),
        name: 'dueDate',
        label: 'Due date',
        type: 'DATE',
        value: '2026-08-20',
      },
    ],
  },
  {
    name: 'WA Form Test — SELECT',
    registryName: 'wf_form_select',
    fields: [
      {
        id: randomUUID(),
        name: 'priority',
        label: 'Priority',
        type: 'SELECT',
        value: 'medium',
        settings: {
          options: [
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
          ],
        },
      },
    ],
  },
  {
    name: 'WA Form Test — MULTI_SELECT',
    registryName: 'wf_form_multi_select',
    fields: [
      {
        id: randomUUID(),
        name: 'channels',
        label: 'Channels',
        type: 'MULTI_SELECT',
        value: ['linkedin', 'email'],
        settings: {
          options: [
            { value: 'linkedin', label: 'LinkedIn' },
            { value: 'email', label: 'Email' },
            { value: 'whatsapp', label: 'WhatsApp' },
          ],
        },
      },
    ],
  },
  {
    name: 'WA Form Test — TEXT+NUMBER+DATE',
    registryName: 'wf_form_text_number_date',
    fields: [
      {
        id: randomUUID(),
        name: 'summary',
        label: 'Summary',
        type: 'TEXT',
        placeholder: 'Short summary',
        value: 'Sample summary for Acme outreach.',
      },
      {
        id: randomUUID(),
        name: 'score',
        label: 'Score',
        type: 'NUMBER',
        value: 8,
      },
      {
        id: randomUUID(),
        name: 'followUpAt',
        label: 'Follow-up date',
        type: 'DATE',
        value: '2026-08-25',
      },
    ],
  },
  {
    name: 'WA Form Test — BOOLEAN+TEXT',
    registryName: 'wf_form_boolean_text',
    fields: [
      {
        id: randomUUID(),
        name: 'approve',
        label: 'Approve',
        type: 'BOOLEAN',
      },
      {
        id: randomUUID(),
        name: 'reason',
        label: 'Reason',
        type: 'TEXT',
        placeholder: 'Why approve or reject?',
        value: 'Sample reason: fit looks strong; proceed to intro.',
      },
    ],
  },
];

const isDefinedWorkflowStep = (value: unknown): value is WorkflowStep => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'type' in value
  );
};

const graphqlRequest = async <T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> => {
  const response = await axios.post<GraphQLResponse<T>>(
    GRAPHQL_URL,
    { query, variables },
    {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
        'x-locale': 'en',
      },
    },
  );

  if (response.data.errors?.length) {
    throw new Error(JSON.stringify(response.data.errors, null, 2));
  }

  if (!response.data.data) {
    throw new Error('GraphQL response did not include data');
  }

  return response.data.data;
};

const extractCreatedStep = (
  changes: { stepsDiff?: Array<{ type: string; value?: unknown }> },
): WorkflowStep => {
  const stepsDiff = changes.stepsDiff ?? [];

  for (const diff of stepsDiff) {
    if (diff.type === 'CREATE' && isDefinedWorkflowStep(diff.value)) {
      return diff.value;
    }

    if (diff.type === 'CHANGE' && Array.isArray(diff.value)) {
      const firstValue = diff.value[0];

      if (isDefinedWorkflowStep(firstValue)) {
        return firstValue;
      }
    }
  }

  throw new Error(`Could not extract created step: ${JSON.stringify(changes)}`);
};

const createWorkflow = async (name: string) => {
  const data = await graphqlRequest<{ createWorkflow: { id: string } }>(
    `mutation CreateOneWorkflow($input: WorkflowCreateInput!) {
      createWorkflow(data: $input) { id }
    }`,
    { input: { name } },
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

const updateManualTrigger = async (workflowVersionId: string) => {
  await graphqlRequest(
    `mutation UpdateWorkflowVersionTrigger($input: UpdateWorkflowVersionTriggerInput!) {
      updateWorkflowVersionTrigger(input: $input) { trigger }
    }`,
    {
      input: {
        workflowVersionId,
        trigger: {
          type: 'MANUAL',
          name: 'Manual Trigger',
          nextStepIds: [],
          settings: {
            outputSchema: {},
            availability: { type: 'GLOBAL', locations: undefined },
          },
          position: { x: 0, y: 0 },
        },
      },
    },
  );
};

const createFormStep = async (workflowVersionId: string) => {
  const data = await graphqlRequest<{
    createWorkflowVersionStep: { stepsDiff?: unknown[] };
  }>(
    `mutation CreateWorkflowVersionStep($input: CreateWorkflowVersionStepInput!) {
      createWorkflowVersionStep(input: $input) {
        stepsDiff
      }
    }`,
    {
      input: {
        workflowVersionId,
        stepType: 'FORM',
        parentStepId: TRIGGER_STEP_ID,
        position: { x: 200, y: 0 },
      },
    },
  );

  return extractCreatedStep(
    data.createWorkflowVersionStep as {
      stepsDiff?: Array<{ type: string; value?: unknown }>;
    },
  );
};

const updateFormStep = async ({
  workflowVersionId,
  step,
  formCase,
}: {
  workflowVersionId: string;
  step: WorkflowStep;
  formCase: FormCase;
}) => {
  await graphqlRequest(
    `mutation UpdateWorkflowVersionStep($input: UpdateWorkflowVersionStepInput!) {
      updateWorkflowVersionStep(input: $input) { id }
    }`,
    {
      input: {
        workflowVersionId,
        step: {
          ...step,
          name: formCase.name.replace('WA Form Test — ', 'Form: '),
          valid: true,
          settings: {
            ...step.settings,
            input: formCase.fields,
            notifyOnPending: {
              channels: ['WHATSAPP_OFFICIAL'],
              contextTemplate: `${formCase.name} needs your input`,
              detailsTemplate: `Fields: ${formCase.fields
                .map((field) => field.label)
                .join(', ')}`,
              whatsappOfficialRegistryName: formCase.registryName,
              recipients: {
                WHATSAPP_OFFICIAL: RECIPIENT_PHONE,
              },
            },
            outputSchema: {},
            errorHandlingOptions: {
              retryOnFailure: { value: false },
              continueOnFailure: { value: false },
            },
          },
        },
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

const runWorkflowVersion = async (workflowVersionId: string) => {
  const data = await graphqlRequest<{
    runWorkflowVersion: { workflowRunId: string };
  }>(
    `mutation RunWorkflowVersion($input: RunWorkflowVersionInput!) {
      runWorkflowVersion(input: $input) { workflowRunId }
    }`,
    {
      input: {
        workflowVersionId,
        payload: {},
      },
    },
  );

  return data.runWorkflowVersion.workflowRunId;
};

const main = async () => {
  const onlyName = process.env.ONLY_CASE;
  const cases = onlyName
    ? FORM_CASES.filter((formCase) => formCase.name.includes(onlyName))
    : FORM_CASES;
  const shouldRun = process.env.RUN_AFTER_CREATE !== '0';
  const results = [];

  for (const formCase of cases) {
    console.log(`\n=== Creating ${formCase.name} ===`);
    const { workflowId, workflowVersionId } = await createWorkflow(
      formCase.name,
    );
    await updateManualTrigger(workflowVersionId);
    const formStep = await createFormStep(workflowVersionId);
    await updateFormStep({ workflowVersionId, step: formStep, formCase });
    await activateWorkflowVersion(workflowVersionId);

    let workflowRunId: string | undefined;

    if (shouldRun) {
      workflowRunId = await runWorkflowVersion(workflowVersionId);
    }

    const result = {
      name: formCase.name,
      registryName: formCase.registryName,
      workflowId,
      workflowVersionId,
      formStepId: formStep.id,
      workflowRunId,
    };

    results.push(result);
    console.log(JSON.stringify(result));
  }

  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify(results, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
