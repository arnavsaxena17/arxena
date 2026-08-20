import {
    isUnipileAccountNotFoundApiError,
    isUnipileDisconnectedAccountApiError,
    parseAccountIdFromUnipileEndpoint,
} from '../unipile-disconnected-account.util';

describe('unipile-disconnected-account.util', () => {
  it('detects disconnected_account 401 errors', () => {
    expect(
      isUnipileDisconnectedAccountApiError(401, {
        type: 'errors/disconnected_account',
      }),
    ).toBe(true);
    expect(isUnipileDisconnectedAccountApiError(404, { type: 'errors/not_found' })).toBe(
      false,
    );
  });

  it('detects account not found 404 errors', () => {
    expect(
      isUnipileAccountNotFoundApiError(404, {
        status: 404,
        type: 'errors/resource_not_found',
        title: 'Resource not found.',
        detail: 'The requested resource were not found.\nAccount not found',
      }),
    ).toBe(true);
    expect(
      isUnipileAccountNotFoundApiError(404, {
        title: 'Not found',
        detail: 'User profile missing',
      }),
    ).toBe(false);
  });

  it('parses account_id from Unipile v2 endpoints', () => {
    expect(
      parseAccountIdFromUnipileEndpoint(
        '/v2/acc_123/users/me',
      ),
    ).toBe('acc_123');
    expect(
      parseAccountIdFromUnipileEndpoint(
        '/v2/accounts/acc_123',
      ),
    ).toBe('acc_123');
  });
});
