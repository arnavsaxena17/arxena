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
import { extractLinkedinProfileId } from 'src/engine/core-modules/gtm-command/utils/extract-linkedin-profile-id.util';
import type { LinkedInSearchResult } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-response.type';
import { PeopleApiService } from 'src/engine/core-modules/people-api/people-api.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

type CompanyRecord = ObjectLiteral & {
  id: string;
  name?: string | null;
  domainName?: { primaryLinkUrl?: string } | null;
  gtmRunKey?: string | null;
};

type ProjectRecord = ObjectLiteral & {
  id: string;
  name?: string | null;
  gtmRunKey?: string | null;
  icpSpec?: string | null;
  peopleSearchBlurb?: string | null;
  maxPersonasPerCompany?: number | null;
};

type WorkspaceProfileRecord = ObjectLiteral & {
  id: string;
  icpSpec?: string | null;
  peopleSearchBlurb?: string | null;
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
  source: string;
  stdFunction: string | null;
  stdFunctionRoot: string | null;
  stdGrade: string | null;
};

const parseIcpSpec = (
  raw: string | null | undefined,
): {
  buyerTitles?: string[];
} => {
  if (!isNonEmptyString(raw)) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as {
      buyerTitles?: string[];
    };

    return {
      buyerTitles: parsed.buyerTitles,
    };
  } catch {
    return {};
  }
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

    const icp = parseIcpSpec(
      context.project.icpSpec || context.workspaceProfile?.icpSpec,
    );
    const peopleSearchBlurb =
      context.project.peopleSearchBlurb ||
      context.workspaceProfile?.peopleSearchBlurb ||
      '';
    const buyerTitle = icp.buyerTitles?.[0];
    const website =
      context.company.domainName?.primaryLinkUrl
        ?.replace(/^https?:\/\//, '')
        .split('/')[0] ?? undefined;
    const limit = Math.min(
      Math.max(1, input.limit ?? context.project.maxPersonasPerCompany ?? 5),
      25,
    );

    const apiKeyToken =
      await this.gtmWorkspaceAuthTokenService.resolveApiKeyToken(workspaceId);

    const search = await this.peopleApiService.searchPeople(
      {
        companyId,
        companyName: context.company.name ?? undefined,
        website,
        jobTitle: buyerTitle,
        naturalLanguage: buyerTitle
          ? `${buyerTitle} at ${context.company.name ?? 'the company'}`
          : peopleSearchBlurb || undefined,
        limit,
        dataSource: 'auto',
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
    };
  }

  private toStandardizedPeople(
    items: Array<Record<string, unknown>>,
    dataSource: string | undefined,
    projectId: string,
    projectName: string,
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
        source: row.source || dataSource || '',
        ...taxonomy,
      };
    });
  }
}
