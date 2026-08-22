import { Injectable, Logger } from '@nestjs/common';

import { parseWorkspaceMemberLinkedinProfile } from 'twenty-shared';

import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

import type {
  PeopleDataSourceAlias,
  PeopleResolvedDataSourceAlias,
} from '../constants/people-data-source-aliases';

export type ResolvePeopleSearchDataSourceInput = {
  dataSource?: PeopleDataSourceAlias;
  accountId?: string;
  apiToken?: string;
  workspaceId?: string;
};

export type ResolvedPeopleSearchDataSource = {
  dataSource: PeopleResolvedDataSourceAlias;
  accountId?: string;
};

const isUnresolvedPeopleDataSource = (
  dataSource?: PeopleDataSourceAlias,
): boolean => !dataSource || dataSource === 'auto';

const hasSalesNavigatorSeat = (linkedinProfile: unknown): boolean => {
  const stored = parseWorkspaceMemberLinkedinProfile(linkedinProfile);

  return stored?.me?.sales_navigator != null;
};

@Injectable()
export class PeopleSearchDataSourceResolver {
  private readonly logger = new Logger(PeopleSearchDataSourceResolver.name);

  constructor(private readonly workspaceQueryService: WorkspaceQueryService) {}

  async resolve(
    input: ResolvePeopleSearchDataSourceInput,
  ): Promise<ResolvedPeopleSearchDataSource> {
    const explicitAccountId = input.accountId?.trim() || undefined;

    if (!isUnresolvedPeopleDataSource(input.dataSource)) {
      return {
        dataSource: input.dataSource as PeopleResolvedDataSourceAlias,
        accountId: explicitAccountId,
      };
    }

    if (explicitAccountId) {
      this.logger.log(
        'People API dataSource auto/omitted using explicit accountId as unipile',
      );

      return { dataSource: 'unipile', accountId: explicitAccountId };
    }

    const resolvedFromWorkspace = await this.resolveFromWorkspace(
      input.apiToken,
      input.workspaceId,
    );
    if (resolvedFromWorkspace) {
      return resolvedFromWorkspace;
    }

    this.logger.log(
      'People API dataSource auto/omitted falling back to index (no LinkedIn Unipile account)',
    );

    return { dataSource: 'index' };
  }

  private async resolveFromWorkspace(
    apiToken?: string,
    workspaceId?: string,
  ): Promise<ResolvedPeopleSearchDataSource | null> {
    const providedWorkspaceId = workspaceId?.trim() || undefined;
    let resolvedWorkspaceId = providedWorkspaceId;
    let workspaceMemberId: string | null = null;

    // GTM native actions already have workspaceId. Do not validate a minted
    // system JWT as an API key — JwtAuthStrategy treats missing jti as revoked.
    if (!providedWorkspaceId) {
      const token = apiToken?.trim();
      if (token) {
        try {
          resolvedWorkspaceId =
            await this.workspaceQueryService.getWorkspaceIdFromToken(token);
          workspaceMemberId =
            await this.workspaceQueryService.getWorkspaceMemberIdFromToken(
              token,
            );
        } catch (error) {
          this.logger.warn(
            `People API dataSource resolve: workspace id from token failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    }

    if (!resolvedWorkspaceId) {
      return null;
    }

    if (workspaceMemberId) {
      const memberAccountId =
        await this.workspaceQueryService.getWorkspaceMemberLinkedinUnipileAccountId(
          resolvedWorkspaceId,
          workspaceMemberId,
        );

      if (memberAccountId) {
        this.logger.log(
          `People API dataSource auto/omitted using member ${workspaceMemberId} unipile ${memberAccountId}`,
        );

        return { dataSource: 'unipile', accountId: memberAccountId };
      }
    }

    const workspaceAccount = await this.resolveWorkspaceUnipileAccount(
      resolvedWorkspaceId,
    );
    if (workspaceAccount) {
      this.logger.log(
        `People API dataSource auto/omitted using workspace ${workspaceAccount.kind} member ${workspaceAccount.workspaceMemberId} unipile ${workspaceAccount.accountId}`,
      );

      return {
        dataSource: 'unipile',
        accountId: workspaceAccount.accountId,
      };
    }

    this.logger.log(
      `People API dataSource auto/omitted no workspace Unipile account workspaceId=${resolvedWorkspaceId}`,
    );

    return null;
  }

  private async resolveWorkspaceUnipileAccount(
    workspaceId: string,
  ): Promise<{
    workspaceMemberId: string;
    accountId: string;
    kind: 'sales_navigator' | 'classic';
  } | null> {
    const profiles =
      await this.workspaceQueryService.listWorkspaceMemberLinkedinUnipileProfiles(
        workspaceId,
      );

    const withSalesNavigator = profiles.find((profile) =>
      hasSalesNavigatorSeat(profile.linkedinProfile),
    );

    if (withSalesNavigator) {
      return {
        workspaceMemberId: withSalesNavigator.workspaceMemberId,
        accountId: withSalesNavigator.linkedinUnipileAccountId,
        kind: 'sales_navigator',
      };
    }

    const withUnipile = profiles.find((profile) =>
      Boolean(profile.linkedinUnipileAccountId?.trim()),
    );

    if (withUnipile) {
      return {
        workspaceMemberId: withUnipile.workspaceMemberId,
        accountId: withUnipile.linkedinUnipileAccountId,
        kind: 'classic',
      };
    }

    return null;
  }
}
