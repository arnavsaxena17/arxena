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

import axios from 'axios';
import { Request } from 'express';

import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WebSocketService } from 'src/modules/websocket/websocket.service';

import { WorkspaceQueryService } from './workspace-modifications.service';

import { CreateMetaDataStructure } from './object-apis/object-apis-creation';
import { MetadataUpdateService } from './object-apis/services/metadata-update.service';

export async function axiosRequest(data: string, apiToken: string) {
  // console.log("Sending a post request to the graphql server:: with data", data);
  const response = await axios.request({
    method: 'post',
    url: process.env.GRAPHQL_URL,
    headers: { authorization: 'Bearer ' + apiToken, 'content-type': 'application/json' },
    data: data,
    timeout: 10000,
  });

  if (response.data.errors) {
    console.log(
      'Error axiosRequest',
      response.data,
      'for grapqhl request of ::',
      data,
    );
  }

  return response;
}

@Controller('workspace-modifications')
export class WorkspaceModificationsController {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly webSocketService: WebSocketService,
    private readonly metadataUpdateService: MetadataUpdateService,
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
    await this.workspaceQueryService.createMetadataStructure(token);
    return { message: 'Metadata structure creation initiated' };
  }

  @Post('update-metadata-structure')
  @UseGuards(JwtAuthGuard)
  async updateMetadataStructure(@Headers('authorization') authHeader: string) {
    const token = authHeader.split(' ')[1];
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
}
