import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WebSocketService } from 'src/modules/websocket/websocket.service';
import { In } from 'typeorm';
import { CreateMetaDataStructure } from './object-apis/object-apis-creation';
import { MetadataUpdateService } from './object-apis/services/metadata-update.service';
import { WorkspaceQueryService } from './workspace-modifications.service';
  

@Controller('workspace-modifications')
export class WorkspaceModificationsController {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly webSocketService: WebSocketService,
    private readonly metadataUpdateService: MetadataUpdateService,
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {
    console.log('GraphQL URL configured as:', process.env.GRAPHQL_URL);
  }

  @Get('api-keys')
  @UseGuards(JwtAuthGuard)
  async getWorkspaceApiKeys(@Req() req: Request) {
    console.log('getWorkspaceApiKeys');
    const { workspace } =
      await this.workspaceQueryService.accessTokenService.validateTokenByRequest(
        req,
      );
    console.log('workspace:', workspace);
    return this.workspaceQueryService.getWorkspaceApiKeys(workspace.id);
  }


  @Get('fetch-all-current-objects')
  @UseGuards(JwtAuthGuard)
  async fetchAllCurrentObjects(@Req() req) {
    console.log('getWorkspaceApiKeys');
    const apiToken = req.headers.authorization.split(' ')[1];
    // const existingObjectsResponse = await new CreateMetaDataStructure(this.workspaceQueryService).fetchAllCurrentObjects(apiToken);
    const existingObjectsResponse = await new CreateMetaDataStructure(
      this.workspaceQueryService,
      this.staticGraphQLService,

    ).fetchObjectsNameIdMap(apiToken);

    console.log('existingObjectsResponse:', existingObjectsResponse);

    return existingObjectsResponse;
  }

  @Get('api-keys/:keyName')
  @UseGuards(JwtAuthGuard)
  async getSpecificApiKey(
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

  @Post('api-keys')
  @UseGuards(JwtAuthGuard)
  async updateWorkspaceApiKeys(
    @Req() req: Request,
    @Body()
    keys: {
      openaikey?: string;
      twilioAccountSid?: string;
      twilioAuthToken?: string;
      linkedinUrl?: string;
      whatsappKey?: string;
      anthropicKey?: string;
      facebookWhatsappApiToken?: string;
      facebookWhatsappPhoneNumberId?: string;
      facebookWhatsappAppId?: string;
      whatsappWebPhoneNumber?:string;
    },
  ) {
    const { workspace } =
      await this.workspaceQueryService.accessTokenService.validateTokenByRequest(
        req,
      );

    return this.workspaceQueryService.updateWorkspaceApiKeys(
      workspace.id,
      keys,
    );
  }
  @Post('create-metadata-structure')
  @UseGuards(JwtAuthGuard)
  async createMetadataStructure(@Headers('authorization') authHeader: string) {
    const token = authHeader.split(' ')[1];
    // Fire and forget - don't await the promise
    this.workspaceQueryService.createMetadataStructure(token).catch(error => {
      console.error('Error in background metadata structure creation:', error);
    });
    return { message: 'Metadata structure creation initiated' };
  }

  @Post('update-metadata-structure')
  @UseGuards(JwtAuthGuard)
  async updateMetadataStructure(@Headers('authorization') authHeader: string) {
    const token = authHeader.split(' ')[1];
    console.log("Updating metadata structure");
    const result = await this.metadataUpdateService.updateMetadata(token);
    return result;
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
    const { workspace } =
      await this.workspaceQueryService.accessTokenService.validateTokenByRequest(
        req,
      );
    const workspaceIds = await this.workspaceQueryService.getWorkspaces();
    const dataSources = await this.workspaceQueryService.dataSourceRepository.find({
      where: { workspaceId: In(workspaceIds) },
    });
    const uniqueWorkspaceIds = Array.from(
      new Set(dataSources.map((ds) => ds.workspaceId)),
    );
    const origin = process.env.APPLE_ORIGIN_URL || 'http://localhost:3001';
    for (const workspaceId of uniqueWorkspaceIds) {
      const schema = this.workspaceQueryService.workspaceDataSourceService.getSchemaName(
        workspaceId,
      );
      const apiKeys = await this.workspaceQueryService.getApiKeys(
        workspaceId,
        schema,
      );
      if (!apiKeys.length) {
        console.log(`No API keys found for workspace ${workspaceId}, skipping...`);
        continue;
      }
      const token = await this.workspaceQueryService.apiKeyService.generateApiKeyToken(
        workspaceId,
        apiKeys[0].id,
      );
      if (!token?.token) {
        console.log(`Failed to generate token for workspace ${workspaceId}, skipping...`);
        continue;
      }
      try {
        const result = await this.metadataUpdateService.updateMetadata(token.token);
        console.log(`Updated metadata for workspace ${workspaceId}:`, result);
      } catch (error) {
        console.error(`Error updating metadata for workspace ${workspaceId}:`, error);
      }
    }
    return { message: 'Started updating metadata for all workspaces' };
  }
}
