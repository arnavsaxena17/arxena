import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';

import { WorkspaceQueryService } from './workspace-modifications.service';

@Controller('workspace-modifications')
export class WorkspaceModificationsController {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly arxenaStandardApplicationService: ArxenaStandardApplicationService,
  ) {}

  @Get('workspace-keys')
  @UseGuards(JwtAuthGuard)
  async getWorkspaceKeys(@Req() req: Request) {
    const { workspace } =
      await this.workspaceQueryService.accessTokenService.validateTokenByRequest(
        req,
      );
    return this.workspaceQueryService.getWorkspaceKeys(workspace.id);
  }

  @Get('workspace-keys/:keyName')
  @UseGuards(JwtAuthGuard)
  async getSpecificWorkspaceKey(
    @Req() req: Request,
    @Param('keyName') keyName: string,
  ) {
    const { workspace } =
      await this.workspaceQueryService.accessTokenService.validateTokenByRequest(
        req,
      );

    return this.workspaceQueryService.getSpecificWorkspaceKey(
      workspace.id,
      keyName,
    );
  }

  @Post('admin/workspace-keys')
  @UseGuards(JwtAuthGuard)
  async adminUpdateWorkspaceKeys(
    @Req() req: Request,
    @Body()
    body: {
      workspaceId: string;
      is_org_chart_enabled: string;
    },
  ) {
    const user = (req as { user?: { canImpersonate?: boolean } }).user;
    if (!user?.canImpersonate) {
      throw new ForbiddenException('Admin access required');
    }
    if (!body.workspaceId || body.is_org_chart_enabled === undefined) {
      throw new BadRequestException(
        'workspaceId and is_org_chart_enabled are required',
      );
    }
    await this.workspaceQueryService.updateWorkspaceKeys(body.workspaceId, {
      is_org_chart_enabled: body.is_org_chart_enabled,
    });
    return { success: true };
  }

  @Post('workspace-keys')
  @UseGuards(JwtAuthGuard)
  async updateWorkspaceKeys(
    @Req() req: Request,
    @Body()
    keys: {
      openaikey?: string;
      twilio_account_sid?: string;
      twilio_auth_token?: string;
      linkedin_url?: string;
      whatsapp_key?: string;
      anthropic_key?: string;
      facebook_whatsapp_api_token?: string;
      facebook_whatsapp_phone_number_id?: string;
      facebook_whatsapp_app_id?: string;
      whatsapp_web_phone_number?: string;
      linkedin_unipile_account_id?: string;
      linkedin_profile_id?: string;
      is_chrome_extension_installed?: string;
      chrome_extension_id?: string;
      is_org_chart_enabled?: string;
    },
  ) {
    const { workspace } =
      await this.workspaceQueryService.accessTokenService.validateTokenByRequest(
        req,
      );
    return this.workspaceQueryService.updateWorkspaceKeys(
      workspace.id,
      keys,
    );
  }

  @Post('upgrade-to-engagement-workflows')
  @UseGuards(JwtAuthGuard)
  async upgradeToEngagementWorkflows(@Req() req: Request) {
    const { workspace } =
      await this.workspaceQueryService.accessTokenService.validateTokenByRequest(
        req,
      );

    await this.workspaceQueryService.updateWorkspaceKeys(workspace.id, {
      is_org_chart_enabled: 'false',
    });

    try {
      await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
        {
          workspaceId: workspace.id,
          isOrgChartEnabled: false,
        },
      );

      return {
        success: true,
        message:
          'Upgraded to Engagement Workflows and synced Arxena standard metadata',
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Arxena standard metadata sync failed';

      throw new HttpException(
        { success: false, message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('user')
  @UseGuards(JwtAuthGuard)
  async getUser(@Req() req: Request) {
    return { user: req.user };
  }
}
