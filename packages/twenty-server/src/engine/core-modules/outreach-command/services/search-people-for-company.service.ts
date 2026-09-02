import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { resolveOutreachConfigIcpSpecString } from 'twenty-shared/arx';
import { isDefined } from 'twenty-shared/utils';
import { type ObjectLiteral } from 'typeorm';

import {
  LinkedInSearchTransformerService,
  type TransformedCandidateForTable,
} from 'src/engine/core-modules/candidate-sourcing/services/data-sources/linkedin-search-transformer.service';
import { EnsureOutreachProjectService } from 'src/engine/core-modules/outreach-command/services/ensure-outreach-project.service';
import { OutreachWorkspaceAuthTokenService } from 'src/engine/core-modules/outreach-command/services/outreach-workspace-auth-token.service';
import { parseIcpSpec } from 'src/engine/core-modules/outreach-command/utils/outreach-icp-spec.util';
import { extractLinkedinProfileId } from 'src/engine/core-modules/outreach-command/utils/extract-linkedin-profile-id.util';
import {
  mapSearchPeopleProfile,
  type SearchPeopleEducation,
  type SearchPeopleExperience,
} from 'src/engine/core-modules/outreach-command/utils/map-search-people-profile.util';
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
  linkedinId?: string | null;
  projectIds?: string | null;
};

type ProjectRecord = ObjectLiteral & {
  id: string;
  name?: string | null;
  projectIds?: string | null;
  outreachConfig?: unknown;
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
  jobTitle?: string;
  limit?: number;
};

export type SearchPeopleForCompanyPerson = {
  name: string;
  firstName: string;
  lastName: string;
  title: string;
  headline: string;
  company: string;
  companyName: string;
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
  experience: SearchPeopleExperience[];
  education: SearchPeopleEducation[];
  current_positions: unknown[];
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
    private readonly ensureOutreachProjectService: EnsureOutreachProjectService,
    private readonly gtmWorkspaceAuthTokenService: OutreachWorkspaceAuthTokenService,
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

    const ensured = await this.ensureOutreachProjectService.ensureForCompany({
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

    const icp = parseIcpSpec(
      resolveOutreachConfigIcpSpecString(
        context.project.outreachConfig,
        context.project.icpSpec,
      ) || context.workspaceProfile?.icpSpec,
    );
    const targetTitle = input.jobTitle?.trim() || icp.targetTitles[0];
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
          jobTitle: targetTitle,
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
        context.project.name || 'Outreach',
        companyId,
        {
          companyName: context.company.name ?? search.query?.company?.name,
          companyId:
            search.query?.company?.id ?? context.company.linkedinId ?? null,
          companySlug: search.query?.company?.slug,
        },
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
    targetCompany?: {
      companyName?: string | null;
      companyId?: string | null;
      companySlug?: string | null;
    },
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
            {
              targetCompanyName: targetCompany?.companyName ?? undefined,
              targetCompanyId: targetCompany?.companyId ?? undefined,
              targetCompanyIds: targetCompany?.companyId
                ? [targetCompany.companyId]
                : undefined,
              targetCompanySlug: targetCompany?.companySlug ?? undefined,
            },
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
      const mapped = mapSearchPeopleProfile(items[index] ?? {}, {
        source: dataSource,
        companyId: targetCompany?.companyId ?? undefined,
        companyName: targetCompany?.companyName,
        companySlug: targetCompany?.companySlug,
      });
      const transformerCompany = row.company?.trim() || row.jobCompanyName?.trim() || '';
      const company =
        (transformerCompany && transformerCompany !== 'Not specified'
          ? transformerCompany
          : '') || mapped.companyName;
      const transformerTitle =
        row.jobTitle?.trim() && row.jobTitle.trim() !== 'Not specified'
          ? row.jobTitle.trim()
          : '';

      return {
        name: row.name?.trim() || row.fullName?.trim() || mapped.name,
        firstName: row.firstName?.trim() || mapped.firstName,
        lastName: row.lastName?.trim() || mapped.lastName,
        title: transformerTitle || mapped.title,
        headline: row.headline?.trim() || row.linkedinHeadline?.trim() || mapped.headline,
        company,
        companyName: company,
        location: row.location?.trim() || row.locationName?.trim() || mapped.location,
        linkedinUrl: linkedinUrl || mapped.linkedinUrl,
        linkedinProfileId:
          extractLinkedinProfileId(linkedinUrl) || mapped.linkedinProfileId,
        peopleId: row.peopleId ?? (mapped.peopleId || null),
        profilePictureUrl:
          row.profilePictureUrl?.trim() ||
          row.displayPicture?.trim() ||
          mapped.profilePictureUrl,
        companyId,
        source: row.source || mapped.source || dataSource || '',
        stdFunction: taxonomy.stdFunction || mapped.stdFunction || null,
        stdFunctionRoot: taxonomy.stdFunctionRoot || mapped.stdFunctionRoot || null,
        stdGrade: taxonomy.stdGrade || mapped.stdGrade || null,
        experience: mapped.experience,
        education: mapped.education,
        current_positions: mapped.current_positions,
      };
    });
  }
}
