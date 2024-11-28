import { Controller, Post, Body, UploadedFiles, Req, UseInterceptors, BadRequestException, UseGuards, InternalServerErrorException, HttpException } from '@nestjs/common';


import { AuthGuard } from '@nestjs/passport';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { GraphQLClient } from 'graphql-request';
import axios from 'axios';
import * as multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';

import { TokenService } from 'src/engine/core-modules/auth/services/token.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt.auth.guard';
import { TranscriptionService } from '../video-interview/transcription.service';
import { WorkspaceQueryService } from './workspace-modifications.service';
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
    private readonly transcriptionService: TranscriptionService,

  ) {
    console.log('GraphQL URL configured as:', process.env.GRAPHQL_URL);
    console.log('JWT Secret present:', !!process.env.TWENTY_JWT_SECRET);

  }


  @Post('add-openai-key')
  @UseGuards(JwtAuthGuard)
  async addOpenAIKey(@Req() req, @Body() interviewData: { aIInterviewId: string }) {
    const apiToken = req.headers.authorization.split(' ')[1]; // Assuming Bearer token
    // const panda = this.workspaceQueryService.executeQueryAcrossWorkspaces(async (workspaceId, dataSourceSchema) => {


    const { user, workspace } = await this.workspaceQueryService.tokenService.validateToken(req);
    // Ensure the openAIKey column exists
    const alterTableQuery = `
      ALTER TABLE core.workspace
      ADD COLUMN IF NOT EXISTS openaikey varchar(255);
    `;
    await this.workspaceQueryService.executeRawQuery(alterTableQuery, [], workspace.id);

    const query = `
      UPDATE core.workspace
      SET openaikey = $1
      WHERE id = $2
    `;
    const params = [interviewData.aIInterviewId, workspace.id];

    try {
      await this.workspaceQueryService.executeRawQuery(query, params, workspace.id);
      return { success: true };
    } catch (error) {
      throw new InternalServerErrorException('Failed to update OpenAI key');
    }    
  };
}