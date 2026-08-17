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
  ): Promise<ResolvedPeopleSearchDataSource | null> {
    const token = apiToken?.trim();
    if (!token) {
      return null;
    }

    let workspaceId: string | undefined;
    try {
      workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(
        token,
      );
    } catch (error) {
      this.logger.warn(
        `People API dataSource resolve: workspace id from token failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    }

    if (!workspaceId) {
      return null;
    }

    const workspaceMemberId =
      await this.workspaceQueryService.getWorkspaceMemberIdFromToken(token);

    if (workspaceMemberId) {
      const memberAccountId =
        await this.workspaceQueryService.getWorkspaceMemberLinkedinUnipileAccountId(
          workspaceId,
          workspaceMemberId,
        );

      if (memberAccountId) {
        this.logger.log(
          `People API dataSource auto/omitted using member ${workspaceMemberId} unipile ${memberAccountId}`,
        );

        return { dataSource: 'unipile', accountId: memberAccountId };
      }
    }

    const workspaceAccount = await this.resolveWorkspaceSalesNavigatorAccount(
      workspaceId,
    );
    if (workspaceAccount) {
      this.logger.log(
        `People API dataSource auto/omitted using workspace Sales Navigator member ${workspaceAccount.workspaceMemberId} unipile ${workspaceAccount.accountId}`,
      );

      return {
        dataSource: 'unipile',
        accountId: workspaceAccount.accountId,
      };
    }

    return null;
  }

  private async resolveWorkspaceSalesNavigatorAccount(
    workspaceId: string,
  ): Promise<{ workspaceMemberId: string; accountId: string } | null> {
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
      };
    }

    return null;
  }
}
