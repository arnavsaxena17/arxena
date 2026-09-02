import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';

import { OutreachInboundReplyWindowService } from 'src/engine/core-modules/outreach-command/jobs/outreach-inbound-reply-window.job';
import { FetchLinkedinMessagesService } from 'src/engine/core-modules/outreach-command/services/fetch-linkedin-messages.service';
import { FetchLinkedinProfileService } from 'src/engine/core-modules/outreach-command/services/fetch-linkedin-profile.service';
import { OutreachFakeProfileDetectorService } from 'src/engine/core-modules/outreach-command/services/outreach-fake-profile-detector.service';
import { OutreachFilterProfilesService } from 'src/engine/core-modules/outreach-command/services/outreach-filter-profiles.service';
import { OutreachCommandMaterializeService } from 'src/engine/core-modules/outreach-command/services/outreach-command-materialize.service';
import {
  type OutreachEphemeralCompany,
  OutreachCompaniesCacheService,
} from 'src/engine/core-modules/outreach-command/services/outreach-companies-cache.service';
import {
  type OutreachEphemeralPerson,
  OutreachPeopleCacheService,
} from 'src/engine/core-modules/outreach-command/services/outreach-people-cache.service';
import { SearchPeopleForCompanyService } from 'src/engine/core-modules/outreach-command/services/search-people-for-company.service';
import { OutreachWorkspaceProfileProvisioningService } from 'src/engine/core-modules/outreach-command/services/outreach-workspace-profile-provisioning.service';
import { OutreachProjectOutreachControlService } from 'src/engine/core-modules/outreach-command/services/outreach-project-outreach-control.service';
import { OutreachCandidateJourneyService } from 'src/engine/core-modules/outreach-command/services/outreach-candidate-journey.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

@Controller('outreach-command')
export class OutreachCommandController {
  private readonly logger = new Logger(OutreachCommandController.name);

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly gtmCompaniesCacheService: OutreachCompaniesCacheService,
    private readonly gtmPeopleCacheService: OutreachPeopleCacheService,
    private readonly searchPeopleForCompanyService: SearchPeopleForCompanyService,
    private readonly fetchLinkedinProfileService: FetchLinkedinProfileService,
    private readonly fetchLinkedinMessagesService: FetchLinkedinMessagesService,
    private readonly gtmInboundReplyWindowService: OutreachInboundReplyWindowService,
    private readonly gtmCommandMaterializeService: OutreachCommandMaterializeService,
    private readonly gtmWorkspaceProfileProvisioningService: OutreachWorkspaceProfileProvisioningService,
    private readonly gtmFakeProfileDetectorService: OutreachFakeProfileDetectorService,
    private readonly gtmFilterProfilesService: OutreachFilterProfilesService,
    private readonly gtmProjectOutreachControlService: OutreachProjectOutreachControlService,
    private readonly outreachCandidateJourneyService: OutreachCandidateJourneyService,
  ) {}

  @Get('cache/companies')
  async getEphemeralCompanies(
    @Query('projectId') projectId: string,
    @Req() request: { headers?: { authorization?: string } },
  ) {
    try {
      const apiToken = request.headers?.authorization?.replace?.('Bearer ', '');

      if (!apiToken) {
        throw new HttpException(
          'API token is required',
          HttpStatus.UNAUTHORIZED,
        );
      }

      if (!projectId || projectId === 'project-id') {
        throw new HttpException(
          'projectId is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      const workspaceId =
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const payload = await this.gtmCompaniesCacheService.get(
        workspaceId,
        projectId,
      );

      if (!payload) {
        return {
          companies: [],
          projectId,
          cachedAt: null,
        };
      }

      return {
        companies: payload.companies,
        projectId: payload.projectId,
        cachedAt: payload.cachedAt,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Failed to get GTM companies cache', error);
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Failed to get GTM companies cache',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('cache/companies')
  async setEphemeralCompanies(
    @Body()
    body: {
      projectId: string;
      companies: OutreachEphemeralCompany[];
    },
    @Req() request: { headers?: { authorization?: string } },
  ) {
    try {
      const apiToken = request.headers?.authorization?.replace?.('Bearer ', '');

      if (!apiToken) {
        throw new HttpException(
          'API token is required',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const projectId = body?.projectId;

      if (!projectId || projectId === 'project-id') {
        throw new HttpException(
          'projectId is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!Array.isArray(body?.companies)) {
        throw new HttpException(
          'companies must be an array',
          HttpStatus.BAD_REQUEST,
        );
      }

      const workspaceId =
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);

      await this.gtmCompaniesCacheService.set(
        workspaceId,
        projectId,
        body.companies,
      );

      return {
        ok: true,
        projectId,
        count: body.companies.length,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Failed to set GTM companies cache', error);
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Failed to set GTM companies cache',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('cache/people')
  async getEphemeralPeople(
    @Query('projectId') projectId: string,
    @Req() request: { headers?: { authorization?: string } },
  ) {
    try {
      const apiToken = request.headers?.authorization?.replace?.('Bearer ', '');

      if (!apiToken) {
        throw new HttpException(
          'API token is required',
          HttpStatus.UNAUTHORIZED,
        );
      }

      if (!projectId || projectId === 'project-id') {
        throw new HttpException(
          'projectId is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      const workspaceId =
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const payload = await this.gtmPeopleCacheService.get(
        workspaceId,
        projectId,
      );

      if (!payload) {
        return {
          people: [],
          projectId,
          cachedAt: null,
        };
      }

      return {
        people: payload.people,
        projectId: payload.projectId,
        cachedAt: payload.cachedAt,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Failed to get GTM people cache', error);
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Failed to get GTM people cache',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('cache/people')
  async setEphemeralPeople(
    @Body()
    body: {
      projectId: string;
      people: OutreachEphemeralPerson[];
    },
    @Req() request: { headers?: { authorization?: string } },
  ) {
    try {
      const apiToken = request.headers?.authorization?.replace?.('Bearer ', '');

      if (!apiToken) {
        throw new HttpException(
          'API token is required',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const projectId = body?.projectId;

      if (!projectId || projectId === 'project-id') {
        throw new HttpException(
          'projectId is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!Array.isArray(body?.people)) {
        throw new HttpException(
          'people must be an array',
          HttpStatus.BAD_REQUEST,
        );
      }

      const workspaceId =
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);

      await this.gtmPeopleCacheService.set(
        workspaceId,
        projectId,
        body.people,
      );

      return {
        ok: true,
        projectId,
        count: body.people.length,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Failed to set GTM people cache', error);
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Failed to set GTM people cache',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('search-people-for-company')
  async searchPeopleForCompany(
    @Body()
    body: {
      companyId?: string;
      projectId?: string;
      jobTitle?: string;
      limit?: number;
    },
    @Req() request: { headers?: { authorization?: string } },
  ) {
    const apiToken = request.headers?.authorization?.replace?.('Bearer ', '');

    if (!apiToken) {
      throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
    }

    const workspaceId =
      await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);

    return this.searchPeopleForCompanyService.execute({
      workspaceId,
      input: {
        companyId: body.companyId ?? '',
        projectId: body.projectId,
        jobTitle: body.jobTitle,
        limit: body.limit,
      },
    });
  }

  @Post('fetch-linkedin-profile')
  async fetchLinkedinProfile(
    @Body()
    body: {
      workspaceMemberId?: string;
      linkedinUrl?: string;
      linkedinProfileId?: string;
      candidateId?: string;
    },
    @Req() request: { headers?: { authorization?: string } },
  ) {
    const apiToken = request.headers?.authorization?.replace?.('Bearer ', '');

    if (!apiToken) {
      throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
    }

    const workspaceId =
      await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);

    return this.fetchLinkedinProfileService.execute({
      workspaceId,
      input: body,
    });
  }

  @Post('fetch-linkedin-messages')
  async fetchLinkedinMessages(
    @Body()
    body: {
      workspaceMemberId?: string;
      linkedinUrl?: string;
      linkedinProfileId?: string;
      candidateId?: string;
      limit?: number;
    },
    @Req() request: { headers?: { authorization?: string } },
  ) {
    const apiToken = request.headers?.authorization?.replace?.('Bearer ', '');

    if (!apiToken) {
      throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
    }

    const workspaceId =
      await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    const workspaceMemberIdFromToken =
      await this.workspaceQueryService.getWorkspaceMemberIdFromToken(apiToken);

    return this.fetchLinkedinMessagesService.execute({
      workspaceId,
      input: {
        ...body,
        workspaceMemberId:
          body.workspaceMemberId ?? workspaceMemberIdFromToken ?? undefined,
      },
    });
  }

  @Post('inbound-window')
  async scheduleInboundWindow(
    @Body()
    body: { candidateId?: string; delayMinutes?: number },
    @Req() request: { headers?: { authorization?: string } },
  ) {
    const apiToken = request.headers?.authorization?.replace?.('Bearer ', '');

    if (!apiToken) {
      throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
    }

    if (!body.candidateId) {
      throw new HttpException(
        'candidateId is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const workspaceId =
      await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);

    await this.gtmInboundReplyWindowService.schedule({
      workspaceId,
      candidateId: body.candidateId,
      delayMinutes: body.delayMinutes,
      apiToken,
    });

    return { ok: true, candidateId: body.candidateId };
  }

  @Post('detect-fake-profiles')
  async detectFakeProfiles(
    @Body()
    body: {
      profile?: unknown;
      snapshot?: unknown;
      profiles?: unknown;
      modelId?: string;
    },
    @Req() request: { headers?: { authorization?: string } },
  ) {
    const apiToken = request.headers?.authorization?.replace?.('Bearer ', '');

    if (!apiToken) {
      throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
    }

    const workspaceId =
      await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);

    return this.gtmFakeProfileDetectorService.execute({
      workspaceId,
      input: body,
    });
  }

  @Post('filter-profiles')
  async filterProfiles(
    @Body()
    body: {
      profiles?: unknown;
      profile?: unknown;
      snapshot?: unknown;
      prompt?: string;
      modelId?: string;
      onlyOnePersonPerCompany?: boolean | string;
    },
    @Req() request: { headers?: { authorization?: string } },
  ) {
    const apiToken = request.headers?.authorization?.replace?.('Bearer ', '');

    if (!apiToken) {
      throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
    }

    const workspaceId =
      await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);

    return this.gtmFilterProfilesService.execute({
      workspaceId,
      input: body,
    });
  }

  @Post('workspace-profile/regenerate')
  async regenerateWorkspaceProfile(
    @Body()
    body: {
      userEmail?: string;
      workspaceDisplayName?: string;
      userFirstName?: string;
      userLastName?: string;
    },
    @Req() request: { headers?: { authorization?: string } },
  ) {
    const apiToken = request.headers?.authorization?.replace?.('Bearer ', '');

    if (!apiToken) {
      throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
    }

    try {
      const workspaceId =
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);

      await this.gtmWorkspaceProfileProvisioningService.regenerateWorkspaceProfile(
        {
          workspaceId,
          userEmail: body?.userEmail,
          workspaceDisplayName: body?.workspaceDisplayName,
          userFirstName: body?.userFirstName,
          userLastName: body?.userLastName,
          force: true,
        },
      );

      return { ok: true };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Failed to regenerate GTM workspace profile', error);
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Failed to regenerate GTM workspace profile',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('projects/:projectId/pause')
  async pauseProjectOutreach(
    @Param('projectId') projectId: string,
    @Req() request: { headers?: { authorization?: string } },
  ) {
    return this.setProjectOutreachStatus({
      projectId,
      request,
      action: 'pause',
    });
  }

  @Post('projects/:projectId/resume')
  async resumeProjectOutreach(
    @Param('projectId') projectId: string,
    @Req() request: { headers?: { authorization?: string } },
  ) {
    return this.setProjectOutreachStatus({
      projectId,
      request,
      action: 'resume',
    });
  }

  @Post('projects/:projectId/candidates/stop')
  async stopCandidateOutreach(
    @Param('projectId') projectId: string,
    @Body() body: { candidateIds?: string[] },
    @Req() request: { headers?: { authorization?: string } },
  ) {
    const apiToken = request.headers?.authorization?.replace?.('Bearer ', '');

    if (!apiToken) {
      throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
    }

    if (!projectId) {
      throw new HttpException('projectId is required', HttpStatus.BAD_REQUEST);
    }

    const candidateIds = Array.isArray(body?.candidateIds)
      ? body.candidateIds.filter((id): id is string => typeof id === 'string')
      : [];

    if (candidateIds.length === 0) {
      throw new HttpException(
        'candidateIds is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const workspaceId =
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const result = await this.gtmProjectOutreachControlService.stopCandidates({
        workspaceId,
        projectId,
        candidateIds,
      });

      return { ok: true, ...result };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Failed to stop GTM candidate outreach', error);
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Failed to stop candidate outreach',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async setProjectOutreachStatus({
    projectId,
    request,
    action,
  }: {
    projectId: string;
    request: { headers?: { authorization?: string } };
    action: 'pause' | 'resume';
  }) {
    const apiToken = request.headers?.authorization?.replace?.('Bearer ', '');

    if (!apiToken) {
      throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
    }

    if (!projectId) {
      throw new HttpException('projectId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const workspaceId =
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);

      if (action === 'pause') {
        const result = await this.gtmProjectOutreachControlService.pauseProject({
          workspaceId,
          projectId,
        });

        return { ok: true, outreachStatus: 'PAUSED', ...result };
      }

      const result = await this.gtmProjectOutreachControlService.resumeProject({
        workspaceId,
        projectId,
      });

      return { ok: true, outreachStatus: 'LIVE', ...result };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Failed to ${action} GTM project outreach`, error);
      throw new HttpException(
        error instanceof Error
          ? error.message
          : `Failed to ${action} GTM project outreach`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('projects/:projectId/journey-summary')
  async getProjectJourneySummary(
    @Param('projectId') projectId: string,
    @Req() request: { headers?: { authorization?: string } },
  ) {
    return this.withOutreachAuth({ projectId, request }, async (workspaceId) =>
      this.outreachCandidateJourneyService.getProjectSummary({
        workspaceId,
        projectId,
      }),
    );
  }

  @Get('projects/:projectId/candidates/:candidateId/journey')
  async getCandidateJourney(
    @Param('projectId') projectId: string,
    @Param('candidateId') candidateId: string,
    @Req() request: { headers?: { authorization?: string } },
  ) {
    return this.withOutreachAuth({ projectId, request }, async (workspaceId) => {
      const journey = await this.outreachCandidateJourneyService.getJourney({
        workspaceId,
        projectId,
        candidateId,
      });

      if (!journey) {
        throw new HttpException('Candidate not found', HttpStatus.NOT_FOUND);
      }

      return journey;
    });
  }

  @Post('projects/:projectId/candidates/:candidateId/pause')
  async pauseCandidateJourney(
    @Param('projectId') projectId: string,
    @Param('candidateId') candidateId: string,
    @Req() request: { headers?: { authorization?: string } },
  ) {
    return this.withOutreachAuth({ projectId, request }, async (workspaceId) =>
      this.outreachCandidateJourneyService.pauseCandidate({
        workspaceId,
        projectId,
        candidateId,
      }),
    );
  }

  @Post('projects/:projectId/candidates/:candidateId/resume')
  async resumeCandidateJourney(
    @Param('projectId') projectId: string,
    @Param('candidateId') candidateId: string,
    @Req() request: { headers?: { authorization?: string } },
  ) {
    return this.withOutreachAuth({ projectId, request }, async (workspaceId) =>
      this.outreachCandidateJourneyService.resumeCandidate({
        workspaceId,
        projectId,
        candidateId,
      }),
    );
  }

  @Post('projects/:projectId/candidates/:candidateId/snooze')
  async snoozeCandidateJourney(
    @Param('projectId') projectId: string,
    @Param('candidateId') candidateId: string,
    @Body() body: { resumeAt?: string },
    @Req() request: { headers?: { authorization?: string } },
  ) {
    if (!body?.resumeAt) {
      throw new HttpException('resumeAt is required', HttpStatus.BAD_REQUEST);
    }

    return this.withOutreachAuth({ projectId, request }, async (workspaceId) =>
      this.outreachCandidateJourneyService.snoozeCandidate({
        workspaceId,
        projectId,
        candidateId,
        resumeAt: body.resumeAt,
      }),
    );
  }

  @Post('projects/:projectId/candidates/:candidateId/skip-step')
  async skipCandidateDelayStep(
    @Param('projectId') projectId: string,
    @Param('candidateId') candidateId: string,
    @Body() body: { workflowRunId?: string; stepId?: string },
    @Req() request: { headers?: { authorization?: string } },
  ) {
    if (!body?.workflowRunId || !body?.stepId) {
      throw new HttpException(
        'workflowRunId and stepId are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.withOutreachAuth({ projectId, request }, async (workspaceId) =>
      this.outreachCandidateJourneyService.skipDelayStep({
        workspaceId,
        projectId,
        candidateId,
        workflowRunId: body.workflowRunId,
        stepId: body.stepId,
      }),
    );
  }

  @Post('projects/:projectId/candidates/:candidateId/approve-form')
  async approveCandidateFormStep(
    @Param('projectId') projectId: string,
    @Param('candidateId') candidateId: string,
    @Body()
    body: {
      workflowRunId?: string;
      stepId?: string;
      response?: object;
    },
    @Req() request: { headers?: { authorization?: string } },
  ) {
    if (!body?.workflowRunId || !body?.stepId || !body?.response) {
      throw new HttpException(
        'workflowRunId, stepId, and response are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.withOutreachAuth({ projectId, request }, async (workspaceId) =>
      this.outreachCandidateJourneyService.approveFormStep({
        workspaceId,
        projectId,
        candidateId,
        workflowRunId: body.workflowRunId,
        stepId: body.stepId,
        response: body.response,
      }),
    );
  }

  private async withOutreachAuth<T>(
    {
      projectId,
      request,
    }: {
      projectId: string;
      request: { headers?: { authorization?: string } };
    },
    handler: (workspaceId: string) => Promise<T>,
  ): Promise<T> {
    const apiToken = request.headers?.authorization?.replace?.('Bearer ', '');

    if (!apiToken) {
      throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
    }

    if (!projectId) {
      throw new HttpException('projectId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const workspaceId =
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);

      return await handler(workspaceId);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Outreach journey request failed', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Outreach journey request failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
