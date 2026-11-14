import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

import { EsCompaniesSearchDto } from '../dto/es-companies-search.dto';
import { EsPeopleSearchDto } from '../dto/es-people-search.dto';
import { EsResolveCompanyNameDto } from '../dto/es-resolve-company-name.dto';
import { CompaniesEsService } from '../services/companies-es.service';
import { CompanyNameResolverService } from '../services/company-name-resolver.service';
import { OrgChartEsService } from '../services/org-chart-es.service';
import { PeopleEsService } from '../services/people-es.service';

@Controller('elasticsearch-search')
@UseGuards(JwtAuthGuard)
export class ElasticsearchSearchController {
  private readonly logger = new Logger(ElasticsearchSearchController.name);

  constructor(
    private readonly peopleEsService: PeopleEsService,
    private readonly companiesEsService: CompaniesEsService,
    private readonly companyNameResolverService: CompanyNameResolverService,
    private readonly orgChartEsService: OrgChartEsService,
  ) {}

  @Get('status')
  getStatus() {
    return {
      status: 'ok',
      elasticsearch: {
        people: {
          enabled: this.peopleEsService.isEnabled(),
          index: this.peopleEsService.getIndexName(),
        },
        companies: {
          enabled: this.companiesEsService.isEnabled(),
          searchIndex: this.companiesEsService.getIndexName(),
          fallbackIndex: this.companiesEsService.getFallbackIndexName(),
          legacyIndex: this.companiesEsService.getLegacyIndexName(),
        },
        companyNameResolver: {
          enabled: this.companyNameResolverService.isEnabled(),
          index: this.companyNameResolverService.getIndexName(),
        },
        orgcharts: {
          enabled: this.orgChartEsService.isEnabled(),
          index: this.orgChartEsService.getIndexName(),
        },
      },
    };
  }

  @Post('people')
  async searchPeople(@Body() body: EsPeopleSearchDto) {
    if (!this.peopleEsService.isEnabled()) {
      throw new HttpException(
        'People Elasticsearch index is not configured (set ES_ENDPOINT)',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const hasFilter =
      !!body.query?.trim() ||
      !!body.personName?.trim() ||
      !!body.jobTitle?.trim() ||
      !!body.companyId?.trim() ||
      !!body.companyName?.trim() ||
      !!body.website?.trim() ||
      !!body.stdFunction?.trim() ||
      !!body.stdGrade?.trim() ||
      !!body.country?.trim() ||
      !!body.linkedinUrl?.trim();

    if (!hasFilter) {
      throw new HttpException(
        'At least one search filter is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const result = await this.peopleEsService.searchPeople(body);
      return { status: 'ok', ...result };
    } catch (error) {
      this.logger.error('People ES search failed', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'People search failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('companies')
  async searchCompanies(@Body() body: EsCompaniesSearchDto) {
    if (!this.companiesEsService.isEnabled()) {
      throw new HttpException(
        'Companies Elasticsearch index is not configured (set ES_ENDPOINT)',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const hasFilter =
      !!body.query?.trim() ||
      !!body.companyName?.trim() ||
      !!body.companyId?.trim() ||
      !!body.website?.trim() ||
      !!body.industry?.trim();

    if (!hasFilter) {
      throw new HttpException(
        'At least one search filter is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const result = await this.companiesEsService.searchCompanies(body);
      return { status: 'ok', ...result };
    } catch (error) {
      this.logger.error('Companies ES search failed', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Companies search failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('resolve-company-name')
  async resolveCompanyName(@Body() body: EsResolveCompanyNameDto) {
    if (!this.companyNameResolverService.isEnabled()) {
      throw new HttpException(
        'Company name resolver is not configured (set ES_ENDPOINT)',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const companyNames = [
      ...(Array.isArray(body.companyNames) ? body.companyNames : []),
      ...(typeof body.companyName === 'string' ? [body.companyName] : []),
    ]
      .map((name) => name.trim())
      .filter((name) => name.length > 0);

    if (companyNames.length === 0) {
      throw new HttpException(
        'companyName or companyNames is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const results =
        companyNames.length === 1
          ? [
              await this.companyNameResolverService.resolveFromRawCompanyName(
                companyNames[0],
              ),
            ]
          : await this.companyNameResolverService.resolveMany(companyNames);

      return {
        status: 'ok',
        index: this.companyNameResolverService.getIndexName(),
        count: results.length,
        results,
      };
    } catch (error) {
      this.logger.error('Company name resolve failed', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Company name resolve failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
