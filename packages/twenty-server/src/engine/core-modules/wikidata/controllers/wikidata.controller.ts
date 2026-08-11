import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';

import { isNonEmptyString } from 'twenty-shared/utils';

import { WikidataCompanySearchService } from 'src/engine/core-modules/wikidata/services/wikidata-company-search.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

@Controller('wikidata')
@UseGuards(JwtAuthGuard)
export class WikidataController {
  constructor(
    private readonly wikidataCompanySearchService: WikidataCompanySearchService,
  ) {}

  // Resolve company details from an official website / domain via Wikidata P856
  @Get('companies/by-domain')
  async searchCompaniesByDomain(@Query('domain') domain?: string) {
    if (!isNonEmptyString(domain?.trim())) {
      throw new HttpException(
        'Query parameter "domain" is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      return await this.wikidataCompanySearchService.searchByDomain(domain);
    } catch (error) {
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Wikidata company domain search failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('companies/by-name')
  async searchCompaniesByName(
    @Query('name') name?: string,
    @Query('limit') limit?: string,
  ) {
    if (!isNonEmptyString(name?.trim())) {
      throw new HttpException(
        'Query parameter "name" is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const parsedLimit = limit ? Number(limit) : undefined;

    try {
      return await this.wikidataCompanySearchService.searchByName(name, {
        limit:
          typeof parsedLimit === 'number' && Number.isFinite(parsedLimit)
            ? parsedLimit
            : undefined,
      });
    } catch (error) {
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Wikidata company name search failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
