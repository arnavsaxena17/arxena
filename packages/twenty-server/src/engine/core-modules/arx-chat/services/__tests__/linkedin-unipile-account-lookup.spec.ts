import { LinkedinUnipileRequestService } from '../linkedin-unipile-request.service';
import {
  invalidateUnipileLinkedinSnapshotCache,
  setUnipileLinkedinSnapshot,
  UNIPILE_LINKEDIN_SNAPSHOT_TTL_MS,
} from '../../utils/unipile-linkedin-snapshot.cache';
import { invalidateUnipileAccountsListCache } from '../../utils/unipile-accounts-list.cache';

describe('LinkedinUnipileRequestService lookupAccountById', () => {
  const accountId = 'BD4e0PSwT6eA5PMo_1KB0w';
  let service: LinkedinUnipileRequestService;

  const jsonResponse = (status: number, body: unknown) =>
    ({
      status,
      ok: status >= 200 && status < 300,
      statusText: status === 404 ? 'Not Found' : status === 503 ? 'Service Unavailable' : 'OK',
      json: async () => body,
    }) as Response;

  beforeEach(() => {
    jest.restoreAllMocks();
    invalidateUnipileLinkedinSnapshotCache();
    invalidateUnipileAccountsListCache();
    service = new LinkedinUnipileRequestService(
      {} as never,
      undefined,
      undefined,
      undefined,
    );
  });

  it('returns a snapshot hit without calling Unipile', async () => {
    setUnipileLinkedinSnapshot({
      rawAccountsList: {
        items: [{ id: accountId, type: 'LINKEDIN', status: 'OK' }],
      },
      linkedinAccounts: [],
      ownerProfilesByAccountId: new Map(),
      expiresAt: Date.now() + UNIPILE_LINKEDIN_SNAPSHOT_TTL_MS,
    });
    const fetchSpy = jest.spyOn(global, 'fetch');
    const listSpy = jest.spyOn(service, 'makeUnipileRequest');

    await expect(service.lookupAccountById(accountId)).resolves.toEqual({
      status: 'found',
      account: expect.objectContaining({ id: accountId }),
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(listSpy).not.toHaveBeenCalled();
  });

  it('does not call GET /accounts when GET /accounts/:id succeeds', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse(200, { id: accountId, type: 'LINKEDIN', status: 'OK' }),
    );
    const listSpy = jest
      .spyOn(service, 'makeUnipileRequest')
      .mockResolvedValue({ items: [] });

    await expect(
      service.lookupAccountById(accountId, { bypassSnapshot: true }),
    ).resolves.toEqual({
      status: 'found',
      account: expect.objectContaining({ id: accountId }),
    });

    expect(listSpy).not.toHaveBeenCalled();
  });

  it('treats a live GET /accounts hit as found when GET /accounts/:id returns 404', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(jsonResponse(404, {}));
    jest.spyOn(service, 'makeUnipileRequest').mockResolvedValue({
      items: [
        { id: 'pool-acc', type: 'LINKEDIN' },
        { id: accountId, type: 'LINKEDIN', status: 'OK' },
      ],
    });

    await expect(
      service.lookupAccountById(accountId, { bypassSnapshot: true }),
    ).resolves.toEqual({
      status: 'found',
      account: expect.objectContaining({ id: accountId }),
    });
  });

  it('returns not_found only when GET /accounts/:id 404s and live GET /accounts omits the id', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(jsonResponse(404, {}));
    jest.spyOn(service, 'makeUnipileRequest').mockResolvedValue({
      items: [{ id: 'pool-acc', type: 'LINKEDIN' }],
    });

    await expect(
      service.lookupAccountById(accountId, { bypassSnapshot: true }),
    ).resolves.toEqual({ status: 'not_found' });
  });

  it('keeps the account when GET /accounts/:id fails but live GET /accounts has the id', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(jsonResponse(503, {}));
    jest.spyOn(service, 'makeUnipileRequest').mockResolvedValue({
      items: [{ id: accountId, type: 'LINKEDIN', status: 'OK' }],
    });

    await expect(
      service.lookupAccountById(accountId, { bypassSnapshot: true }),
    ).resolves.toEqual({
      status: 'found',
      account: expect.objectContaining({ id: accountId }),
    });
  });

  it('does not treat a live GET /accounts omission as missing when GET /accounts/:id is unavailable', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(jsonResponse(503, {}));
    jest.spyOn(service, 'makeUnipileRequest').mockResolvedValue({
      items: [{ id: 'pool-acc', type: 'LINKEDIN' }],
    });

    await expect(
      service.lookupAccountById(accountId, { bypassSnapshot: true }),
    ).resolves.toEqual({
      status: 'unavailable',
      reason: '503 Service Unavailable',
    });
  });
});
