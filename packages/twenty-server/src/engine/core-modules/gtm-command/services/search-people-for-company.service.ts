import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { type ObjectLiteral } from 'typeorm';

import {
  LinkedInSearchTransformerService,
  type TransformedCandidateForTable,
} from 'src/engine/core-modules/candidate-sourcing/services/data-sources/linkedin-search-transformer.service';
import { EnsureGtmProjectService } from 'src/engine/core-modules/gtm-command/services/ensure-gtm-project.service';
import { GtmWorkspaceAuthTokenService } from 'src/engine/core-modules/gtm-command/services/gtm-workspace-auth-token.service';
import { parseGtmIcpSpec } from 'src/engine/core-modules/gtm-command/utils/gtm-icp-spec.util';
import { extractLinkedinProfileId } from 'src/engine/core-modules/gtm-command/utils/extract-linkedin-profile-id.util';
import { UnipileSearchAccountResolver } from 'src/engine/core-modules/linkedin-search/services/unipile-search-account.resolver';
import type { LinkedInSearchResult } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-response.type';
import { isAccountRateLimitDeferredError } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';
import { PeopleApiService } from 'src/engine/core-modules/people-api/people-api.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

type CompanyRecord = ObjectLiteral & {
  id: string;
  name?: string | null;
  domainName?: { primaryLinkUrl?: string } | null;
  linkedinLink?: { primaryLinkUrl?: string | null } | null;
  linkedinLinkPrimaryLinkUrl?: string | null;
  gtmRunKey?: string | null;
};

type ProjectRecord = ObjectLiteral & {
  id: string;
  name?: string | null;
  gtmRunKey?: string | null;
  icpSpec?: string | null;
  maxPersonasPerCompany?: number | null;
};

type WorkspaceProfileRecord = ObjectLiteral & {
  id: string;
  icpSpec?: string | null;
};

export type SearchPeopleForCompanyInput = {
  companyId: string;
  projectId?: string;
  limit?: number;
};

export type SearchPeopleForCompanyPerson = {
  name: string;
  firstName: string;
  lastName: string;
  title: string;
  headline: string;
  company: string;
  location: string;
  linkedinUrl: string;
  linkedinProfileId: string;
  peopleId: string | null;
  profilePictureUrl: string;
  companyId: string;
  source: string;
  stdFunction: string | null;
  stdFunctionRoot: string | null;
  stdGrade: string | null;
};

const companyWebsite = (company: CompanyRecord): string | undefined => {
  const website =
    company.domainName?.primaryLinkUrl
      ?.replace(/^https?:\/\//, '')
      .split('/')[0] ?? undefined;

  return website?.trim() || undefined;
};

const companyLinkedinUrl = (company: CompanyRecord): string | undefined => {
  const url =
    company.linkedinLink?.primaryLinkUrl ??
    company.linkedinLinkPrimaryLinkUrl ??
    '';

  return url.trim() || undefined;
};

const parseStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0,
  );
};

const readTaxonomyResolved = (
  item: Record<string, unknown> | undefined,
): Pick<
  SearchPeopleForCompanyPerson,
  'stdFunction' | 'stdFunctionRoot' | 'stdGrade'
> => {
  const resolved =
    item && typeof item.resolved === 'object' && item.resolved !== null
      ? (item.resolved as Record<string, unknown>)
      : undefined;

  return {
    stdFunction:
      typeof resolved?.stdFunction === 'string' ? resolved.stdFunction : null,
    stdFunctionRoot:
      typeof resolved?.stdFunctionRoot === 'string'
        ? resolved.stdFunctionRoot
        : null,
    stdGrade:
      typeof resolved?.stdGrade === 'string' ? resolved.stdGrade : null,
  };
};

const isUnipilePeopleSearchHit = (item: Record<string, unknown>): boolean =>
  item.type === 'PEOPLE' ||
  Array.isArray(item.current_positions) ||
  typeof item.public_identifier === 'string' ||
  typeof item.profile_url === 'string' ||
  typeof item.public_profile_url === 'string';

@Injectable()
export class SearchPeopleForCompanyService {
  private readonly logger = new Logger(SearchPeopleForCompanyService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly peopleApiService: PeopleApiService,
    private readonly linkedInSearchTransformer: LinkedInSearchTransformerService,
    private readonly ensureGtmProjectService: EnsureGtmProjectService,
    private readonly gtmWorkspaceAuthTokenService: GtmWorkspaceAuthTokenService,
    private readonly unipileSearchAccountResolver: UnipileSearchAccountResolver,
  ) {}

  async execute({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: SearchPeopleForCompanyInput;
  }): Promise<{
    success: boolean;
    total: number;
    dataSource: string;
    people: SearchPeopleForCompanyPerson[];
    projectId: string | null;
    error?: string;
  }> {
    const companyId = input.companyId?.trim() ?? '';

    if (!isNonEmptyString(companyId)) {
      return {
        success: false,
        total: 0,
        dataSource: '',
        people: [],
        projectId: null,
        error: 'companyId is required',
      };
    }

    const ensured = await this.ensureGtmProjectService.ensureForCompany({
      workspaceId,
      companyId,
      projectId: input.projectId,
    });

    if (!isDefined(ensured)) {
      return {
        success: false,
        total: 0,
        dataSource: '',
        people: [],
        projectId: null,
        error: 'Could not ensure a GTM Project',
      };
    }

    const authContext = buildSystemAuthContext(workspaceId);
    const context = await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const companyRepository =
          await this.globalWorkspaceOrmManager.getRepository<CompanyRecord>(
            workspaceId,
            'company',
            { shouldBypassPermissionChecks: true },
          );
        const projectRepository =
          await this.globalWorkspaceOrmManager.getRepository<ProjectRecord>(
            workspaceId,
            'project',
            { shouldBypassPermissionChecks: true },
          );
        const workspaceProfileRepository =
          await this.globalWorkspaceOrmManager.getRepository<WorkspaceProfileRecord>(
            workspaceId,
            'workspaceProfile',
            { shouldBypassPermissionChecks: true },
          );

        const company = await companyRepository.findOne({
          where: { id: companyId },
        });
        const project = await projectRepository.findOne({
          where: { id: ensured.projectId },
        });
        const workspaceProfile = await workspaceProfileRepository.find({
          take: 1,
        });

        return {
          company,
          project,
          workspaceProfile: workspaceProfile[0],
        };
      },
      authContext,
    );

    if (!isDefined(context.company) || !isDefined(context.project)) {
      return {
        success: false,
        total: 0,
        dataSource: '',
        people: [],
        projectId: ensured.projectId,
        error: 'Company or Project not found',
      };
    }

    const icp = parseGtmIcpSpec(
      context.project.icpSpec || context.workspaceProfile?.icpSpec,
    );
    const buyerTitle = icp.buyerTitles[0];
    const locations = icp.locations;
    const website = companyWebsite(context.company);
    const linkedinCompanyUrl = companyLinkedinUrl(context.company);

    const apiKeyToken =
      await this.gtmWorkspaceAuthTokenService.resolveApiKeyToken(workspaceId);
    const defaultAccount =
      await this.unipileSearchAccountResolver.resolveDefaultWorkspaceAccount(
        workspaceId,
      );
    const maxLimit =
      defaultAccount?.product === 'sales_navigator' ? 50 : 10;
    const limit = Math.min(
      Math.max(1, input.limit ?? maxLimit),
      maxLimit,
    );

    try {
      const search = await this.peopleApiService.searchPeople(
        {
          companyId,
          companyName: context.company.name ?? undefined,
          website,
          linkedinCompanyUrl,
          jobTitle: buyerTitle,
          locations,
          limit,
          dataSource: 'auto',
          accountId: defaultAccount?.accountId,
        },
        apiKeyToken ?? undefined,
        { workspaceId },
      );

      const items = (search.items ?? []) as Array<Record<string, unknown>>;
      const people = this.toStandardizedPeople(
        items,
        search.dataSource,
        ensured.projectId,
        context.project.name || 'GTM Outreach',
        companyId,
      );

      this.logger.log(
        `search-people-for-company returned ${people.length} standardized profiles for company ${companyId} dataSource=${search.dataSource ?? ''}`,
      );

      return {
        success: true,
        total: people.length,
        dataSource: search.dataSource ?? '',
        people,
        projectId: ensured.projectId,
        companyId,
      };
    } catch (error) {
      if (isAccountRateLimitDeferredError(error)) {
        throw error;
      }

      this.logger.error(
        `search-people-for-company failed for company ${companyId}`,
        error,
      );

      return {
        success: false,
        total: 0,
        dataSource: '',
        people: [],
        projectId: ensured.projectId,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private toStandardizedPeople(
    items: Array<Record<string, unknown>>,
    dataSource: string | undefined,
    projectId: string,
    projectName: string,
    companyId: string,
  ): SearchPeopleForCompanyPerson[] {
    if (items.length === 0) {
      return [];
    }

    const shouldTransformUnipileHits =
      dataSource !== 'harvest' && items.some(isUnipilePeopleSearchHit);

    const transformed: TransformedCandidateForTable[] = shouldTransformUnipileHits
      ? this.linkedInSearchTransformer.addMetadataToCandidates(
          this.linkedInSearchTransformer.transformSearchResultsToTableFormat(
            items as LinkedInSearchResult[],
            projectId,
            projectName,
          ),
          {
            searchType: 'sales_navigator',
            searchCategory: 'people',
            timestamp: new Date().toISOString(),
            processingTime: 0,
          },
        )
      : (items as unknown as TransformedCandidateForTable[]);

    return transformed.map((row, index) => {
      const linkedinUrl =
        typeof row.linkedinUrl === 'string' ? row.linkedinUrl.trim() : '';
      const taxonomy = readTaxonomyResolved(items[index]);

      return {
        name: row.name?.trim() || row.fullName?.trim() || '',
        firstName: row.firstName?.trim() || '',
        lastName: row.lastName?.trim() || '',
        title: row.jobTitle?.trim() || '',
        headline: row.headline?.trim() || row.linkedinHeadline?.trim() || '',
        company: row.company?.trim() || row.jobCompanyName?.trim() || '',
        location: row.location?.trim() || row.locationName?.trim() || '',
        linkedinUrl,
        linkedinProfileId: extractLinkedinProfileId(linkedinUrl),
        peopleId: row.peopleId ?? null,
        profilePictureUrl:
          row.profilePictureUrl?.trim() || row.displayPicture?.trim() || '',
        companyId,
        source: row.source || dataSource || '',
        ...taxonomy,
      };
    });
  }
}
