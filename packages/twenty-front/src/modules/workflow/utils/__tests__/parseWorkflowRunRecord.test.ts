import { parseWorkflowRunRecord } from '../parseWorkflowRunRecord';

const buildWorkflowRunRecord = (
  overrides: Record<string, unknown> = {},
) => ({
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
      steps: [],
    },
    stepInfos: {
      trigger: { status: 'SUCCESS' },
    },
  },
  ...overrides,
});

describe('parseWorkflowRunRecord', () => {
  it('should parse a valid workflow run', () => {
    const result = parseWorkflowRunRecord(buildWorkflowRunRecord());

    expect(result?.id).toBe('75702b0c-d928-4d81-b172-371e7c4924c8');
    expect(result?.workflowVersionId).toBe(
      '226f4b67-70c5-4bcf-8d51-f23f0136d29d',
    );
  });

  it('should parse a run whose workflow version was deleted', () => {
    const result = parseWorkflowRunRecord(
      buildWorkflowRunRecord({
        workflowVersionId: null,
        name: null,
      }),
    );

    expect(result?.id).toBe('75702b0c-d928-4d81-b172-371e7c4924c8');
    expect(result?.workflowVersionId).toBeNull();
  });

  it('should recover workflowVersionId from the nested relation', () => {
    const result = parseWorkflowRunRecord(
      buildWorkflowRunRecord({
        workflowVersionId: null,
        workflowVersion: {
          id: '226f4b67-70c5-4bcf-8d51-f23f0136d29d',
        },
      }),
    );

    expect(result?.workflowVersionId).toBe(
      '226f4b67-70c5-4bcf-8d51-f23f0136d29d',
    );
  });

  it('should return undefined instead of throwing when the record is invalid', () => {
    expect(
      parseWorkflowRunRecord({ __typename: 'WorkflowRun' }),
    ).toBeUndefined();
  });
});
