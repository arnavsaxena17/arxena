import { PeopleSearchDataSourceResolver } from '../people-search-data-source.resolver';

describe('PeopleSearchDataSourceResolver', () => {
  const workspaceQueryService = {
    getWorkspaceIdFromToken: jest.fn(),
    getWorkspaceMemberIdFromToken: jest.fn(),
    getWorkspaceMemberLinkedinUnipileAccountId: jest.fn(),
    listWorkspaceMemberLinkedinUnipileProfiles: jest.fn(),
  };

  const resolver = new PeopleSearchDataSourceResolver(
    workspaceQueryService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes through an explicit catalog dataSource', async () => {
    await expect(
      resolver.resolve({ dataSource: 'apollo', accountId: 'acct-1' }),
    ).resolves.toEqual({
      dataSource: 'apollo',
      accountId: 'acct-1',
    });
    expect(workspaceQueryService.getWorkspaceIdFromToken).not.toHaveBeenCalled();
  });

  it('uses an explicit accountId as unipile when dataSource is omitted', async () => {
    await expect(
      resolver.resolve({ accountId: 'acct-explicit' }),
    ).resolves.toEqual({
      dataSource: 'unipile',
      accountId: 'acct-explicit',
    });
  });

  it('uses the token workspace member Unipile account when present', async () => {
    workspaceQueryService.getWorkspaceIdFromToken.mockResolvedValue('ws-1');
    workspaceQueryService.getWorkspaceMemberIdFromToken.mockResolvedValue(
      'member-1',
    );
    workspaceQueryService.getWorkspaceMemberLinkedinUnipileAccountId.mockResolvedValue(
      'unipile-member',
    );

    await expect(
      resolver.resolve({ dataSource: 'auto', apiToken: 'token' }),
    ).resolves.toEqual({
      dataSource: 'unipile',
      accountId: 'unipile-member',
    });
    expect(
      workspaceQueryService.listWorkspaceMemberLinkedinUnipileProfiles,
    ).not.toHaveBeenCalled();
  });

  it('for API keys without a member, uses a workspace Sales Navigator Unipile account', async () => {
    workspaceQueryService.getWorkspaceIdFromToken.mockResolvedValue('ws-1');
    workspaceQueryService.getWorkspaceMemberIdFromToken.mockResolvedValue(null);
    workspaceQueryService.listWorkspaceMemberLinkedinUnipileProfiles.mockResolvedValue(
      [
        {
          workspaceMemberId: 'classic-member',
          linkedinUnipileAccountId: 'classic-acct',
          linkedinProfile: { me: { public_identifier: 'classic' } },
        },
        {
          workspaceMemberId: 'sn-member',
          linkedinUnipileAccountId: 'sn-acct',
          linkedinProfile: {
            me: {
              public_identifier: 'sn',
              sales_navigator: { contract_id: '1', owner_seat_id: '2' },
            },
          },
        },
      ],
    );

    await expect(resolver.resolve({ apiToken: 'api-key' })).resolves.toEqual({
      dataSource: 'unipile',
      accountId: 'sn-acct',
    });
  });

  it('falls back to index when no member or Sales Navigator Unipile account exists', async () => {
    workspaceQueryService.getWorkspaceIdFromToken.mockResolvedValue('ws-1');
    workspaceQueryService.getWorkspaceMemberIdFromToken.mockResolvedValue(null);
    workspaceQueryService.listWorkspaceMemberLinkedinUnipileProfiles.mockResolvedValue(
      [
        {
          workspaceMemberId: 'classic-member',
          linkedinUnipileAccountId: 'classic-acct',
          linkedinProfile: { me: { public_identifier: 'classic' } },
        },
      ],
    );

    await expect(resolver.resolve({ apiToken: 'api-key' })).resolves.toEqual({
      dataSource: 'index',
    });
  });
});
