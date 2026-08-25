import { Injectable, Logger } from '@nestjs/common';
import { v4 } from 'uuid';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { type ObjectLiteral } from 'typeorm';

import { ProcessCandidatesService } from 'src/engine/core-modules/candidate-sourcing/jobs/process-candidates.service';
import { GtmWorkspaceAuthTokenService } from 'src/engine/core-modules/gtm-command/services/gtm-workspace-auth-token.service';
import { mapUploadProfileToLinkedinSearchRow } from 'src/engine/core-modules/gtm-command/utils/map-upload-profile-to-linkedin-search-row.util';
import {
  normalizeUploadPeople,
  type UploadProfilesPerson,
} from 'src/engine/core-modules/gtm-command/utils/normalize-upload-people.util';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

type ProjectRecord = ObjectLiteral & {
  id: string;
  name?: string | null;
  recruiterId?: string | null;
  createdBy?: { workspaceMemberId?: string | null } | null;
  createdByWorkspaceMemberId?: string | null;
};

export type { UploadProfilesPerson };

export type UploadProfilesInput = {
  projectId?: string;
  companyId?: string;
  people?: unknown;
  candidates?: unknown;
  linkedinUrl?: string;
  limit?: number;
};

@Injectable()
export class UploadProfilesService {
  private readonly logger = new Logger(UploadProfilesService.name);

  constructor(
    private readonly processCandidatesService: ProcessCandidatesService,
    private readonly gtmWorkspaceAuthTokenService: GtmWorkspaceAuthTokenService,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async execute({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: UploadProfilesInput;
  }): Promise<{
    success: boolean;
    queued: number;
    projectId: string;
    error?: string;
  }> {
    const projectId = input.projectId?.trim() ?? '';
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
    const limit = Math.min(Math.max(1, input.limit ?? 25), 50);

    if (!isNonEmptyString(projectId)) {
      return {
        success: false,
        queued: 0,
        projectId: '',
        error: 'projectId is required',
      };
    }

    const rows = fromPayload.slice(0, limit);

    if (rows.length === 0) {
      return {
        success: false,
        queued: 0,
        projectId,
        error: 'people is required',
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
    const mapped = rows.map((row) =>
      mapUploadProfileToLinkedinSearchRow(row, companyId),
    );

    await this.processCandidatesService.queueRawDataForProcessing(
      mapped,
      'linkedin_search',
      projectId,
      project.name || 'GTM Outreach',
      recruiterId,
      new Date().toISOString(),
      'gtm-workflow-upload-profiles',
      apiToken,
      v4(),
    );

    this.logger.log(
      `upload-profiles queued ${mapped.length} profiles for project ${projectId}`,
    );

    return {
      success: true,
      queued: mapped.length,
      projectId,
      error: '',
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
}
