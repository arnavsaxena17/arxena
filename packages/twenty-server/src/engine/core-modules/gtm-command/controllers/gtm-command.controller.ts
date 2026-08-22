import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';

import { GtmInboundReplyWindowService } from 'src/engine/core-modules/gtm-command/jobs/gtm-inbound-reply-window.job';
import { FetchLinkedinMessagesService } from 'src/engine/core-modules/gtm-command/services/fetch-linkedin-messages.service';
import { FetchLinkedinProfileService } from 'src/engine/core-modules/gtm-command/services/fetch-linkedin-profile.service';
import { GtmCommandMaterializeService } from 'src/engine/core-modules/gtm-command/services/gtm-command-materialize.service';
import {
  type GtmEphemeralCompany,
  GtmCompaniesCacheService,
} from 'src/engine/core-modules/gtm-command/services/gtm-companies-cache.service';
import {
  type GtmEphemeralPerson,
  GtmPeopleCacheService,
} from 'src/engine/core-modules/gtm-command/services/gtm-people-cache.service';
import { SearchPeopleForCompanyService } from 'src/engine/core-modules/gtm-command/services/search-people-for-company.service';
import { GtmWorkspaceProfileProvisioningService } from 'src/engine/core-modules/gtm-command/services/gtm-workspace-profile-provisioning.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

@Controller('gtm-command')
export class GtmCommandController {
  private readonly logger = new Logger(GtmCommandController.name);

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly gtmCompaniesCacheService: GtmCompaniesCacheService,
    private readonly gtmPeopleCacheService: GtmPeopleCacheService,
    private readonly searchPeopleForCompanyService: SearchPeopleForCompanyService,
    private readonly fetchLinkedinProfileService: FetchLinkedinProfileService,
    private readonly fetchLinkedinMessagesService: FetchLinkedinMessagesService,
    private readonly gtmInboundReplyWindowService: GtmInboundReplyWindowService,
    private readonly gtmCommandMaterializeService: GtmCommandMaterializeService,
    private readonly gtmWorkspaceProfileProvisioningService: GtmWorkspaceProfileProvisioningService,
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
      companies: GtmEphemeralCompany[];
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
      people: GtmEphemeralPerson[];
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
    body: { companyId?: string; projectId?: string; limit?: number },
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
          preserveSearchBlurbs: true,
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
}
