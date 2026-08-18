import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { type ObjectLiteral } from 'typeorm';

import { ApiKeyService } from 'src/engine/core-modules/api-key/services/api-key.service';
import { ProcessCandidatesService } from 'src/engine/core-modules/candidate-sourcing/jobs/process-candidates.service';
import { EnsureGtmProjectService } from 'src/engine/core-modules/gtm-command/services/ensure-gtm-project.service';
import { extractLinkedinProfileId } from 'src/engine/core-modules/gtm-command/utils/extract-linkedin-profile-id.util';
import { PeopleApiService } from 'src/engine/core-modules/people-api/people-api.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
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

const parseIcpSpec = (
  raw: string | null | undefined,
): {
  // stdFunctions?: string[];
  // stdGrades?: string[];
  buyerTitles?: string[];
} => {
  if (!isNonEmptyString(raw)) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as {
      // stdFunctions?: string[];
      // std_function?: string[];
      // stdGrades?: string[];
      std_grade?: string[];
      buyerTitles?: string[];
    };

    return {
      // stdFunctions: parsed.stdFunctions ?? parsed.std_function,
      // stdGrades: parsed.stdGrades ?? parsed.std_grade,
      buyerTitles: parsed.buyerTitles,
    };
  } catch {
    return {};
  }
};

const readLinkedinUrl = (item: Record<string, unknown>): string => {
  const candidates = [
    item.linkedinUrl,
    item.linkedin_url,
    item.profile_url,
    item.profileUrl,
    item.url,
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.includes('linkedin')) {
      return value;
    }
  }

  const publicId =
    typeof item.public_identifier === 'string'
      ? item.public_identifier
      : typeof item.publicIdentifier === 'string'
        ? item.publicIdentifier
        : '';

  return publicId ? `https://www.linkedin.com/in/${publicId}` : '';
};

@Injectable()
export class SearchPeopleForCompanyService {
  private readonly logger = new Logger(SearchPeopleForCompanyService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly peopleApiService: PeopleApiService,
    private readonly processCandidatesService: ProcessCandidatesService,
    private readonly ensureGtmProjectService: EnsureGtmProjectService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  async execute({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: SearchPeopleForCompanyInput;
  }): Promise<{
    success: boolean;
    enrolledCount: number;
    people: Array<{
      linkedinUrl: string;
      linkedinProfileId: string;
      name: string;
      title: string;
    }>;
    projectId: string | null;
    error?: string;
  }> {
    const companyId = input.companyId?.trim() ?? '';

    if (!isNonEmptyString(companyId)) {
      return {
        success: false,
        enrolledCount: 0,
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
        enrolledCount: 0,
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
        enrolledCount: 0,
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

    const apiToken = await this.resolveApiToken(workspaceId);

    if (!isNonEmptyString(apiToken)) {
      return {
        success: false,
        enrolledCount: 0,
        people: [],
        projectId: ensured.projectId,
        error: 'Workspace API token is required to search people',
      };
    }

    const search = await this.peopleApiService.searchPeople(
      {
        companyId,
        companyName: context.company.name ?? undefined,
        website,
        // stdFunction: icp.stdFunctions?.[0],
        // stdGrade: icp.stdGrades?.[0],
        jobTitle: buyerTitle,
        naturalLanguage: buyerTitle
          ? `${buyerTitle} at ${context.company.name ?? 'the company'}`
          : peopleSearchBlurb || undefined,
        limit,
        dataSource: 'auto',
      },
      apiToken,
    );

    const people = (search.items ?? []).map((item) => {
      const linkedinUrl = readLinkedinUrl(item);
      const name =
        (typeof item.name === 'string' && item.name) ||
        [item.first_name, item.last_name].filter(Boolean).join(' ') ||
        '';
      const title =
        (typeof item.title === 'string' && item.title) ||
        (typeof item.headline === 'string' && item.headline) ||
        '';

      return {
        linkedinUrl,
        linkedinProfileId: extractLinkedinProfileId(linkedinUrl),
        name,
        title,
        raw: item,
      };
    });

    const enrollable = people.filter((person) =>
      isNonEmptyString(person.linkedinUrl),
    );

    if (enrollable.length > 0) {
      await this.processCandidatesService.queueRawDataForProcessing(
        enrollable.map((person) => ({
          ...person.raw,
          linkedinUrl: person.linkedinUrl,
          name: person.name,
          title: person.title,
        })),
        'linkedin_search',
        ensured.projectId,
        context.project.name || 'GTM Outreach',
        'system',
        new Date().toISOString(),
        'gtm-search-people-for-company',
        apiToken,
        undefined,
        { queueStartChatAfter: false },
      );
    }

    this.logger.log(
      `search-people-for-company enrolled ${enrollable.length} profiles for company ${companyId}`,
    );

    return {
      success: true,
      enrolledCount: enrollable.length,
      people: enrollable.map(
        ({ linkedinUrl, linkedinProfileId, name, title }) => ({
          linkedinUrl,
          linkedinProfileId,
          name,
          title,
        }),
      ),
      projectId: ensured.projectId,
    };
  }

  private async resolveApiToken(workspaceId: string): Promise<string | null> {
    const apiKeys = await this.workspaceQueryService.getApiKeys(workspaceId);
    const apiKeyId = apiKeys?.[0]?.id;

    if (!isNonEmptyString(apiKeyId)) {
      return null;
    }

    const token = await this.apiKeyService.generateApiKeyToken(
      workspaceId,
      apiKeyId,
    );

    return token?.token ?? null;
  }
}
