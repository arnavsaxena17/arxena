import {
    getSnapshotLinkedinAccounts,
    getSnapshotOwnerProfile,
    getSnapshotRawAccountById,
    getUnipileLinkedinSnapshot,
    invalidateUnipileLinkedinSnapshotCache,
    removeSnapshotAccountById,
    setUnipileLinkedinSnapshot,
    UNIPILE_LINKEDIN_SNAPSHOT_TTL_MS,
} from '../unipile-linkedin-snapshot.cache';

describe('unipile-linkedin-snapshot.cache', () => {
  beforeEach(() => {
    invalidateUnipileLinkedinSnapshotCache();
  });

  it('stores and reads linkedin accounts and owner profiles until expiry', () => {
    console.log('snapshot cache store/read test: start');
    const expiresAt = Date.now() + UNIPILE_LINKEDIN_SNAPSHOT_TTL_MS;

    setUnipileLinkedinSnapshot({
      rawAccountsList: {
        items: [{ id: 'acc-1', type: 'LINKEDIN', status: 'connected' }],
      },
      linkedinAccounts: [
        {
          id: 'acc-1',
          username: 'alice',
          name: 'Alice',
          type: 'LINKEDIN',
          status: 'connected',
          provider: 'LINKEDIN',
        },
      ],
      ownerProfilesByAccountId: new Map([
        ['acc-1', { sales_navigator: {}, public_identifier: 'alice' }],
      ]),
      expiresAt,
    });

    expect(getSnapshotLinkedinAccounts()).toHaveLength(1);
    expect(getSnapshotRawAccountById('acc-1')?.id).toBe('acc-1');
    expect(getSnapshotOwnerProfile('acc-1')?.public_identifier).toBe('alice');
    expect(getUnipileLinkedinSnapshot()?.expiresAt).toBe(expiresAt);
    console.log('snapshot cache store/read test: success');
  });

  it('invalidateUnipileLinkedinSnapshotCache clears snapshot reads', () => {
    console.log('snapshot cache invalidate test: start');
    setUnipileLinkedinSnapshot({
      rawAccountsList: { items: [{ id: 'acc-1', type: 'LINKEDIN' }] },
      linkedinAccounts: [],
      ownerProfilesByAccountId: new Map(),
    });

    invalidateUnipileLinkedinSnapshotCache();

    expect(getUnipileLinkedinSnapshot()).toBeNull();
    expect(getSnapshotLinkedinAccounts()).toBeNull();
    console.log('snapshot cache invalidate test: success');
  });

  it('removeSnapshotAccountById removes one account without clearing the whole snapshot', () => {
    console.log('snapshot cache remove account test: start');
    setUnipileLinkedinSnapshot({
      rawAccountsList: {
        items: [
          { id: 'acc-1', type: 'LINKEDIN' },
          { id: 'acc-2', type: 'LINKEDIN' },
        ],
      },
      linkedinAccounts: [
        {
          id: 'acc-1',
          username: 'alice',
          name: 'Alice',
          status: 'connected',
          provider: 'LINKEDIN',
        },
        {
          id: 'acc-2',
          username: 'bob',
          name: 'Bob',
          status: 'connected',
          provider: 'LINKEDIN',
        },
      ],
      ownerProfilesByAccountId: new Map([
        ['acc-1', { public_identifier: 'alice' }],
        ['acc-2', { public_identifier: 'bob' }],
      ]),
    });

    expect(removeSnapshotAccountById('acc-1')).toBe(true);
    expect(getSnapshotRawAccountById('acc-1')).toBeNull();
    expect(getSnapshotRawAccountById('acc-2')?.id).toBe('acc-2');
    expect(getSnapshotOwnerProfile('acc-1')).toBeUndefined();
    expect(getSnapshotOwnerProfile('acc-2')?.public_identifier).toBe('bob');
    expect(getSnapshotLinkedinAccounts()).toHaveLength(1);
    console.log('snapshot cache remove account test: success');
  });
});
