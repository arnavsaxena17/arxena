import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { Request } from 'express';
import { isNonEmptyString } from '@sniptt/guards';

import { OrgChartClientIpService } from 'src/engine/core-modules/org-chart/services/org-chart-client-ip.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { WebsiteTrackerService } from 'src/engine/core-modules/website-tracker/website-tracker.service';
import { normalizeWebsiteHostname } from 'src/engine/core-modules/website-tracker/website-tracker.types';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

@Controller('website-tracker')
export class WebsiteTrackerController {
  private readonly logger = new Logger(WebsiteTrackerController.name);

  constructor(
    private readonly websiteTrackerService: WebsiteTrackerService,
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

  // Public beacon — no JWT. GDPR: caller must obtain consent before firing for EU.
  @Post('collect')
  async collect(
    @Req() req: Request,
    @Body()
    body: {
      appId?: string;
      path?: string;
      pageUrl?: string;
      referrer?: string;
      hostDomain?: string;
    },
    @Headers('origin') origin?: string,
    @Headers('referer') referer?: string,
    @Headers('x-forwarded-for') xff?: string,
  ) {
    const ip =
      OrgChartClientIpService.extractClientIpFromRequest(req) ??
      (xff ? xff.split(',')[0].trim() : null) ??
      (req.ip as string | undefined) ??
      null;

    if (!ip) {
      return { ok: false, error: 'could not determine client ip' };
    }

    const appId = body.appId?.trim();
    if (!isNonEmptyString(appId)) {
      return { ok: false, error: 'appId is required' };
    }

    return this.websiteTrackerService.collect(ip, {
      appId,
      path: body.path,
      pageUrl: body.pageUrl,
      referrer: body.referrer ?? referer,
      origin: origin ?? null,
      hostDomain: body.hostDomain ?? null,
    });
  }

  // Compat GET beacon (pixel-style)
  @Get('collect')
  async collectGet(
    @Req() req: Request,
    @Query('appId') appId?: string,
    @Query('path') path?: string,
    @Query('pageUrl') pageUrl?: string,
    @Query('referrer') referrer?: string,
    @Query('hostDomain') hostDomain?: string,
    @Headers('origin') origin?: string,
    @Headers('referer') referer?: string,
    @Headers('x-forwarded-for') xff?: string,
  ) {
    return this.collect(
      req,
      { appId, path, pageUrl, referrer, hostDomain },
      origin,
      referer,
      xff,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('snippet')
  async getSnippet(@Req() req: Request) {
    const workspaceId = await this.getWorkspaceIdFromRequest(req);
    const result =
      await this.websiteTrackerService.ensureTrackingAppId(workspaceId);
    return { status: 'ok', ...result };
  }

  @UseGuards(JwtAuthGuard)
  @Post('enabled')
  async setEnabled(
    @Req() req: Request,
    @Body() body: { enabled?: boolean },
  ) {
    const workspaceId = await this.getWorkspaceIdFromRequest(req);
    await this.websiteTrackerService.setTrackingEnabled(
      workspaceId,
      body.enabled === true,
    );
    return { status: 'ok', enabled: body.enabled === true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('domains')
  async listDomains(@Req() req: Request) {
    const workspaceId = await this.getWorkspaceIdFromRequest(req);
    const domains = await this.websiteTrackerService.listDomains(workspaceId);
    return { status: 'ok', domains };
  }

  @UseGuards(JwtAuthGuard)
  @Get('visitors')
  async listVisitors(@Req() req: Request) {
    const workspaceId = await this.getWorkspaceIdFromRequest(req);
    const visitors =
      await this.websiteTrackerService.listVisitors(workspaceId);
    return { status: 'ok', visitors };
  }

  @UseGuards(JwtAuthGuard)
  @Post('domains')
  async createDomain(
    @Req() req: Request,
    @Body() body: { domain?: string; url?: string },
  ) {
    const workspaceId = await this.getWorkspaceIdFromRequest(req);
    const raw = body.domain ?? body.url;
    if (!isNonEmptyString(raw) || !normalizeWebsiteHostname(raw)) {
      throw new HttpException('Valid domain is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const domain = await this.websiteTrackerService.createDomain(
        workspaceId,
        raw,
      );
      return { status: 'ok', domain };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`createDomain failed: ${message}`);
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Delete('domains/:domainId')
  async deleteDomain(
    @Param('domainId') domainId: string,
    @Req() req: Request,
  ) {
    const workspaceId = await this.getWorkspaceIdFromRequest(req);
    await this.websiteTrackerService.deleteDomain(workspaceId, domainId);
    return { status: 'ok' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('domains/:domainId/test-connection')
  async testConnection(
    @Param('domainId') domainId: string,
    @Req() req: Request,
  ) {
    const workspaceId = await this.getWorkspaceIdFromRequest(req);
    try {
      const result = await this.websiteTrackerService.testConnection(
        workspaceId,
        domainId,
      );
      return { status: 'ok', ...result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }
}
