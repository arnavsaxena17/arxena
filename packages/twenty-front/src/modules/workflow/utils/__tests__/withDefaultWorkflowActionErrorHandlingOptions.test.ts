import { withDefaultWorkflowActionErrorHandlingOptions } from '../withDefaultWorkflowActionErrorHandlingOptions';

describe('withDefaultWorkflowActionErrorHandlingOptions', () => {
  it('fills missing errorHandlingOptions on flow steps', () => {
    const result = withDefaultWorkflowActionErrorHandlingOptions({
      state: {
        flow: {
          steps: [
            {
              name: 'Fetch LinkedIn profile',
              settings: {
                input: {},
                outputSchema: {},
              },
            },
          ],
        },
      },
    });

    expect(result).toMatchObject({
      state: {
        flow: {
          steps: [
            {
              settings: {
                errorHandlingOptions: {
                  retryOnFailure: { value: false },
                  continueOnFailure: { value: false },
                },
              },
            },
          ],
        },
      },
    });
  });
});
