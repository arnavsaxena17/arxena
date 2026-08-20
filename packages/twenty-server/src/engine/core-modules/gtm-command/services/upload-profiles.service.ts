import { Injectable, Logger } from '@nestjs/common';
import { v4 } from 'uuid';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { type ObjectLiteral } from 'typeorm';

import { ProcessCandidatesService } from 'src/engine/core-modules/candidate-sourcing/jobs/process-candidates.service';
import { GtmWorkspaceAuthTokenService } from 'src/engine/core-modules/gtm-command/services/gtm-workspace-auth-token.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

type ProjectRecord = ObjectLiteral & {
  id: string;
  name?: string | null;
  recruiterId?: string | null;
};

export type UploadProfilesPerson = {
  name?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  headline?: string;
  company?: string;
  companyName?: string;
  location?: string;
  linkedinUrl?: string;
  linkedinProfileId?: string;
  peopleId?: string;
  profilePictureUrl?: string;
};

export type UploadProfilesInput = {
  projectId?: string;
  people?: UploadProfilesPerson[];
  candidates?: unknown[];
  recruiterId?: string;
  workspaceMemberId?: string;
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
    const people = Array.isArray(input.people) ? input.people : [];
    const candidates = Array.isArray(input.candidates) ? input.candidates : [];
    const limit = Math.min(Math.max(1, input.limit ?? 25), 50);

    if (!isNonEmptyString(projectId)) {
      return {
        success: false,
        queued: 0,
        projectId: '',
        error: 'projectId is required',
      };
    }

    const rows = (candidates.length > 0 ? candidates : people).slice(0, limit);

    if (rows.length === 0) {
      return {
        success: false,
        queued: 0,
        projectId,
        error: 'people or candidates is required',
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
    const recruiterId =
      input.recruiterId?.trim() ||
      input.workspaceMemberId?.trim() ||
      project.recruiterId ||
      '';
    const mapped = rows.map((row) => this.toLinkedinSearchRow(row));

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
          select: ['id', 'name', 'recruiterId'],
        });
      },
      authContext,
    );
  }

  private toLinkedinSearchRow(row: unknown): Record<string, unknown> {
    if (typeof row !== 'object' || row === null) {
      return {};
    }

    const person = row as UploadProfilesPerson & Record<string, unknown>;
    const linkedinUrl =
      (typeof person.linkedinUrl === 'string' ? person.linkedinUrl : '') ||
      (typeof person.linkedinProfileId === 'string'
        ? `https://www.linkedin.com/in/${person.linkedinProfileId}`
        : '');

    return {
      ...person,
      name: person.name ?? '',
      firstName: person.firstName ?? '',
      lastName: person.lastName ?? '',
      jobTitle: person.title ?? person.headline ?? '',
      headline: person.headline ?? person.title ?? '',
      company: person.company ?? person.companyName ?? '',
      location: person.location ?? '',
      linkedinUrl,
      profileUrl: linkedinUrl,
    };
  }
}
