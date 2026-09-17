import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import {
  getSnapshotLinkedinAccounts,
  getSnapshotOwnerProfile,
  invalidateUnipileLinkedinSnapshotCache,
  setUnipileLinkedinSnapshot,
} from 'src/engine/core-modules/arx-chat/utils/unipile-linkedin-snapshot.cache';

describe('LinkedinUnipileRequestService snapshot reads', () => {
  beforeEach(() => {
    invalidateUnipileLinkedinSnapshotCache();
  });

  it('fetchLinkedinOwnerProfile serves /users/me data from server snapshot without Unipile call', async () => {
    console.log('owner profile snapshot hit test: start');
    const makeUnipileRequest = jest.fn();

    setUnipileLinkedinSnapshot({
      rawAccountsList: { items: [{ id: 'acc-1', type: 'LINKEDIN' }] },
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
        [
          'acc-1',
          {
            public_identifier: 'alice',
            sales_navigator: {},
          },
        ],
      ]),
    });

    const service = new LinkedinUnipileRequestService({
      getWorkspaceKeys: jest.fn(),
    } as never);
    jest
      .spyOn(service, 'makeUnipileRequest')
      .mockImplementation(makeUnipileRequest);
    jest
      .spyOn(service, 'ensureLinkedinSnapshotFresh')
      .mockResolvedValue(undefined);

    const profile = await service.fetchLinkedinOwnerProfile('acc-1');

    expect(profile?.public_identifier).toBe('alice');
    expect(getSnapshotOwnerProfile('acc-1')?.public_identifier).toBe('alice');
    expect(makeUnipileRequest).not.toHaveBeenCalled();
    console.log('owner profile snapshot hit test: success', profile);
  });

  it('getAllAccounts live-fetches member Unipile id when snapshot list omits it', async () => {
    setUnipileLinkedinSnapshot({
      rawAccountsList: {
        items: [
          { id: 'other-acc', type: 'LINKEDIN', sources: [{ status: 'OK' }] },
        ],
      },
      linkedinAccounts: [
        {
          id: 'other-acc',
          username: 'Other',
          name: 'Other',
          type: 'LINKEDIN',
          status: 'connected',
          provider: 'LINKEDIN',
        },
      ],
      ownerProfilesByAccountId: new Map(),
    });

    const memberAccountId = '2AyK5VUeRq6O-17RdIGH-A';
    const service = new LinkedinUnipileRequestService({
      getWorkspaceKeys: jest.fn().mockResolvedValue({}),
    } as never);

    jest
      .spyOn(service, 'ensureLinkedinSnapshotFresh')
      .mockResolvedValue(undefined);
    jest.spyOn(service, 'fetchAccountByIdIfExists').mockResolvedValue({
      id: memberAccountId,
      name: 'Naresh Lahoti',
      type: 'LINKEDIN',
      sources: [{ status: 'OK' }],
      connection_params: {
        im: { publicIdentifier: 'naresh-lahoti-0b774821' },
      },
    });

    const result = await service.getAllAccounts(
      { id: 'workspace-1' } as never,
      {
        memberLinkedinUnipileAccountId: memberAccountId,
      },
    );

    expect(service.fetchAccountByIdIfExists).toHaveBeenCalledWith(
      memberAccountId,
      { bypassSnapshot: true },
    );
    expect(result.accounts.map((account) => account.id)).toEqual(
      expect.arrayContaining(['other-acc', memberAccountId]),
    );
    expect(
      getSnapshotLinkedinAccounts()?.some(
        (account) => account.id === memberAccountId,
      ),
    ).toBe(true);
  });
});
