import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';

import { Request } from 'express';

import { BrightDataBusinessSearchDto } from 'src/engine/core-modules/bright-data/dto/bright-data-business-search.dto';
import { SearchBrightDataBusinessTool } from 'src/engine/core-modules/tool/tools/bright-data-business-search-tool/search-bright-data-business-tool';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

const BODY_VALIDATION_PIPE = new ValidationPipe({
  transform: true,
  whitelist: true,
});

@Controller('bright-data/business-search')
@UseGuards(JwtAuthGuard)
export class BrightDataBusinessSearchController {
  private readonly logger = new Logger(
    BrightDataBusinessSearchController.name,
  );

  constructor(
    private readonly searchBrightDataBusinessTool: SearchBrightDataBusinessTool,
  ) {}

  @Post('company')
  searchCompanies(
    @Req() request: Request,
    @Body(BODY_VALIDATION_PIPE) body: BrightDataBusinessSearchDto,
  ) {
    return this.search('company', request, body);
  }

  @Post('people')
  searchPeople(
    @Req() request: Request,
    @Body(BODY_VALIDATION_PIPE) body: BrightDataBusinessSearchDto,
  ) {
    return this.search('people', request, body);
  }

  private async search(
    entity: 'company' | 'people',
    request: Request,
    body: BrightDataBusinessSearchDto,
  ) {
    const workspaceId = request.workspace?.id;

    if (!workspaceId) {
      throw new HttpException(
        'Workspace context required',
        HttpStatus.UNAUTHORIZED,
      );
    }

    try {
      return await this.searchBrightDataBusinessTool.execute(
        {
          entity,
          query: body.query,
          mode: body.mode,
          limit: body.limit,
          offset: body.offset,
          view: body.view,
          projectId: body.projectId,
          planId: body.planId,
          maxBudgetUsd: body.maxBudgetUsd,
          targetCount: body.targetCount,
          autoExecute: body.autoExecute,
        },
        { workspaceId },
      );
    } catch (error) {
      this.logger.error(`Bright Data ${entity} search failed`, error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Bright Data search failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
