import { HttpException, HttpStatus } from '@nestjs/common';

import { LinkedinUnipileEstimateAccountMode } from '../enums/linkedin-unipile-estimate-account-mode.enum';
import { UnipileLinkedinAccountUnusableError } from '../errors/unipile-linkedin-account-unusable.error';
import { LinkedinUnipileEstimateAccountService } from './linkedin-unipile-estimate-account.service';

jest.mock('../utils/unipile-accounts-list.cache', () => ({
  invalidateUnipileAccountsListCache: jest.fn(),
}));

import { invalidateUnipileAccountsListCache } from '../utils/unipile-accounts-list.cache';

describe('LinkedinUnipileEstimateAccountService', () => {
  const apiToken = 'auth-token';
  const clientAccountId = 'client-account';
  const envAccountId = 'env-account';
  const poolAccountA = 'pool-sn-a';
  const poolAccountB = 'pool-sn-b';

  const createService = (
    mode: LinkedinUnipileEstimateAccountMode,
    options?: { outreachMode?: LinkedinUnipileEstimateAccountMode },
  ) => {
    const environmentService = {
      get: jest.fn((key: string) => {
        if (key === 'LINKEDIN_UNIPILE_ESTIMATE_ACCOUNT_MODE') {
          return mode;
        }
        if (key === 'LINKEDIN_UNIPILE_OUTREACH_ACCOUNT_MODE') {
          return options?.outreachMode ?? mode;
        }
        return undefined;
      }),
    };

    const linkedinUnipileSessionService = {
      withLinkedinSession: jest.fn(
        async (
          _token: string,
          accountId: string | undefined,
          run: (session: { accountId: string }) => Promise<unknown>,
        ) => run({ accountId: accountId ?? 'resolved-session-account' }),
      ),
    };

    const linkedinUnipileRequestService = {
      listAllLinkedinAccountsFromUnipileApi: jest.fn().mockResolvedValue({
        accounts: [
          { id: poolAccountA, status: 'connected' },
          { id: poolAccountB, status: 'connected' },
          { id: 'classic-only', status: 'connected' },
          { id: 'disconnected', status: 'disconnected' },
        ],
      }),
      inferLinkedinSearchTypeForAccount: jest.fn(async (accountId: string) => {
        if (accountId === poolAccountA || accountId === poolAccountB) {
          return {
            inferredSearchType: 'sales_navigator',
            salesNavigatorAvailable: true,
            recruiterAvailable: false,
          };
        }
        return {
          inferredSearchType: 'classic',
          salesNavigatorAvailable: false,
          recruiterAvailable: false,
        };
      }),
    };

    const service = new LinkedinUnipileEstimateAccountService(
      environmentService as never,
      linkedinUnipileSessionService as never,
      linkedinUnipileRequestService as never,
    );

    return {
      service,
      linkedinUnipileSessionService,
      linkedinUnipileRequestService,
    };
  };

  afterEach(() => {
    delete process.env.UNIPILE_LINKEDIN_ACCOUNT_ID;
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('session mode forwards the client account id', async () => {
    console.log('LinkedinUnipileEstimateAccountService: session mode');
    const { service, linkedinUnipileSessionService } = createService(
      LinkedinUnipileEstimateAccountMode.Session,
    );

    const result = await service.withEstimateLinkedinSession(
      apiToken,
      clientAccountId,
      async (session) => session.accountId,
    );

    expect(result).toBe(clientAccountId);
    expect(linkedinUnipileSessionService.withLinkedinSession).toHaveBeenCalledWith(
      apiToken,
      clientAccountId,
      expect.any(Function),
    );
  });

  it('env_account_id mode uses UNIPILE_LINKEDIN_ACCOUNT_ID', async () => {
    console.log('LinkedinUnipileEstimateAccountService: env account mode');
    process.env.UNIPILE_LINKEDIN_ACCOUNT_ID = envAccountId;
    const { service, linkedinUnipileSessionService } = createService(
      LinkedinUnipileEstimateAccountMode.EnvAccountId,
    );

    const result = await service.withEstimateLinkedinSession(
      apiToken,
      clientAccountId,
      async (session) => session.accountId,
    );

    expect(result).toBe(envAccountId);
    expect(linkedinUnipileSessionService.withLinkedinSession).toHaveBeenCalledWith(
      apiToken,
      envAccountId,
      expect.any(Function),
    );
  });

  it('shared_sales_navigator_pool mode picks a cached Sales Navigator account', async () => {
    console.log('LinkedinUnipileEstimateAccountService: pool cache');
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const { service, linkedinUnipileSessionService, linkedinUnipileRequestService } =
      createService(LinkedinUnipileEstimateAccountMode.SharedSalesNavigatorPool);

    const first = await service.withEstimateLinkedinSession(
      apiToken,
      clientAccountId,
      async (session) => session.accountId,
    );
    const second = await service.withEstimateLinkedinSession(
      apiToken,
      clientAccountId,
      async (session) => session.accountId,
    );

    expect([poolAccountA, poolAccountB]).toContain(first);
    expect(second).toBe(first);
    expect(
      linkedinUnipileRequestService.listAllLinkedinAccountsFromUnipileApi,
    ).toHaveBeenCalledTimes(1);
    expect(linkedinUnipileSessionService.withLinkedinSession).toHaveBeenCalledWith(
      apiToken,
      first,
      expect.any(Function),
    );
  });

  it('retries with another pool account when the first account is unusable', async () => {
    console.log('LinkedinUnipileEstimateAccountService: pool retry success');
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const { service, linkedinUnipileSessionService } = createService(
      LinkedinUnipileEstimateAccountMode.SharedSalesNavigatorPool,
    );

    const unusableError = new UnipileLinkedinAccountUnusableError('dead account', {
      accountId: poolAccountA,
    });

    linkedinUnipileSessionService.withLinkedinSession = jest.fn(
      async (
        _token: string,
        accountId: string | undefined,
        run: (session: { accountId: string }) => Promise<unknown>,
      ) => {
        if (accountId === poolAccountA) {
          throw unusableError;
        }
        return run({ accountId: accountId ?? 'missing' });
      },
    );

    const result = await service.withEstimateLinkedinSession(
      apiToken,
      clientAccountId,
      async (session) => session.accountId,
    );

    expect(result).toBe(poolAccountB);
    expect(linkedinUnipileSessionService.withLinkedinSession).toHaveBeenCalledTimes(2);
    expect(invalidateUnipileAccountsListCache).toHaveBeenCalled();
    console.log('LinkedinUnipileEstimateAccountService: pool retry success account', result);
  });

  it('does not retry pool accounts for non-account failures', async () => {
    console.log('LinkedinUnipileEstimateAccountService: no retry on business error');
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const { service, linkedinUnipileSessionService } = createService(
      LinkedinUnipileEstimateAccountMode.SharedSalesNavigatorPool,
    );

    linkedinUnipileSessionService.withLinkedinSession = jest.fn(
      async (
        _token: string,
        _accountId: string | undefined,
        _run: (session: { accountId: string }) => Promise<unknown>,
      ) => {
        throw new Error('LLM timeout');
      },
    );

    await expect(
      service.withEstimateLinkedinSession(apiToken, clientAccountId, async () => 'ok'),
    ).rejects.toThrow('LLM timeout');

    expect(linkedinUnipileSessionService.withLinkedinSession).toHaveBeenCalledTimes(1);
  });

  it('throws when all pool accounts are unusable', async () => {
    console.log('LinkedinUnipileEstimateAccountService: pool exhausted');
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const { service, linkedinUnipileSessionService } = createService(
      LinkedinUnipileEstimateAccountMode.SharedSalesNavigatorPool,
    );

    linkedinUnipileSessionService.withLinkedinSession = jest.fn(
      async (
        _token: string,
        _accountId: string | undefined,
        _run: (session: { accountId: string }) => Promise<unknown>,
      ) => {
        throw new HttpException(
          { type: 'errors/disconnected_account' },
          HttpStatus.UNAUTHORIZED,
        );
      },
    );

    await expect(
      service.withEstimateLinkedinSession(apiToken, clientAccountId, async () => 'ok'),
    ).rejects.toThrow(
      'All shared Sales Navigator pool LinkedIn Unipile accounts failed or are unavailable',
    );

    expect(linkedinUnipileSessionService.withLinkedinSession).toHaveBeenCalledTimes(2);
  });

  it('resolveOutreachAccountId uses outreach account mode env', async () => {
    console.log('LinkedinUnipileEstimateAccountService: resolveOutreachAccountId');
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const { service } = createService(
      LinkedinUnipileEstimateAccountMode.Session,
      {
        outreachMode: LinkedinUnipileEstimateAccountMode.SharedSalesNavigatorPool,
      },
    );

    const accountId = await service.resolveOutreachAccountId(clientAccountId);

    expect([poolAccountA, poolAccountB]).toContain(accountId);
  });

  it('withOutreachLinkedinSession uses outreach account mode', async () => {
    console.log('LinkedinUnipileEstimateAccountService: withOutreachLinkedinSession');
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const { service, linkedinUnipileSessionService } = createService(
      LinkedinUnipileEstimateAccountMode.Session,
      {
        outreachMode: LinkedinUnipileEstimateAccountMode.SharedSalesNavigatorPool,
      },
    );

    const result = await service.withOutreachLinkedinSession(
      apiToken,
      clientAccountId,
      async (session) => session.accountId,
    );

    expect([poolAccountA, poolAccountB]).toContain(result);
    expect(linkedinUnipileSessionService.withLinkedinSession).toHaveBeenCalled();
  });
});
