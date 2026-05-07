import {
    Controller,
    Get,
    HttpException,
    HttpStatus,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';

import { Request } from 'express';

import { SerpCompanySearchService } from 'src/engine/core-modules/linkedin-company-search/services/linkedin-company-search.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

@Controller('serp-company-search')
@UseGuards(JwtAuthGuard)
export class SerpCompanySearchController {
  constructor(
    private readonly serpCompanySearchService: SerpCompanySearchService,
  ) {}

  @Get('resolve-company-url')
  async resolveCompanyUrl(
    @Req() req: Request,
    @Query('companyName') companyName: string,
  ) {
    const normalizedCompanyName = companyName?.trim();
    if (!normalizedCompanyName) {
      throw new HttpException(
        'Query parameter "companyName" is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const country = this.extractCountryFromRequest(req);

      return await this.serpCompanySearchService.resolveLinkedinCompanyUrl({
        companyName: normalizedCompanyName,
        country,
      });
    } catch (error) {
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'LinkedIn company URL resolution failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('resolve-company-website-domain')
  async resolveCompanyWebsiteDomain(
    @Req() req: Request,
    @Query('companyName') companyName: string,
  ) {
    const normalizedCompanyName = companyName?.trim();
    if (!normalizedCompanyName) {
      throw new HttpException(
        'Query parameter "companyName" is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const country = this.extractCountryFromRequest(req);

      return await this.serpCompanySearchService.resolveCompanyWebsiteDomain({
        companyName: normalizedCompanyName,
        country,
      });
    } catch (error) {
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Company website domain resolution failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private extractCountryFromRequest(req: Request): string {
    const headersToTry = [
      'cloudfront-viewer-country',
      'cf-ipcountry',
      'x-vercel-ip-country',
      'x-country-code',
    ];

    for (const headerName of headersToTry) {
      const value = req.headers[headerName];
      const normalized =
        typeof value === 'string'
          ? value.trim()
          : (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string'
              ? value[0].trim()
              : '');
      if (normalized) {
        return normalized;
      }
    }

    return 'IN';
  }
}
