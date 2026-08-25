import { AxiosError } from 'axios';

import { getUnipileToolErrorMessage } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/unipile-messaging-tool.util';

describe('getUnipileToolErrorMessage', () => {
  it('prefers Unipile title, detail, and type over the Axios status message', () => {
    const error = new AxiosError(
      'Request failed with status code 422',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: {},
        config: {} as AxiosError['config'],
        data: {
          status: 422,
          type: 'errors/already_invited_recently',
          title: 'Should delay new invitation to this recipient',
          detail:
            'An invitation has already been sent recently to this recipient. Please try again later.',
        },
      },
    );

    expect(getUnipileToolErrorMessage(error)).toBe(
      'Should delay new invitation to this recipient. An invitation has already been sent recently to this recipient. Please try again later. (errors/already_invited_recently)',
    );
  });

  it('falls back to the Error message when Unipile does not return a body', () => {
    expect(
      getUnipileToolErrorMessage(
        new AxiosError('Request failed with status code 422'),
      ),
    ).toBe('Request failed with status code 422');
  });

  it('falls back to a generic message for unknown errors', () => {
    expect(getUnipileToolErrorMessage({})).toBe(
      'Unipile messaging request failed',
    );
  });
});
