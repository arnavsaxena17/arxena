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

import { buildCompanyApiOpenApiDocument } from 'src/engine/core-modules/api-docs/company-api.openapi';
import { EntitySearchService } from '../core/entity-search.service';
import { CompanySearchDto } from './dto/company-search.dto';

const COMPANY_API_BODY_VALIDATION_PIPE = new ValidationPipe({
  transform: true,
  whitelist: true,
});

@Controller('company-api')
export class CompanyApiController {
  private readonly logger = new Logger(CompanyApiController.name);

  constructor(private readonly entitySearchService: EntitySearchService) {}

  @Get('openapi.json')
  getOpenApiSchema(@Req() request: Request, @Res() res: Response) {
    const serverUrl = `${request.protocol}://${request.get('host')}`;
    const document = buildCompanyApiOpenApiDocument(serverUrl);

    res.setHeader('Content-Type', 'application/json');
    res.send(document);
  }

  @Get('data-sources')
  @UseGuards(JwtAuthGuard)
  getDataSources() {
    return this.entitySearchService.getCompanyDataSourcesStatus();
  }

  @Post('companies/search')
  @UseGuards(JwtAuthGuard)
  async searchCompanies(
    @Req() request: Request,
    @Body(COMPANY_API_BODY_VALIDATION_PIPE) body: CompanySearchDto,
  ) {
    try {
      return await this.entitySearchService.searchCompanies(
        body,
        this.getAuthToken(request) ?? undefined,
        { workspaceId: request.workspace?.id },
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Company API search failed', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Company search failed',
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
