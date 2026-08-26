import { DEFAULT_WORKFLOW_ACTION_ERROR_HANDLING_OPTIONS } from '../base-workflow-action-settings-schema';
import { workflowLogicFunctionActionSchema } from '../logic-function-action-schema';
import { workflowRunSchema } from '../workflow-run-schema';

const defaultErrorHandlingOptions = DEFAULT_WORKFLOW_ACTION_ERROR_HANDLING_OPTIONS;

const buildLogicFunctionStep = ({
  includeErrorHandlingOptions,
}: {
  includeErrorHandlingOptions: boolean;
}) => ({
  id: '8af4cea3-cb90-4b7c-8567-aa049e8e0f2c',
  name: 'Fetch LinkedIn profile',
  type: 'LOGIC_FUNCTION',
  valid: true,
  nextStepIds: [],
  settings: {
    input: {
      logicFunctionId: '11111111-1111-4111-8111-111111111111',
      logicFunctionInput: {},
    },
    outputSchema: {},
    ...(includeErrorHandlingOptions
      ? { errorHandlingOptions: defaultErrorHandlingOptions }
      : {}),
  },
});

describe('baseWorkflowActionSettingsSchema', () => {
  it('defaults missing errorHandlingOptions on a logic function step', () => {
    const result = workflowLogicFunctionActionSchema.safeParse(
      buildLogicFunctionStep({ includeErrorHandlingOptions: false }),
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.settings.errorHandlingOptions).toEqual(
      defaultErrorHandlingOptions,
    );
  });

  it('parses a workflow run whose first step omits errorHandlingOptions', () => {
    const result = workflowRunSchema.safeParse({
      __typename: 'WorkflowRun',
      id: '75702b0c-d928-4d81-b172-371e7c4924c8',
      workflowVersionId: '226f4b67-70c5-4bcf-8d51-f23f0136d29d',
      workflowId: '455df24c-8d01-4fb3-b01d-9c5212e2f925',
      status: 'RUNNING',
      createdAt: '2026-08-26T12:49:47.369Z',
      deletedAt: null,
      endedAt: null,
      name: '#12 - Fetch LinkedIn messages',
      state: {
        flow: {
          trigger: {
            name: 'Launch manually',
            type: 'MANUAL',
            settings: {
              objectType: 'candidate',
              outputSchema: {},
            },
          },
          steps: [buildLogicFunctionStep({ includeErrorHandlingOptions: false })],
        },
        stepInfos: {
          trigger: { status: 'SUCCESS' },
        },
      },
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(
      result.data.state?.flow.steps[0]?.settings.errorHandlingOptions,
    ).toEqual(defaultErrorHandlingOptions);
  });
});
