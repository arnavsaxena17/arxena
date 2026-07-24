import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { Request } from 'express';

import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

import { OrgChartEmbedService } from './org-chart-embed.service';
import type {
  CreateOrgChartEmbedInput,
  OrgChartEmbedConfig,
  UpdateOrgChartEmbedInput,
} from './org-chart-embed.types';

@Controller('org-chart/embed')
export class OrgChartEmbedController {
  private readonly logger = new Logger(OrgChartEmbedController.name);

  constructor(
    private readonly orgChartEmbedService: OrgChartEmbedService,
    private readonly workspaceQueryService: WorkspaceQueryService,
  ) {}

  private getAuthToken(req: Request): string | undefined {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    const cookies = req.headers.cookie;
    if (cookies) {
      const match = cookies.match(/auth_token=([^;]+)/);
      if (match) {
        return match[1];
      }
    }
    return undefined;
  }

  private async getWorkspaceIdFromRequest(req: Request): Promise<string> {
    const authToken = this.getAuthToken(req);
    if (!authToken) {
      throw new HttpException('Authentication required', HttpStatus.UNAUTHORIZED);
    }
    if (!(req as { user?: unknown }).user) {
      throw new HttpException('Authentication required', HttpStatus.UNAUTHORIZED);
    }
    const workspaceId =
      await this.workspaceQueryService.getWorkspaceIdFromToken(authToken);
    if (!workspaceId) {
      throw new HttpException('Workspace not found', HttpStatus.UNAUTHORIZED);
    }
    return workspaceId;
  }

  private toPublicConfig(config: OrgChartEmbedConfig) {
    return {
      id: config.id,
      embedKey: config.embedKey,
      name: config.name,
      allowedOrigins: config.allowedOrigins,
      mode: config.mode,
      companyDomain: config.companyDomain,
      publishSlug: config.publishSlug,
      allowedDomains: config.allowedDomains,
      options: config.options,
      rateLimitPerMinute: config.rateLimitPerMinute,
      expiresAt: config.expiresAt,
      revokedAt: config.revokedAt,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  @Get('resolve')
  async resolveEmbed(
    @Query('domain') domain: string | undefined,
    @Req() req: Request,
  ) {
    const embedKey =
      req.headers['x-embed-key']?.toString() ??
      req.query['embedKey']?.toString() ??
      '';

    if (!embedKey.trim()) {
      throw new HttpException('X-Embed-Key header is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.orgChartEmbedService.resolveEmbedChart({
        embedKey: embedKey.trim(),
        domain,
        origin: req.headers.origin ?? null,
        referer: req.headers.referer ?? null,
      });

      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Embed resolve failed', error);
      throw new HttpException(
        'Failed to resolve embed org chart',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('event')
  async postEmbedEvent(
    @Body()
    body: {
      eventName?: 'embed.node_clicked';
      embedKey?: string;
      node?: Record<string, unknown>;
      companyId?: string;
      companyName?: string;
    },
    @Req() req: Request,
  ) {
    const embedKey =
      body.embedKey?.trim() ||
      req.headers['x-embed-key']?.toString()?.trim() ||
      '';

    if (!embedKey) {
      throw new HttpException('embedKey is required', HttpStatus.BAD_REQUEST);
    }

    if (body.eventName !== 'embed.node_clicked') {
      throw new HttpException('Unsupported event', HttpStatus.BAD_REQUEST);
    }

    const config = await this.orgChartEmbedService.getActiveEmbedByKey(embedKey);

    const requestOrigin = req.headers.origin ?? req.headers.referer ?? null;
    const allowed = await this.orgChartEmbedService.isOriginAllowedForEmbed(
      embedKey,
      typeof requestOrigin === 'string' ? requestOrigin : null,
    );

    if (!allowed) {
      throw new HttpException('Origin not allowed', HttpStatus.FORBIDDEN);
    }

    await this.orgChartEmbedService.emitNodeClickedEvent({
      workspaceId: config.workspaceId,
      embedKey,
      node: body.node ?? {},
      companyId: body.companyId,
      companyName: body.companyName,
    });

    return { status: 'ok' as const };
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async createEmbed(
    @Body() body: CreateOrgChartEmbedInput,
    @Req() req: Request,
  ) {
    const workspaceId = await this.getWorkspaceIdFromRequest(req);
    const config = await this.orgChartEmbedService.createEmbed(
      workspaceId,
      body,
    );
    return { status: 'ok' as const, embed: this.toPublicConfig(config) };
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async listEmbeds(@Req() req: Request) {
    const workspaceId = await this.getWorkspaceIdFromRequest(req);
    const embeds = await this.orgChartEmbedService.listEmbeds(workspaceId);
    return {
      status: 'ok' as const,
      embeds: embeds.map((embed) => this.toPublicConfig(embed)),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':embedKey')
  async getEmbed(@Param('embedKey') embedKey: string, @Req() req: Request) {
    const workspaceId = await this.getWorkspaceIdFromRequest(req);
    const config = await this.orgChartEmbedService.getEmbedForWorkspace(
      workspaceId,
      embedKey,
    );
    const usageToday = await this.orgChartEmbedService.getUsageCount(embedKey);
    const usageMonthly =
      await this.orgChartEmbedService.getMonthlyUsageCount(embedKey);
    return {
      status: 'ok' as const,
      embed: this.toPublicConfig(config),
      usageToday,
      usageMonthly,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':embedKey')
  async updateEmbed(
    @Param('embedKey') embedKey: string,
    @Body() body: UpdateOrgChartEmbedInput,
    @Req() req: Request,
  ) {
    const workspaceId = await this.getWorkspaceIdFromRequest(req);
    const config = await this.orgChartEmbedService.updateEmbed(
      workspaceId,
      embedKey,
      body,
    );
    return { status: 'ok' as const, embed: this.toPublicConfig(config) };
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':embedKey')
  async revokeEmbed(@Param('embedKey') embedKey: string, @Req() req: Request) {
    const workspaceId = await this.getWorkspaceIdFromRequest(req);
    const config = await this.orgChartEmbedService.revokeEmbed(
      workspaceId,
      embedKey,
    );
    return { status: 'ok' as const, embed: this.toPublicConfig(config) };
  }
}
