import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { type ObjectLiteral } from 'typeorm';

import { ProcessCandidatesService } from 'src/engine/core-modules/candidate-sourcing/jobs/process-candidates.service';
import { EnsureGtmProjectService } from 'src/engine/core-modules/gtm-command/services/ensure-gtm-project.service';
import { GtmWorkspaceAuthTokenService } from 'src/engine/core-modules/gtm-command/services/gtm-workspace-auth-token.service';
import { extractLinkedinProfileId } from 'src/engine/core-modules/gtm-command/utils/extract-linkedin-profile-id.util';
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

    const apiKeyToken =
      await this.gtmWorkspaceAuthTokenService.resolveApiKeyToken(workspaceId);

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
      apiKeyToken ?? undefined,
      { workspaceId },
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
      const enrollToken =
        await this.gtmWorkspaceAuthTokenService.resolveOrMint(workspaceId);

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
        enrollToken,
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
}
