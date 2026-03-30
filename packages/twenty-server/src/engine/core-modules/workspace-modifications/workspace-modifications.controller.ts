import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WebSocketService } from 'src/modules/websocket/websocket.service';
import { CreateMetaDataStructure } from './object-apis/object-apis-creation';
import { MetadataUpdateService } from './object-apis/services/metadata-update.service';
import { WorkspaceBulkMetadataUpdateService } from './workspace-bulk-metadata-update.service';
import { WorkspaceQueryService } from './workspace-modifications.service';

@Controller('workspace-modifications')
export class WorkspaceModificationsController {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly webSocketService: WebSocketService,
    private readonly metadataUpdateService: MetadataUpdateService,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly environmentService: EnvironmentService,
    private readonly workspaceBulkMetadataUpdateService: WorkspaceBulkMetadataUpdateService,
  ) {
    console.log('GraphQL URL configured as:', process.env.GRAPHQL_URL);
  }

  @Get('workspace-keys')
  @UseGuards(JwtAuthGuard)
  async getWorkspaceKeys(@Req() req: Request) {
    const { workspace } =
      await this.workspaceQueryService.accessTokenService.validateTokenByRequest(
        req,
      );
    return this.workspaceQueryService.getWorkspaceKeys(workspace.id);
  }


  @Get('fetch-all-current-objects')
  @UseGuards(JwtAuthGuard)
  async fetchAllCurrentObjects(@Req() req) {
    console.log('getWorkspaceKeys');
    const apiToken = req.headers.authorization.split(' ')[1];
    const origin = req.headers['x-origin-domain'] || req.headers.origin;
    // const existingObjectsResponse = await new CreateMetaDataStructure(this.workspaceQueryService).fetchAllCurrentObjects(apiToken);
    const existingObjectsResponse = await new CreateMetaDataStructure(
      this.workspaceQueryService,
      this.staticGraphQLService,
      this.environmentService,
      this.webSocketService,
    ).fetchObjectsNameIdMap(apiToken, origin);

    console.log('existingObjectsResponse:', existingObjectsResponse);

    return existingObjectsResponse;
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
    const user = (req as any).user;
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
  async upgradeToEngagementWorkflows(
    @Headers('authorization') authHeader: string,
    @Req() req: Request,
  ) {
    const token = authHeader?.split(' ')[1];
    const origin = (req.headers.origin as string) || '';
    const { workspace } =
      await this.workspaceQueryService.accessTokenService.validateTokenByRequest(
        req,
      );
    await this.workspaceQueryService.updateWorkspaceKeys(workspace.id, {
      is_org_chart_enabled: 'false',
    });
    try {
      const result = await this.metadataUpdateService.updateMetadata(
        token,
        origin,
      );
      return {
        success: true,
        ...result,
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Metadata update failed';
      throw new HttpException(
        { success: false, message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('create-metadata-structure')
  @UseGuards(JwtAuthGuard)
  async createMetadataStructure(
    @Headers('authorization') authHeader: string,
    @Req() req: Request,
  ) {
    const token = authHeader?.split(' ')[1];
    const origin = (req.headers.origin as string) || '';
    try {
      await this.workspaceQueryService.createMetadataStructure(token, origin);
      return {
        success: true,
        message: 'Metadata structure creation completed',
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Metadata structure creation failed';
      throw new HttpException(
        { success: false, message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('update-metadata-structure')
  @UseGuards(JwtAuthGuard)
  async updateMetadataStructure(
    @Headers('authorization') authHeader: string,
    @Req() req: Request,
  ) {
    const token = authHeader.split(' ')[1];
    const origin = req.headers.origin;
    console.log('Updating metadata structure');
    try {
      const result = await this.metadataUpdateService.updateMetadata(
        token,
        origin || '',
      );
      return { success: true, ...result };
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Metadata structure update failed';
      throw new HttpException(
        { success: false, message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('user')
  @UseGuards(JwtAuthGuard)
  async getUser(@Req() req) {
    const user = req.user;

    console.log('This is the user::', user);

    return { user };
  }

  @Post('update-all-workspaces-metadata')
  @UseGuards(JwtAuthGuard)
  async updateAllWorkspacesMetadata(@Req() req: Request) {
    const user = (req as { user?: { canImpersonate?: boolean } }).user;
    if (!user?.canImpersonate) {
      throw new ForbiddenException('Admin access required');
    }
    const originHeader = req.headers.origin;
    const origin =
      typeof originHeader === 'string' ? originHeader : undefined;
    console.log('origin', origin);
    return this.workspaceBulkMetadataUpdateService.updateAllWorkspacesMetadata(
      origin,
    );
  }
}
