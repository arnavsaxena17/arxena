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

import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

import { buildPeopleApiOpenApiDocument } from '../api-docs/people-api.openapi';
import { PeopleSearchDto } from './dto/people-search.dto';
import { TitleFromJobSearchDto } from './dto/title-from-job-search.dto';
import { PeopleApiService } from './people-api.service';

@Controller('people-api')
export class PeopleApiController {
  private readonly logger = new Logger(PeopleApiController.name);

  constructor(private readonly peopleApiService: PeopleApiService) {}

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

  @Get('taxonomy/function-roots')
  @UseGuards(JwtAuthGuard)
  async getFunctionRoots(@Query('title') title?: string) {
    return this.peopleApiService.getFunctionRoots(title);
  }

  @Get('taxonomy/functions')
  @UseGuards(JwtAuthGuard)
  async getFunctions(
    @Query('function_root') functionRoot?: string,
    @Query('title') title?: string,
  ) {
    return this.peopleApiService.getFunctions(functionRoot, title);
  }

  @Get('taxonomy/grades')
  @UseGuards(JwtAuthGuard)
  async getGrades(
    @Query('grade_level') gradeLevel?: string,
    @Query('title') title?: string,
  ) {
    return this.peopleApiService.getGrades(gradeLevel, title);
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
}
