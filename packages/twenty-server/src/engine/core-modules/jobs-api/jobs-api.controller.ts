import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Req,
  Res,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';

import { Request, Response } from 'express';

import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

import { buildJobsApiOpenApiDocument } from '../api-docs/jobs-api.openapi';
import { JobSearchDto } from './dto/job-search.dto';
import { JobApiService } from './jobs-api.service';

const JOBS_API_BODY_VALIDATION_PIPE = new ValidationPipe({
  transform: true,
  whitelist: true,
});

@Controller('jobs-api')
export class JobsApiController {
  private readonly logger = new Logger(JobsApiController.name);

  constructor(private readonly jobApiService: JobApiService) {}

  @Get('openapi.json')
  getOpenApiSchema(@Req() request: Request, @Res() res: Response) {
    const serverUrl = `${request.protocol}://${request.get('host')}`;
    const document = buildJobsApiOpenApiDocument(serverUrl);

    res.setHeader('Content-Type', 'application/json');
    res.send(document);
  }

  @Get('data-sources')
  @UseGuards(JwtAuthGuard)
  getDataSources() {
    return this.jobApiService.getDataSourcesStatus();
  }

  @Post('jobs/search')
  @UseGuards(JwtAuthGuard)
  async searchJobs(
    @Req() request: Request,
    @Body(JOBS_API_BODY_VALIDATION_PIPE) body: JobSearchDto,
  ) {
    try {
      return await this.jobApiService.searchJobs(
        body,
        this.getAuthToken(request) ?? undefined,
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Jobs API search failed', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Job search failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private getAuthToken(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice('Bearer '.length).trim() || null;
    }
    return null;
  }
}
