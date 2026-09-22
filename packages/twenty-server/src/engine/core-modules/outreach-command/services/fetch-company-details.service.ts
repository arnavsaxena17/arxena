import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { type ObjectLiteral } from 'typeorm';

import { isAccountRateLimitDeferredError } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';
import { UnipileCompanyService } from 'src/engine/core-modules/arx-chat/services/unipile-company.service';
import { SearchCompaniesService } from 'src/engine/core-modules/outreach-command/services/search-companies.service';
import {
  type CompanyDetailsRecord,
  emptyCompanyDetails,
  mapSearchHitToCompanyDetails,
  mapUnipileCompanyProfileToDetails,
} from 'src/engine/core-modules/outreach-command/utils/map-company-details.util';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

type WorkspaceMemberArxRecord = ObjectLiteral & {
  id: string;
  workspaceMemberId: string;
  linkedinUnipileAccountId: string | null;
};

export type FetchCompanyDetailsInput = {
  companyName?: string;
  website?: string;
  linkedinUrl?: string;
  workspaceMemberId?: string;
  accountId?: string;
};

type FetchCompanyDetailsResult = {
  success: boolean;
  company: CompanyDetailsRecord;
  companies: CompanyDetailsRecord[];
  dataSource: string;
  error?: string;
};

// Mirror fetch-linkedin-profile people[] — pipe into upsert-companies.
const withCompaniesArray = (result: {
  success: boolean;
  company: CompanyDetailsRecord;
  dataSource: string;
  error?: string;
}): FetchCompanyDetailsResult => {
  const { company } = result;
  const hasIdentity =
    isNonEmptyString(company.id) ||
    isNonEmptyString(company.name) ||
    isNonEmptyString(company.linkedinUrl) ||
    isNonEmptyString(company.website);

  return {
    ...result,
    companies: hasIdentity ? [company] : [],
  };
};

@Injectable()
export class FetchCompanyDetailsService {
  private readonly logger = new Logger(FetchCompanyDetailsService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly unipileCompanyService: UnipileCompanyService,
    private readonly searchCompaniesService: SearchCompaniesService,
  ) {}

  async execute({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: FetchCompanyDetailsInput;
  }): Promise<FetchCompanyDetailsResult> {
    const linkedinUrl = input.linkedinUrl?.trim() ?? '';
    const companyName = input.companyName?.trim() ?? '';
    const website = input.website?.trim() ?? '';
    const empty = {
      success: false as const,
      company: emptyCompanyDetails(),
      dataSource: '',
    };

    if (
      !isNonEmptyString(linkedinUrl) &&
      !isNonEmptyString(companyName) &&
      !isNonEmptyString(website)
    ) {
      return withCompaniesArray({
        ...empty,
        error: 'companyName, website, or linkedinUrl is required',
      });
    }

    try {
      const accountId = await this.resolveAccountId(workspaceId, input);

      if (isNonEmptyString(linkedinUrl)) {
        return this.fetchByLinkedinUrl({
          linkedinUrl,
          accountId,
        });
      }

      return this.fetchBySearch({
        workspaceId,
        companyName,
        website,
        accountId,
      });
    } catch (error) {
      if (isAccountRateLimitDeferredError(error)) {
        throw error;
      }

      this.logger.error('fetch-company-details failed', error);

      return withCompaniesArray({
        ...empty,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async fetchByLinkedinUrl({
    linkedinUrl,
    accountId,
  }: {
    linkedinUrl: string;
    accountId: string;
  }): Promise<FetchCompanyDetailsResult> {
    const empty = {
      success: false as const,
      company: emptyCompanyDetails(),
      dataSource: 'unipile',
    };

    if (!isNonEmptyString(accountId)) {
      return withCompaniesArray({
        ...empty,
        error: 'No LinkedIn Unipile account on workspace member profile',
      });
    }

    const slug =
      this.unipileCompanyService.extractPublicIdentifier(linkedinUrl);

    if (!isNonEmptyString(slug)) {
      return withCompaniesArray({
        ...empty,
        error: 'Could not parse LinkedIn company URL',
      });
    }

    const profile = await this.unipileCompanyService.getCompanyProfile(
      slug,
      accountId,
    );

    if (!profile) {
      return withCompaniesArray({
        ...empty,
        error: 'Unipile returned no company profile',
      });
    }

    return withCompaniesArray({
      success: true,
      company: mapUnipileCompanyProfileToDetails(profile, {
        linkedinUrl,
        publicIdentifier: slug,
      }),
      dataSource: 'unipile',
      error: '',
    });
  }

  private async fetchBySearch({
    workspaceId,
    companyName,
    website,
    accountId,
  }: {
    workspaceId: string;
    companyName: string;
    website: string;
    accountId: string;
  }): Promise<FetchCompanyDetailsResult> {
    const search = (await this.searchCompaniesService.execute({
      workspaceId,
      input: {
        companyName: companyName || undefined,
        website: website || undefined,
        limit: 1,
      },
    })) as {
      success?: boolean;
      dataSource?: string;
      error?: string;
      companies?: Array<{
        id?: string;
        name?: string;
        website?: string;
        linkedinUrl?: string;
        industry?: string;
      }>;
    };

    if (search.success === false || !search.companies?.[0]) {
      return withCompaniesArray({
        success: false,
        company: emptyCompanyDetails(),
        dataSource: search.dataSource ?? 'auto',
        error: search.error || 'No company found',
      });
    }

    const hit = mapSearchHitToCompanyDetails(search.companies[0]);
    const slug = isNonEmptyString(hit.linkedinUrl)
      ? this.unipileCompanyService.extractPublicIdentifier(hit.linkedinUrl)
      : null;

    if (isNonEmptyString(accountId) && isNonEmptyString(slug)) {
      const profile = await this.unipileCompanyService.getCompanyProfile(
        slug,
        accountId,
      );

      if (profile) {
        return withCompaniesArray({
          success: true,
          company: mapUnipileCompanyProfileToDetails(profile, hit),
          dataSource: 'unipile',
          error: '',
        });
      }
    }

    return withCompaniesArray({
      success: true,
      company: hit,
      dataSource: search.dataSource ?? 'auto',
      error: '',
    });
  }

  private async resolveAccountId(
    workspaceId: string,
    input: FetchCompanyDetailsInput,
  ): Promise<string> {
    const explicit = input.accountId?.trim() ?? '';

    if (isNonEmptyString(explicit)) {
      return explicit;
    }

    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const profileRepository =
          await this.globalWorkspaceOrmManager.getRepository<WorkspaceMemberArxRecord>(
            workspaceId,
            'workspaceMember',
            { shouldBypassPermissionChecks: true },
          );

        const workspaceMemberId = input.workspaceMemberId?.trim() ?? '';

        if (isNonEmptyString(workspaceMemberId)) {
          const profile = await profileRepository.findOne({
            where: { id: workspaceMemberId },
          });
          const fromMember = profile?.linkedinUnipileAccountId?.trim() ?? '';

          if (isNonEmptyString(fromMember)) {
            return fromMember;
          }
        }

        const anyProfile = await profileRepository.find({
          where: {},
          take: 20,
        });
        const withAccount = anyProfile.find((row) =>
          isNonEmptyString(row.linkedinUnipileAccountId),
        );

        return withAccount?.linkedinUnipileAccountId?.trim() ?? '';
      },
      authContext,
    );
  }
}
