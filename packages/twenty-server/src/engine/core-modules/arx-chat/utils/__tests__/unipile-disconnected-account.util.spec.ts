import {
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

  it('parses account_id from Unipile endpoint query strings', () => {
    expect(
      parseAccountIdFromUnipileEndpoint(
        '/api/v1/users/me?account_id=mCsj-991SfuHRKVcCuSwuA',
      ),
    ).toBe('mCsj-991SfuHRKVcCuSwuA');
  });
});
