import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';

import { Request, Response } from 'express';
import { isDefined } from 'twenty-shared/utils';

import { ThrottlerException } from 'src/engine/core-modules/throttler/throttler.exception';
import { ThrottlerService } from 'src/engine/core-modules/throttler/throttler.service';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

import { buildPeopleApiOpenApiDocument } from '../api-docs/people-api.openapi';
import { ExpandJobTitlesDto } from './dto/expand-job-titles.dto';
import { PeopleSearchDto } from './dto/people-search.dto';
import { TaxonomyBooleanStringsDto } from './dto/taxonomy-boolean-strings.dto';
import { TitleFromJobSearchDto } from './dto/title-from-job-search.dto';
import { PeopleApiService } from './people-api.service';

@Controller('people-api')
export class PeopleApiController {
  private readonly logger = new Logger(PeopleApiController.name);

  constructor(
    private readonly peopleApiService: PeopleApiService,
    private readonly throttlerService: ThrottlerService,
    private readonly twentyConfigService: TwentyConfigService,
  ) {}

  @Get('openapi.json')
  getOpenApiSchema(@Req() request: Request, @Res() res: Response) {
    const serverUrl = `${request.protocol}://${request.get('host')}`;
    const document = buildPeopleApiOpenApiDocument(serverUrl);

    res.setHeader('Content-Type', 'application/json');
    res.send(document);
  }

  @Get('data-sources')
  @UseGuards(JwtAuthGuard)
  getDataSources() {
    return this.peopleApiService.getDataSourcesStatus();
  }

  // Public nouns only — flat constants, no classify, no trees.
  @Get('taxonomy/constants')
  getTaxonomyConstants() {
    return this.peopleApiService.getTaxonomyConstants();
  }

  @Get('taxonomy/function-roots')
  @UseGuards(JwtAuthGuard)
  async getFunctionRoots(
    @Req() request: Request,
    @Query('title') title?: string,
  ) {
    await this.throttleTaxonomyBrowse(request);

    return this.peopleApiService.getFunctionRoots(title);
  }

  @Get('taxonomy/functions')
  @UseGuards(JwtAuthGuard)
  async getFunctions(
    @Req() request: Request,
    @Query('function_root') functionRoot?: string,
    @Query('title') title?: string,
  ) {
    await this.throttleTaxonomyBrowse(request);

    return this.peopleApiService.getFunctions(functionRoot, title);
  }

  @Get('taxonomy/grades')
  @UseGuards(JwtAuthGuard)
  async getGrades(
    @Req() request: Request,
    @Query('grade_level') gradeLevel?: string,
    @Query('title') title?: string,
  ) {
    await this.throttleTaxonomyBrowse(request);

    return this.peopleApiService.getGrades(gradeLevel, title);
  }

  @Get('taxonomy/boolean-strings')
  @UseGuards(JwtAuthGuard)
  async getTaxonomyBooleanStrings(
    @Req() request: Request,
    @Query('std_function') stdFunction?: string,
    @Query('std_grade') stdGrade?: string,
    @Query('std_function_root') stdFunctionRoot?: string,
    @Query('company_name') companyName?: string,
  ) {
    try {
      await this.throttleTaxonomyBrowse(request);

      const dto: TaxonomyBooleanStringsDto = {
        stdFunction,
        stdGrade,
        stdFunctionRoot,
        companyName,
      };

      return await this.peopleApiService.getTaxonomyBooleanStrings(dto);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('People API taxonomy boolean-strings failed', error);
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Taxonomy boolean-strings failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('titles/expand')
  @UseGuards(JwtAuthGuard)
  async expandJobTitles(
    @Req() request: Request,
    @Query('job_title') jobTitle: string,
    @Query('company_name') companyName?: string,
  ) {
    try {
      await this.throttleTaxonomyBrowse(request);

      const dto: ExpandJobTitlesDto = { jobTitle, companyName };

      return await this.peopleApiService.expandJobTitles(dto);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('People API titles expand failed', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Title expansion failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('people/search-by-title')
  @UseGuards(JwtAuthGuard)
  async searchPeopleByJobTitle(@Body() body: TitleFromJobSearchDto) {
    try {
      return await this.peopleApiService.searchPeopleByJobTitle(body);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('People API search-by-title failed', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'People search by title failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('people/search')
  @UseGuards(JwtAuthGuard)
  async searchPeople(@Body() body: PeopleSearchDto) {
    try {
      return await this.peopleApiService.searchPeople(body);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('People API search failed', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'People search failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Soft cap bulk taxonomy scraping per workspace (auth still required).
  private async throttleTaxonomyBrowse(request: Request): Promise<void> {
    const workspaceId = request.workspace?.id;
    if (!isDefined(workspaceId)) {
      return;
    }

    const limit = this.twentyConfigService.get(
      'API_RATE_LIMITING_LONG_LIMIT',
    );
    const ttlMs = this.twentyConfigService.get(
      'API_RATE_LIMITING_LONG_TTL_IN_MS',
    );

    try {
      await this.throttlerService.tokenBucketThrottleOrThrow(
        `people-api-taxonomy:throttler:${workspaceId}`,
        1,
        limit,
        ttlMs,
      );
    } catch (error) {
      if (error instanceof ThrottlerException) {
        throw new HttpException(
          'People API taxonomy rate limit exceeded. Retry later.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw error;
    }
  }
}
