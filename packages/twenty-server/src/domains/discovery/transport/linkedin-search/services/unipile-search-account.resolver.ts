import { Injectable, Logger, Optional } from '@nestjs/common';

import { LinkedinUnipileEstimateAccountService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-estimate-account.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

import {
  inferUnipileLinkedinProduct,
  type UnipileLinkedinProduct,
} from '../utils/unipile-linkedin-product.util';

export type UnipileSearchAccountVia =
  | 'explicit'
  | 'member'
  | 'workspace_sales_navigator'
  | 'pool';

export type ResolvedUnipileSearchAccount = {
  accountId: string;
  product: UnipileLinkedinProduct;
  via: UnipileSearchAccountVia;
};

@Injectable()
export class UnipileSearchAccountResolver {
  private readonly logger = new Logger(UnipileSearchAccountResolver.name);

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    @Optional()
    private readonly linkedinUnipileEstimateAccountService?: LinkedinUnipileEstimateAccountService,
  ) {}

  isUnipileConfigured(): boolean {
    return (
      !!process.env.UNIPILE_API_URL?.trim() &&
      !!process.env.UNIPILE_ACCESS_TOKEN?.trim()
    );
  }

  async resolve({
    accountId,
    apiToken,
    preferPool = true,
  }: {
    accountId?: string;
    apiToken?: string;
    preferPool?: boolean;
  }): Promise<ResolvedUnipileSearchAccount | null> {
    const explicitAccountId = accountId?.trim() || undefined;
    if (explicitAccountId) {
      const product = await this.detectProductForAccount(
        apiToken,
        explicitAccountId,
      );

      return {
        accountId: explicitAccountId,
        product,
        via: 'explicit',
      };
    }

    const fromWorkspace = await this.resolveFromWorkspace(apiToken);
    if (fromWorkspace) {
      return fromWorkspace;
    }

    if (preferPool && this.isUnipileConfigured()) {
      const poolAccount = await this.resolvePoolAccount();
      if (poolAccount) {
        return poolAccount;
      }
    }

    return null;
  }

  async resolveDefaultWorkspaceAccount(
    workspaceId: string,
  ): Promise<ResolvedUnipileSearchAccount | null> {
    const salesNav = await this.findWorkspaceAccountByProduct(
      workspaceId,
      'sales_navigator',
    );
    if (salesNav) {
      return {
        accountId: salesNav.accountId,
        product: 'sales_navigator',
        via: 'workspace_sales_navigator',
      };
    }

    const profiles =
      await this.workspaceQueryService.listWorkspaceMemberLinkedinUnipileProfiles(
        workspaceId,
      );
    const first = profiles[0];
    if (!first) {
      return null;
    }

    return {
      accountId: first.linkedinUnipileAccountId,
      product: inferUnipileLinkedinProduct(first.linkedinProfile),
      via: 'member',
    };
  }

  async resolvePoolAccount(): Promise<ResolvedUnipileSearchAccount | null> {
    if (!this.linkedinUnipileEstimateAccountService || !this.isUnipileConfigured()) {
      return null;
    }

    try {
      const poolAccountId =
        await this.linkedinUnipileEstimateAccountService.resolveSharedSalesNavigatorPoolAccountId(
          'Company/Jobs API Sales Nav pool',
        );
      if (!poolAccountId?.trim()) {
        return null;
      }

      this.logger.log(
        `Unipile search using Sales Navigator pool account ${poolAccountId}`,
      );

      return {
        accountId: poolAccountId.trim(),
        product: 'sales_navigator',
        via: 'pool',
      };
    } catch (error) {
      this.logger.warn(
        `Unipile Sales Navigator pool unavailable: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    }
  }

  private async resolveFromWorkspace(
    apiToken?: string,
  ): Promise<ResolvedUnipileSearchAccount | null> {
    const token = apiToken?.trim();
    if (!token) {
      return null;
    }

    let workspaceId: string | undefined;
    try {
      workspaceId =
        await this.workspaceQueryService.getWorkspaceIdFromToken(token);
    } catch (error) {
      this.logger.warn(
        `Unipile search account resolve: workspace id from token failed: ${
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
        const product = await this.detectProductForAccountInWorkspace(
          workspaceId,
          memberAccountId,
        );

        this.logger.log(
          `Unipile search using member ${workspaceMemberId} account ${memberAccountId} product=${product}`,
        );

        return {
          accountId: memberAccountId,
          product,
          via: 'member',
        };
      }
    }

    const workspaceSalesNav = await this.findWorkspaceAccountByProduct(
      workspaceId,
      'sales_navigator',
    );
    if (workspaceSalesNav) {
      this.logger.log(
        `Unipile search using workspace Sales Navigator member ${workspaceSalesNav.workspaceMemberId} account ${workspaceSalesNav.accountId}`,
      );

      return {
        accountId: workspaceSalesNav.accountId,
        product: 'sales_navigator',
        via: 'workspace_sales_navigator',
      };
    }

    return this.resolveDefaultWorkspaceAccount(workspaceId);
  }

  private async detectProductForAccount(
    apiToken: string | undefined,
    accountId: string,
  ): Promise<UnipileLinkedinProduct> {
    const token = apiToken?.trim();
    if (!token) {
      return 'sales_navigator';
    }

    try {
      const workspaceId =
        await this.workspaceQueryService.getWorkspaceIdFromToken(token);
      if (!workspaceId) {
        return 'sales_navigator';
      }

      return this.detectProductForAccountInWorkspace(workspaceId, accountId);
    } catch {
      return 'sales_navigator';
    }
  }

  private async detectProductForAccountInWorkspace(
    workspaceId: string,
    accountId: string,
  ): Promise<UnipileLinkedinProduct> {
    const profiles =
      await this.workspaceQueryService.listWorkspaceMemberLinkedinUnipileProfiles(
        workspaceId,
      );
    const match = profiles.find(
      (profile) => profile.linkedinUnipileAccountId === accountId,
    );

    if (!match) {
      return 'sales_navigator';
    }

    return inferUnipileLinkedinProduct(match.linkedinProfile);
  }

  private async findWorkspaceAccountByProduct(
    workspaceId: string,
    product: UnipileLinkedinProduct,
  ): Promise<{ workspaceMemberId: string; accountId: string } | null> {
    const profiles =
      await this.workspaceQueryService.listWorkspaceMemberLinkedinUnipileProfiles(
        workspaceId,
      );
    const match = profiles.find(
      (profile) =>
        inferUnipileLinkedinProduct(profile.linkedinProfile) === product,
    );

    if (!match) {
      return null;
    }

    return {
      workspaceMemberId: match.workspaceMemberId,
      accountId: match.linkedinUnipileAccountId,
    };
  }
}
