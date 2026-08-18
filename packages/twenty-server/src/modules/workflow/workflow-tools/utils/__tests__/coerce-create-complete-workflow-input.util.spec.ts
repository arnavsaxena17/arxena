import { coerceCreateCompleteWorkflowInput } from 'src/modules/workflow/workflow-tools/utils/coerce-create-complete-workflow-input.util';

describe('coerceCreateCompleteWorkflowInput', () => {
  it('maps from/to edges to source/target', () => {
    const coerced = coerceCreateCompleteWorkflowInput({
      name: 'wf',
      edges: [{ from: 'trigger', to: '5dca0d7a-cc73-4a24-821a-1bb4dc5150b5' }],
    }) as { edges: Array<{ source: string; target: string }> };

    expect(coerced.edges[0]).toMatchObject({
      source: 'trigger',
      target: '5dca0d7a-cc73-4a24-821a-1bb4dc5150b5',
    });
  });

  it('builds DATABASE_EVENT eventName from objectNameSingular + eventType', () => {
    const coerced = coerceCreateCompleteWorkflowInput({
      trigger: {
        type: 'DATABASE_EVENT',
        settings: {
          eventType: 'CREATED',
          objectNameSingular: 'company',
        },
      },
    }) as { trigger: { settings: { eventName: string } } };

    expect(coerced.trigger.settings.eventName).toBe('company.created');
  });

  it('nests flattened LOGIC_FUNCTION inputs under logicFunctionInput', () => {
    const coerced = coerceCreateCompleteWorkflowInput({
      steps: [
        {
          type: 'LOGIC_FUNCTION',
          settings: {
            input: {
              logicFunctionId: '5b0036de-b4ce-5b29-b3b5-63c0530ef8d1',
              companyId: '{{trigger.properties.after.id}}',
              icpSpec: '{{trigger.project.icpSpec}}',
            },
          },
        },
      ],
    }) as {
      steps: Array<{
        settings: {
          input: {
            logicFunctionId: string;
            logicFunctionInput: Record<string, string>;
          };
        };
      }>;
    };

    expect(coerced.steps[0].settings.input).toEqual({
      logicFunctionId: '5b0036de-b4ce-5b29-b3b5-63c0530ef8d1',
      logicFunctionInput: {
        companyId: '{{trigger.properties.after.id}}',
        icpSpec: '{{trigger.project.icpSpec}}',
      },
    });
  });

  it('normalizes errorHandlingOptions flags', () => {
    const coerced = coerceCreateCompleteWorkflowInput({
      steps: [
        {
          type: 'LOGIC_FUNCTION',
          settings: {
            input: { logicFunctionId: 'id' },
            errorHandlingOptions: {
              retryOnFailure: { maxRetries: 0 },
              continueOnFailure: { enabled: false },
            },
          },
        },
      ],
    }) as {
      steps: Array<{
        settings: {
          errorHandlingOptions: {
            retryOnFailure: { value: boolean };
            continueOnFailure: { value: boolean };
          };
        };
      }>;
    };

    expect(coerced.steps[0].settings.errorHandlingOptions).toEqual({
      retryOnFailure: { value: false },
      continueOnFailure: { value: false },
    });
  });
});
