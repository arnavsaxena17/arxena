import { Injectable, Logger } from '@nestjs/common';
import { v4 } from 'uuid';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined, isValidUuid } from 'twenty-shared/utils';
import { type ObjectLiteral } from 'typeorm';

import { ProcessCandidatesService } from 'src/engine/core-modules/candidate-sourcing/jobs/process-candidates.service';
import { linkedinPremiumProfileNeedsFetch } from 'src/engine/core-modules/candidate-sourcing/utils/hydrate-linkedin-premium-from-fetch.util';
import { FetchLinkedinProfileService } from 'src/engine/core-modules/outreach-command/services/fetch-linkedin-profile.service';
import { OutreachWorkspaceAuthTokenService } from 'src/engine/core-modules/outreach-command/services/outreach-workspace-auth-token.service';
import { UpsertCompaniesService } from 'src/engine/core-modules/outreach-command/services/upsert-companies.service';
import { mapUploadProfileToLinkedinSearchRow } from 'src/engine/core-modules/outreach-command/utils/map-upload-profile-to-linkedin-search-row.util';
import {
  collectUploadCandidateIds,
  normalizeUploadPeople,
  toUploadProfilesPerson,
  type UploadProfilesPerson,
} from 'src/engine/core-modules/outreach-command/utils/normalize-upload-people.util';
import {
  buildUploadSearchIntent,
  collectUniqueEmployerHits,
  prepareUploadPersonEmployer,
  stampCrmCompanyIds,
} from 'src/engine/core-modules/outreach-command/utils/prepare-upload-people-employers.util';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

type ProjectRecord = ObjectLiteral & {
  id: string;
  name?: string | null;
  recruiterId?: string | null;
  createdBy?: { workspaceMemberId?: string | null } | null;
  createdByWorkspaceMemberId?: string | null;
};

type CompanyRecord = ObjectLiteral & {
  id: string;
  name?: string | null;
  linkedinId?: string | null;
};

type CandidateRecord = ObjectLiteral & {
  id: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  jobTitle?: string | null;
  jobCompanyName?: string | null;
  location?: string | null;
  peopleId?: string | null;
  personId?: string | null;
  projectsId?: string | null;
  linkedinProfileId?: string | null;
  linkedinUrl?: { primaryLinkUrl?: string | null } | null;
};

export type { UploadProfilesPerson };

export type UploadProfilesInput = {
  projectId?: string;
  companyId?: string;
  people?: unknown;
  candidates?: unknown;
  candidateId?: string;
  linkedinUrl?: string;
  limit?: number;
};

@Injectable()
export class UploadProfilesService {
  private readonly logger = new Logger(UploadProfilesService.name);

  constructor(
    private readonly processCandidatesService: ProcessCandidatesService,
    private readonly gtmWorkspaceAuthTokenService: OutreachWorkspaceAuthTokenService,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly fetchLinkedinProfileService: FetchLinkedinProfileService,
    private readonly upsertCompaniesService: UpsertCompaniesService,
  ) {}

  async execute({
    workspaceId,
    input,
    workflowRunId,
    stepId,
  }: {
    workspaceId: string;
    input: UploadProfilesInput;
    workflowRunId?: string;
    stepId?: string;
  }): Promise<{
    success: boolean;
    queued: number;
    projectId: string;
    error?: string;
    pending?: boolean;
    created?: number;
    candidateIds?: string[];
    uploadSessionId?: string;
  }> {
    const people = normalizeUploadPeople(input.people);
    const legacyCandidates = normalizeUploadPeople(input.candidates);
    const fromLinkedinUrl = normalizeUploadPeople(input.linkedinUrl);
    const fromPayload =
      people.length > 0
        ? people
        : legacyCandidates.length > 0
          ? legacyCandidates
          : fromLinkedinUrl.length > 0
            ? fromLinkedinUrl
            : normalizeUploadPeople(input);
    const loaded = await this.loadCandidatesAsPeople({
      workspaceId,
      candidateIds: collectUploadCandidateIds(
        input.candidateId,
        input.people,
        input.candidates,
        fromPayload.length > 0 ? undefined : input,
      ),
    });
    const merged = this.mergePeople([...fromPayload, ...loaded.people]);
    // Optional limit only — when unset/null, enroll everyone passed in.
    const limit =
      typeof input.limit === 'number' &&
      Number.isFinite(input.limit) &&
      input.limit > 0
        ? Math.floor(input.limit)
        : merged.length;
    const projectId =
      input.projectId?.trim() || loaded.projectId || merged[0]?.projectId || '';

    if (!isNonEmptyString(projectId)) {
      return {
        success: false,
        queued: 0,
        projectId: '',
        error: 'projectId is required',
      };
    }

    const rows = merged.slice(0, limit);

    if (rows.length === 0) {
      return {
        success: false,
        queued: 0,
        projectId,
        error: 'people, candidate, or linkedinUrl is required',
      };
    }

    const project = await this.loadProject(workspaceId, projectId);

    if (!isDefined(project)) {
      return {
        success: false,
        queued: 0,
        projectId,
        error: 'Project not found',
      };
    }

    const apiToken =
      await this.gtmWorkspaceAuthTokenService.resolveOrMint(workspaceId);
    const recruiterId = this.resolveRecruiterId(project);

    if (!isNonEmptyString(recruiterId)) {
      this.logger.warn(
        `upload-profiles project ${projectId} has no recruiter; queueing without workspace member`,
      );
    }
    const companyId = input.companyId?.trim() ?? '';
    const hydrated = await this.hydrateUrlOnlyPeople({
      workspaceId,
      people: rows,
    });
    const workflowCompany = await this.loadWorkflowCompany(
      workspaceId,
      companyId,
    );
    const prepared = hydrated.map((person) =>
      prepareUploadPersonEmployer(
        person,
        buildUploadSearchIntent({ workflowCompany }),
        isValidUuid(companyId) ? companyId : undefined,
      ),
    );
    const kept = prepared.filter((entry) => !entry.skip);
    const skipped = prepared.length - kept.length;

    if (skipped > 0) {
      this.logger.warn(
        `upload-profiles skipped ${skipped} of ${prepared.length} people for project ${projectId}`,
      );
    }

    const uniqueHits = collectUniqueEmployerHits(
      kept.map((entry) => entry.employerHit),
    );
    const companyIds = await this.upsertEmployersBestEffort({
      workspaceId,
      projectId,
      uniqueHits,
    });
    const stamped = stampCrmCompanyIds(
      kept.map((entry) => entry.person),
      uniqueHits,
      companyIds,
    );
    const mapped = stamped.map((row) =>
      mapUploadProfileToLinkedinSearchRow(row, row.companyId ?? ''),
    );

    if (mapped.length === 0) {
      const error =
        skipped > 0
          ? `All ${skipped} people were skipped because none matched the workflow company`
          : 'No profiles to queue';

      this.logger.warn(
        `upload-profiles queued 0 profiles for project ${projectId}: ${error}`,
      );

      return {
        success: false,
        queued: 0,
        projectId,
        error,
      };
    }

    const uploadSessionId = v4();
    const shouldParkWorkflowStep =
      isNonEmptyString(workflowRunId) && isNonEmptyString(stepId);

    await this.processCandidatesService.queueRawDataForProcessing(
      mapped,
      'linkedin_search',
      projectId,
      project.name || 'Outreach',
      recruiterId,
      new Date().toISOString(),
      'gtm-workflow-upload-profiles',
      apiToken,
      uploadSessionId,
      shouldParkWorkflowStep
        ? {
            workflowRunId,
            workflowStepId: stepId,
            workspaceId,
          }
        : undefined,
    );

    this.logger.log(
      `upload-profiles queued ${mapped.length} profiles for project ${projectId}${
        shouldParkWorkflowStep ? ' (workflow step pending)' : ''
      }`,
    );

    return {
      success: true,
      queued: mapped.length,
      projectId,
      uploadSessionId,
      created: 0,
      candidateIds: [],
      error: '',
      ...(shouldParkWorkflowStep ? { pending: true } : {}),
    };
  }

  private async loadProject(
    workspaceId: string,
    projectId: string,
  ): Promise<ProjectRecord | null> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const projectRepository =
          await this.globalWorkspaceOrmManager.getRepository<ProjectRecord>(
            workspaceId,
            'project',
            { shouldBypassPermissionChecks: true },
          );

        return projectRepository.findOne({
          where: { id: projectId },
          select: ['id', 'name', 'recruiterId', 'createdByWorkspaceMemberId'],
        });
      },
      authContext,
    );
  }

  private async loadWorkflowCompany(
    workspaceId: string,
    companyId: string,
  ): Promise<CompanyRecord | undefined> {
    if (!isValidUuid(companyId)) {
      return undefined;
    }

    const authContext = buildSystemAuthContext(workspaceId);

    try {
      return (
        (await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
          async () => {
            const companyRepository =
              await this.globalWorkspaceOrmManager.getRepository<CompanyRecord>(
                workspaceId,
                'company',
                { shouldBypassPermissionChecks: true },
              );

            return companyRepository.findOne({
              where: { id: companyId },
              select: ['id', 'name', 'linkedinId'],
            });
          },
          authContext,
        )) ?? undefined
      );
    } catch (error) {
      this.logger.warn(
        `upload-profiles failed to load workflow company ${companyId}; continuing without company scope: ${
          error instanceof Error ? error.message : error
        }`,
      );

      return undefined;
    }
  }

  private async upsertEmployersBestEffort({
    workspaceId,
    projectId,
    uniqueHits,
  }: {
    workspaceId: string;
    projectId: string;
    uniqueHits: Array<{ id: string; name: string }>;
  }): Promise<string[]> {
    if (uniqueHits.length === 0) {
      return [];
    }

    try {
      const upserted = await this.upsertCompaniesService.execute({
        workspaceId,
        input: {
          projectId,
          companies: uniqueHits,
        },
      });

      if (upserted.success === false) {
        this.logger.warn(
          `upload-profiles company tagging failed for project ${projectId}; continuing without CRM company ids: ${
            upserted.error || 'upsert-companies returned success=false'
          }`,
        );

        return [];
      }

      return Array.isArray(upserted.companyIds) ? upserted.companyIds : [];
    } catch (error) {
      this.logger.warn(
        `upload-profiles company tagging threw for project ${projectId}; continuing without CRM company ids: ${
          error instanceof Error ? error.message : error
        }`,
      );

      return [];
    }
  }

  private resolveRecruiterId(project: ProjectRecord): string {
    const fromRelation = project.recruiterId?.trim() ?? '';

    if (isNonEmptyString(fromRelation)) {
      return fromRelation;
    }

    const fromCreatedBy =
      project.createdBy?.workspaceMemberId?.trim() ??
      project.createdByWorkspaceMemberId?.trim() ??
      '';

    return fromCreatedBy;
  }

  private mergePeople(
    people: UploadProfilesPerson[],
  ): UploadProfilesPerson[] {
    const merged: UploadProfilesPerson[] = [];
    const seen = new Set<string>();

    for (const person of people) {
      const key =
        person.linkedinUrl?.toLowerCase() ||
        person.linkedinProfileId?.toLowerCase() ||
        person.candidateId ||
        `${person.firstName ?? ''}:${person.lastName ?? ''}:${person.name ?? ''}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      merged.push(person);
    }

    return merged;
  }

  private async loadCandidatesAsPeople({
    workspaceId,
    candidateIds,
  }: {
    workspaceId: string;
    candidateIds: string[];
  }): Promise<{ people: UploadProfilesPerson[]; projectId: string }> {
    if (candidateIds.length === 0) {
      return { people: [], projectId: '' };
    }

    const authContext = buildSystemAuthContext(workspaceId);
    const candidates =
      (await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
        async () => {
          const candidateRepository =
            await this.globalWorkspaceOrmManager.getRepository<CandidateRecord>(
              workspaceId,
              'candidate',
              { shouldBypassPermissionChecks: true },
            );
          const found: CandidateRecord[] = [];

          for (const candidateId of candidateIds) {
            const candidate = await candidateRepository.findOne({
              where: { id: candidateId },
            });

            if (isDefined(candidate)) {
              found.push(candidate);
            }
          }

          return found;
        },
        authContext,
      )) ?? [];

    const people = candidates
      .map((candidate) => toUploadProfilesPerson(candidate))
      .filter((person): person is UploadProfilesPerson => person !== null);

    return {
      people,
      projectId: candidates.find((candidate) =>
        isNonEmptyString(candidate.projectsId),
      )?.projectsId?.trim() ?? '',
    };
  }

  private async hydrateUrlOnlyPeople({
    workspaceId,
    people,
  }: {
    workspaceId: string;
    people: UploadProfilesPerson[];
  }): Promise<UploadProfilesPerson[]> {
    const hydrated: UploadProfilesPerson[] = [];

    for (const person of people) {
      if (!linkedinPremiumProfileNeedsFetch(person)) {
        hydrated.push(person);
        continue;
      }

      try {
        const fetched = await this.fetchLinkedinProfileService.execute({
          workspaceId,
          input: {
            linkedinUrl: person.linkedinUrl,
            linkedinProfileId: person.linkedinProfileId,
            candidateId: person.candidateId,
          },
        });
        const mapped = toUploadProfilesPerson(fetched);

        hydrated.push(
          mapped
            ? {
                ...person,
                ...mapped,
                candidateId: person.candidateId ?? mapped.candidateId,
                projectId: person.projectId ?? mapped.projectId,
              }
            : person,
        );
      } catch (error) {
        this.logger.warn(
          `upload-profiles LinkedIn fetch failed for ${person.linkedinUrl}: ${
            error instanceof Error ? error.message : error
          }`,
        );
        hydrated.push(person);
      }
    }

    return hydrated;
  }
}
