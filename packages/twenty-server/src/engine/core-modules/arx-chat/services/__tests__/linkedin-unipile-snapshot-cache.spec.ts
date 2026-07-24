import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import {
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

    const service = new LinkedinUnipileRequestService(
      { getWorkspaceKeys: jest.fn() } as never,
    );
    jest.spyOn(service, 'makeUnipileRequest').mockImplementation(makeUnipileRequest);
    jest.spyOn(service, 'ensureLinkedinSnapshotFresh').mockResolvedValue(undefined);

    const profile = await service.fetchLinkedinOwnerProfile('acc-1');

    expect(profile?.public_identifier).toBe('alice');
    expect(getSnapshotOwnerProfile('acc-1')?.public_identifier).toBe('alice');
    expect(makeUnipileRequest).not.toHaveBeenCalled();
    console.log('owner profile snapshot hit test: success', profile);
  });
});
