import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Put,
  Query,
  Req,
} from '@nestjs/common';

import {
  type GtmEphemeralCompany,
  GtmCompaniesCacheService,
} from 'src/engine/core-modules/gtm-command/services/gtm-companies-cache.service';
import {
  type GtmEphemeralPerson,
  GtmPeopleCacheService,
} from 'src/engine/core-modules/gtm-command/services/gtm-people-cache.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

@Controller('gtm-command')
export class GtmCommandController {
  private readonly logger = new Logger(GtmCommandController.name);

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly gtmCompaniesCacheService: GtmCompaniesCacheService,
    private readonly gtmPeopleCacheService: GtmPeopleCacheService,
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
}
