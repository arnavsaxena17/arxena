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

  @Post('workspace-keys')
  @UseGuards(JwtAuthGuard)
  async updateWorkspaceKeys(
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
      whatsappWebPhoneNumber?: string;
      linkedinUnipileAccountId?: string;
      linkedinProfileId?: string;
      linkedinCookieAuth?: string;
      isChromeExtensionInstalled?: string;
      chromeExtensionId?: string;
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
  @Post('create-metadata-structure')
  @UseGuards(JwtAuthGuard)
  async createMetadataStructure(@Headers('authorization') authHeader: string, @Req() req: Request) {
    const token = authHeader.split(' ')[1];
    const origin = req.headers.origin;
    // Fire and forget - don't await the promise
    this.workspaceQueryService.createMetadataStructure(token, origin || '').catch(error => {
      console.error('Error in background metadata structure creation:', error);
    });
    return { message: 'Metadata structure creation initiated' };
  }

  @Post('update-metadata-structure')
  @UseGuards(JwtAuthGuard)
  async updateMetadataStructure(@Headers('authorization') authHeader: string, @Req() req: Request) {
    const token = authHeader.split(' ')[1];
    const origin = req.headers.origin;
    console.log("Updating metadata structure");
    const result = await this.metadataUpdateService.updateMetadata(token, origin || '');
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
    const origin = req.headers.origin;
    console.log('origin', origin);
    const results: Array<{
      workspaceId: string;
      metadataUpdate: any;
      indicesCreation: string | null;
      errors: string[];
    }> = [];
    
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
      
      const workspaceResult: {
        workspaceId: string;
        metadataUpdate: any;
        indicesCreation: string | null;
        errors: string[];
      } = {
        workspaceId,
        metadataUpdate: null,
        indicesCreation: null,
        errors: []
      };
      
      try {
        // Update metadata
        const metadataResult = await this.metadataUpdateService.updateMetadata(token.token, origin || '');
        workspaceResult.metadataUpdate = metadataResult;
        console.log(`Updated metadata for workspace ${workspaceId}:`, metadataResult);
      } catch (error) {
        console.error(`Error updating metadata for workspace ${workspaceId}:`, error);
        workspaceResult.errors.push(`Metadata update error: ${error.message}`);
      }
      
      try {
        // Create database indices
        const createMetaDataStructure = new CreateMetaDataStructure(
          this.workspaceQueryService,
          this.staticGraphQLService,
          this.webSocketService,
        );
        await createMetaDataStructure.createDatabaseIndices(token.token);
        workspaceResult.indicesCreation = 'Database indices created successfully';
        console.log(`Created database indices for workspace ${workspaceId}`);
      } catch (error) {
        console.error(`Error creating database indices for workspace ${workspaceId}:`, error);
        workspaceResult.errors.push(`Indices creation error: ${error.message}`);
      }
      
      results.push(workspaceResult);
    }
    
    return { 
      message: 'Updated metadata and created indices for all workspaces',
      results 
    };
  }
}
