import { Controller, Post, Body, UploadedFiles, Req, UseInterceptors, BadRequestException, UseGuards, InternalServerErrorException, HttpException, Get, Param } from '@nestjs/common';

import axios from 'axios';
import { JwtAuthGuard } from 'src/engine/guards/jwt.auth.guard';
import { WorkspaceQueryService } from './workspace-modifications.service';
import {CreateMetaDataStructure} from './object-apis/object-apis-creation';
export async function axiosRequest(data: string, apiToken: string) {
  // console.log("Sending a post request to the graphql server:: with data", data);
  const response = await axios.request({
    method: 'post',
    url: process.env.GRAPHQL_URL,
    headers: {
      authorization: 'Bearer ' + apiToken,
      'content-type': 'application/json',
    },
    data: data,
  });
  return response;
}

@Controller('workspace-modifications')
export class WorkspaceModificationsController {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
  ) {
    console.log('GraphQL URL configured as:', process.env.GRAPHQL_URL);
    console.log('JWT Secret present:', !!process.env.TWENTY_JWT_SECRET);
  }

  @Get('api-keys')
  @UseGuards(JwtAuthGuard)
  async getWorkspaceApiKeys(@Req() req) {
    console.log("getWorkspaceApiKeys")
    const { workspace } = await this.workspaceQueryService.tokenService.validateToken(req);
    console.log("workspace:", workspace)
    return this.workspaceQueryService.getWorkspaceApiKeys(workspace.id);
  }

  @Get('api-keys/:keyName')
  @UseGuards(JwtAuthGuard)
  async getSpecificApiKey(@Req() req, @Param('keyName') keyName: string) {
    const { workspace } = await this.workspaceQueryService.tokenService.validateToken(req);
    return this.workspaceQueryService.getSpecificWorkspaceKey(workspace.id, keyName);
  }


  // Backend controller modification
  @Post('api-keys')
  @UseGuards(JwtAuthGuard)
  async updateWorkspaceApiKeys(@Req() req, @Body() keys: {
    openaikey?: string;
    twilioAccountSid?: string;
    twilioAuthToken?: string;
    smartProxyUrl?: string;
    whatsappKey?: string;
    anthropicKey?: string;
    facebookWhatsappApiToken?: string;
    facebookWhatsappPhoneNumberId?: string;
    facebookWhatsappAppId?: string;
  }) {
    const { workspace } = await this.workspaceQueryService.tokenService.validateToken(req);
    return this.workspaceQueryService.updateWorkspaceApiKeys(workspace.id, keys);
  }

  @Post('create-metadata-structure')
  @UseGuards(JwtAuthGuard)
  async createMetaDataStructure(@Req() req) {
    const apiToken = req.headers.authorization.split(' ')[1];
    new CreateMetaDataStructure(this.workspaceQueryService).createMetadataStructure(apiToken);
    return
  }




  @Get('user')
  @UseGuards(JwtAuthGuard)
  async getUser(@Req() req) {
    const user = req.user;
    return { user };
  }

}
