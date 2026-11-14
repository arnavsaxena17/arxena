import {
  findUnipileV2AccountId,
  isUnipileV2AccountId,
} from '../unipile-v2-account-id.util';

describe('unipile-v2-account-id.util', () => {
  it('detects Unipile v2 account ids', () => {
    expect(isUnipileV2AccountId('acc_01abc')).toBe(true);
    expect(isUnipileV2AccountId('tcUOzQ5hT9ycSvHIHQx0JA')).toBe(false);
  });

  it('maps a v1 account id via metadata.v1_account_id', () => {
    expect(
      findUnipileV2AccountId(
        [
          {
            id: 'acc_v2',
            metadata: { v1_account_id: 'tcUOzQ5hT9ycSvHIHQx0JA' },
          },
        ],
        'tcUOzQ5hT9ycSvHIHQx0JA',
      ),
    ).toBe('acc_v2');
  });

  it('returns a v2 id unchanged when already present', () => {
    expect(
      findUnipileV2AccountId(
        [{ id: 'acc_v2', metadata: { v1_account_id: 'v1-id' } }],
        'acc_v2',
      ),
    ).toBe('acc_v2');
  });
});
