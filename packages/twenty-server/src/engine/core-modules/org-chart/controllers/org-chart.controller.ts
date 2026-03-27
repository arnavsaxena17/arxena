import {
    Body,
    Controller,
    Get,
    HttpException,
    HttpStatus,
    Logger,
    Param,
    Post,
    Query,
    Req,
    Res,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { ApifyEmployeeCountService } from 'src/engine/core-modules/apify/services/apify-employee-count.service';
import { UnipileCompanyService } from 'src/engine/core-modules/arx-chat/services/unipile-company.service';
import { WorkspaceMemberProfileUnipileService } from 'src/engine/core-modules/arx-chat/services/workspace-member-profile-unipile.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { CompanyAutocompleteDto } from '../dto/company-autocomplete.dto';
import { OrgChartNodePeopleDto } from '../dto/org-chart-node-people.dto';
import { OrgChartQueryDto } from '../dto/org-chart-query.dto';
import { CompanyLogoService } from '../services/company-logo.service';
import { ImageProxyService } from '../services/image-proxy.service';
import { OrgChartClientIpService } from '../services/org-chart-client-ip.service';
import { OrgChartEsService } from '../services/org-chart-es.service';
import { OrgChartTheOrgEnrichmentService } from '../services/org-chart-theorg-enrichment.service';
import { OrgChartLinkedInBuildService } from '../services/org-chart-linkedin-build.service';
import { OrgChartService } from '../services/org-chart.service';

@Controller('org-chart')
export class OrgChartController {
  private readonly logger = new Logger(OrgChartController.name);

  constructor(
    private readonly orgChartService: OrgChartService,
    private readonly orgChartLinkedInBuildService: OrgChartLinkedInBuildService,
    private readonly orgChartEsService: OrgChartEsService,
    private readonly orgChartTheOrgEnrichmentService: OrgChartTheOrgEnrichmentService,
    private readonly companyLogoService: CompanyLogoService,
    private readonly imageProxyService: ImageProxyService,
    private readonly apifyEmployeeCountService: ApifyEmployeeCountService,
    private readonly unipileCompanyService: UnipileCompanyService,
    private readonly workspaceMemberProfileUnipileService: WorkspaceMemberProfileUnipileService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly orgChartClientIpService: OrgChartClientIpService,
  ) {}

  private getAuthToken(req: Request): string | undefined {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    const cookies = req.headers.cookie;
    if (cookies) {
      const match = cookies.match(/auth_token=([^;]+)/);
      if (match) return match[1];
    }
    return undefined;
  }

  private proxyOrgChartPayload(
    result: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.imageProxyService.proxyImagesInPayload(result);
  }

  @Get('company-logo')
  async getCompanyLogo(
    @Query('website') website: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!website?.trim()) {
      throw new HttpException(
        'Query parameter "website" is required',
        HttpStatus.BAD_REQUEST,
      );
    }
    const { ok, contentType, body } =
      await this.companyLogoService.fetchLogoByWebsite(website);
    if (!ok || body.byteLength === 0) {
      res.status(404).send();
      return;
    }
    res.setHeader(
      'Content-Type',
      contentType ?? 'image/png',
    );
    res.send(Buffer.from(body));
  }

  /**
   * Proxy external images (e.g. LinkedIn profile photos) so the response
   * can set Cross-Origin-Resource-Policy and avoid CORP blocking in the browser.
   */
  @Get('image-proxy')
  async getImageProxy(
    @Query('url') url: string,
    @Res() res: Response,
  ) {
    const legacyUrl = url?.trim() ?? '';

    if (!legacyUrl) {
      throw new HttpException(
        'Query parameter "url" is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const decodedUrl = decodeURIComponent(legacyUrl);

    if (!decodedUrl) {
      res.status(404).send();
      return;
    }

    const { ok, contentType, body } =
      await this.imageProxyService.fetchImage(decodedUrl);
    if (!ok || body.byteLength === 0) {
      res.status(404).send();
      return;
    }
    res.setHeader('Content-Type', contentType ?? 'image/jpeg');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(Buffer.from(body));
  }

  @Get('image-proxy/:bucket/:identifierA/:identifierB')
  async getImageProxyByIdentifiers(
    @Param('bucket') bucket: string,
    @Param('identifierA') identifierA: string,
    @Param('identifierB') identifierB: string,
    @Res() res: Response,
  ) {
    const decodedUrl = this.imageProxyService.resolveUrlFromDeterministicPath(
      bucket,
      identifierA,
      identifierB,
    );

    if (!decodedUrl) {
      res.status(404).send();
      return;
    }

    const { ok, contentType, body } =
      await this.imageProxyService.fetchImage(decodedUrl);
    if (!ok || body.byteLength === 0) {
      res.status(404).send();
      return;
    }
    res.setHeader('Content-Type', contentType ?? 'image/jpeg');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(Buffer.from(body));
  }

  @Get('image-proxy/:bucket/:identifierA/:identifierB/:identifierC')
  async getImageProxyByThreeIdentifiers(
    @Param('bucket') bucket: string,
    @Param('identifierA') identifierA: string,
    @Param('identifierB') identifierB: string,
    @Param('identifierC') identifierC: string,
    @Res() res: Response,
  ) {
    const decodedUrl = this.imageProxyService.resolveUrlFromDeterministicPath(
      bucket,
      identifierA,
      identifierB,
      identifierC,
    );

    if (!decodedUrl) {
      res.status(404).send();
      return;
    }

    const { ok, contentType, body } =
      await this.imageProxyService.fetchImage(decodedUrl);
    if (!ok || body.byteLength === 0) {
      res.status(404).send();
      return;
    }
    res.setHeader('Content-Type', contentType ?? 'image/jpeg');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(Buffer.from(body));
  }

  @Get('companies/sitemap-index')
  async getSitemapIndex() {
    try {
      const companyIds =
        await this.orgChartEsService.getIndexedCompanyIds(500);
      return { companyIds, status: 'ok' };
    } catch (error) {
      this.logger.error('Get sitemap index failed', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to fetch sitemap index',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('companies/list')
  async getCompaniesList(
    @Query('letter') letter: string,
    @Query('page') pageParam: string,
    @Query('maxExposedCount') maxExposedCountParam?: string,
    @Query('pageSize') pageSizeParam?: string,
  ) {
    const normalizedLetter = (letter ?? '').trim().toLowerCase();
    const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);
    const pageSize = Math.min(
      500,
      Math.max(50, parseInt(pageSizeParam ?? '300', 10) || 300),
    );
    const maxExposedCount = maxExposedCountParam
      ? parseInt(maxExposedCountParam, 10)
      : undefined;
    if (!normalizedLetter || normalizedLetter.length !== 1 || !/[a-z]/.test(normalizedLetter)) {
      throw new HttpException(
        'Query parameter "letter" is required (a-z)',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      const { companyIds, hasMore } =
        await this.orgChartEsService.getCompaniesByLetterPage(
          normalizedLetter,
          page,
          pageSize,
          maxExposedCount,
        );
      return { companyIds, hasMore, status: 'ok' };
    } catch (error) {
      this.logger.error(
        `Get companies list failed letter=${letter} page=${page}`,
        error,
      );
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to fetch companies list',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** Convert URL slug (e.g. united-states) to ES country format (e.g. united states). */
  private slugToCountry(slug: string): string {
    return slug.replace(/-/g, ' ').toLowerCase().trim();
  }

  /**
   * Normalizes over-encoded company IDs (e.g. h%2526m from H&M).
   * Decodes repeatedly until stable to handle multiple encoding layers.
   */
  private normalizeCompanyId(companyId: string): string {
    if (!companyId?.trim()) return companyId;
    let decoded = companyId.trim();
    let prev = '';
    while (prev !== decoded) {
      prev = decoded;
      try {
        decoded = decodeURIComponent(decoded);
      } catch {
        break;
      }
    }
    return decoded.toLowerCase();
  }

  @Get('companies/list-by-country')
  async getCompaniesListByCountry(
    @Query('country') country: string,
    @Query('page') pageParam: string,
    @Query('maxExposedCount') maxExposedCountParam?: string,
    @Query('pageSize') pageSizeParam?: string,
  ) {
    const normalizedCountry = this.slugToCountry(country ?? '');
    const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);
    const pageSize = Math.min(
      500,
      Math.max(50, parseInt(pageSizeParam ?? '300', 10) || 300),
    );
    const maxExposedCount = maxExposedCountParam
      ? parseInt(maxExposedCountParam, 10)
      : undefined;
    if (!normalizedCountry) {
      throw new HttpException(
        'Query parameter "country" is required',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      const { companyIds, hasMore } =
        await this.orgChartEsService.getCompaniesByCountryPage(
          normalizedCountry,
          page,
          pageSize,
          maxExposedCount,
        );
      return { companyIds, hasMore, status: 'ok' };
    } catch (error) {
      this.logger.error(
        `Get companies list by country failed country=${country} page=${page}`,
        error,
      );
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Failed to fetch companies list by country',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('companies/list-by-country-function')
  async getCompaniesListByCountryFunction(
    @Query('country') country: string,
    @Query('type') type: string,
    @Query('page') pageParam: string,
    @Query('maxExposedCount') maxExposedCountParam?: string,
    @Query('pageSize') pageSizeParam?: string,
  ) {
    const normalizedCountry = this.slugToCountry(country ?? '');
    const normalizedType = this.slugToCountry(type ?? '');
    const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);
    const pageSize = Math.min(
      500,
      Math.max(50, parseInt(pageSizeParam ?? '300', 10) || 300),
    );
    const maxExposedCount = maxExposedCountParam
      ? parseInt(maxExposedCountParam, 10)
      : undefined;
    if (!normalizedCountry || !normalizedType) {
      throw new HttpException(
        'Query parameters "country" and "type" are required',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      const { companyIds, hasMore } =
        await this.orgChartEsService.getCompaniesByCountryAndTypePage(
          normalizedCountry,
          normalizedType,
          page,
          pageSize,
          maxExposedCount,
        );
      return { companyIds, hasMore, status: 'ok' };
    } catch (error) {
      this.logger.error(
        `Get companies list by country/function failed country=${country} type=${type}`,
        error,
      );
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Failed to fetch companies list by country/function',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('companies/sitemap-urls')
  async getSitemapUrls(
    @Query('offset') offsetParam: string,
    @Query('limit') limitParam: string,
    @Query('country') countryParam?: string,
    @Query('type') typeParam?: string,
  ) {
    const offset = Math.max(0, parseInt(offsetParam ?? '0', 10) || 0);
    const limit = Math.min(
      50000,
      Math.max(1, parseInt(limitParam ?? '500', 10) || 500),
    );
    const country = countryParam?.trim() || undefined;
    const type = typeParam?.trim() || undefined;

    try {
      const urls =
        await this.orgChartEsService.getIndexedUrlsWithSearchAfterChaining({
          offset,
          limit,
          country,
          type,
        });
      return { urls, status: 'ok' };
    } catch (error) {
      this.logger.error('Get sitemap URLs failed', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to fetch sitemap URLs',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('companies/sitemap-slices')
  async getSitemapSlices() {
    try {
      const pairs =
        await this.orgChartEsService.getDistinctCountryTypePairs();
      return { slices: pairs, status: 'ok' };
    } catch (error) {
      this.logger.error('Get sitemap slices failed', error);
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Failed to fetch sitemap slices',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('companies/sitemap-batch-params')
  async getSitemapBatchParams(@Query('batchIndex') batchIndexParam: string) {
    const batchIndex = Math.max(
      0,
      parseInt(batchIndexParam ?? '0', 10) || 0,
    );
    try {
      const params =
        await this.orgChartEsService.getSitemapBatchParams(batchIndex);
      if (!params) {
        return { status: 'ok' };
      }
      return { ...params, status: 'ok' };
    } catch (error) {
      this.logger.error('Get sitemap batch params failed', error);
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Failed to fetch sitemap batch params',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('companies/sitemap-global-fullcompany-count')
  async getSitemapGlobalFullcompanyCount() {
    try {
      const count =
        await this.orgChartEsService.getGlobalFullcompanyCount();
      return { count, status: 'ok' };
    } catch (error) {
      this.logger.error('Get sitemap global fullcompany count failed', error);
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Failed to fetch global fullcompany count',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('companies/sitemap-urls-by-company')
  async getSitemapUrlsByCompany(
    @Query('offset') offsetParam: string,
    @Query('limit') limitParam: string,
    @Query('batchIndex') batchIndexParam?: string,
  ) {
    const offset = Math.max(0, parseInt(offsetParam ?? '0', 10) || 0);
    const limit = Math.min(
      5000,
      Math.max(1, parseInt(limitParam ?? '50', 10) || 50),
    );
    const batchIndex = Math.max(
      0,
      parseInt(batchIndexParam ?? '0', 10) || 0,
    );
    const depth = batchIndex < 40 ? 'global' : 'countries';
    try {
      const companyIds =
        await this.orgChartEsService.getIndexedCompanyIdsPaginated(
          offset,
          limit,
        );
      const urls: { companyId: string; country: string; type: string }[] = [];

      if (depth === 'global') {
        for (const companyId of companyIds) {
          urls.push({
            companyId,
            country: 'global',
            type: 'fullcompany',
          });
        }
      } else {
        for (const companyId of companyIds) {
          const combos =
            await this.orgChartEsService.getIndexedUrlsForCompany(companyId);
          for (const { country, type } of combos) {
            const t = type ?? 'fullcompany';
            if (depth === 'countries' && t !== 'fullcompany') continue;
            urls.push({
              companyId,
              country: country ?? 'global',
              type: t,
            });
          }
        }
      }

      return { urls, status: 'ok' };
    } catch (error) {
      this.logger.error('Get sitemap URLs by company failed', error);
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Failed to fetch sitemap URLs by company',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('companies/employee-count')
  async getEmployeeCount(
    @Query('companyId') companyId: string,
    @Query('linkedinUrl') linkedinUrl: string,
  ) {
    const normalizedCompanyId = companyId?.trim()
      ? this.normalizeCompanyId(companyId.trim())
      : '';
    const urlOrSlug = linkedinUrl?.trim() || normalizedCompanyId;
    if (!urlOrSlug) {
      throw new HttpException(
        'Query parameter "companyId" or "linkedinUrl" is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const employeeCount =
        await this.apifyEmployeeCountService.getEmployeeCount(urlOrSlug);
      return { employeeCount, status: 'ok' };
    } catch (error) {
      this.logger.error('Employee count lookup failed', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Employee count lookup failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('companies/company-profile')
  async getCompanyProfile(
    @Query('linkedinUrl') linkedinUrl: string,
    @Query('linkedinSlug') linkedinSlug: string,
    @Req() req: Request,
  ) {
    const urlOrSlug = linkedinUrl?.trim() || linkedinSlug?.trim();
    if (!urlOrSlug) {
      throw new HttpException(
        'Query parameter "linkedinUrl" or "linkedinSlug" is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const authToken = this.getAuthToken(req);
    if (!authToken) {
      return { linkedinConnected: false, status: 'ok' };
    }

    try {
      let workspaceId: string;
      try {
        workspaceId =
          await this.workspaceQueryService.getWorkspaceIdFromToken(authToken);
      } catch {
        return { linkedinConnected: false, status: 'ok' };
      }
      const workspaceMemberId =
        await this.workspaceQueryService.getWorkspaceMemberIdFromToken(
          authToken,
        );
      const accountId =
        await this.workspaceMemberProfileUnipileService.getWorkspaceMemberUnipileAccountId(
          workspaceMemberId ?? null,
          workspaceId,
          authToken,
          'linkedin',
        );

      if (!accountId) {
        return { linkedinConnected: false, status: 'ok' };
      }

      const publicIdentifier =
        this.unipileCompanyService.extractPublicIdentifier(urlOrSlug);
      if (!publicIdentifier) {
        throw new HttpException(
          'Could not extract company identifier from linkedinUrl or linkedinSlug',
          HttpStatus.BAD_REQUEST,
        );
      }

      const profile = await this.unipileCompanyService.getCompanyProfile(
        publicIdentifier,
        accountId,
      );

      if (!profile) {
        return { linkedinConnected: true, profile: null, status: 'ok' };
      }

      return { linkedinConnected: true, profile, status: 'ok' };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Company profile lookup failed', error);
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Company profile lookup failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('companies/:companyId/top-hired-from')
  async getTopHiredFrom(
    @Param('companyId') companyId: string,
  ) {
    if (!companyId || companyId.includes('/') || companyId.includes('..')) {
      throw new HttpException('Invalid company ID', HttpStatus.BAD_REQUEST);
    }
    const normalizedCompanyId = this.normalizeCompanyId(companyId);
    try {
      const companies =
        await this.orgChartEsService.getTopHiredFromCompanies(normalizedCompanyId);
      return { companies, status: 'ok' };
    } catch (error) {
      this.logger.error(
        `Get top hired from failed for companyId=${companyId}`,
        error,
      );
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to fetch top hired from',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('companies/:companyId/indexed-urls')
  async getIndexedUrls(
    @Param('companyId') companyId: string,
  ) {
    if (!companyId || companyId.includes('/') || companyId.includes('..')) {
      throw new HttpException('Invalid company ID', HttpStatus.BAD_REQUEST);
    }
    const normalizedCompanyId = this.normalizeCompanyId(companyId);
    try {
      const urls =
        await this.orgChartEsService.getIndexedUrlsForCompany(normalizedCompanyId);
      return { urls, status: 'ok' };
    } catch (error) {
      this.logger.error(
        `Get indexed URLs failed for companyId=${companyId}`,
        error,
      );
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to fetch indexed URLs',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('companies/autocomplete')
  async companyAutocomplete(@Body() dto: CompanyAutocompleteDto, @Req() req: Request) {
    try {
      const authToken = this.getAuthToken(req);
      const results = await this.orgChartService.getCompanyAutocomplete(
        dto.input_text,
        authToken,
      );
      return { result: results, status: 'ok' };
    } catch (error) {
      this.logger.error('Company autocomplete failed', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Autocomplete failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('manual/:companyId')
  async getManualOrgChart(
    @Param('companyId') companyId: string,
  ) {
    if (!companyId || companyId.includes('/') || companyId.includes('..')) {
      throw new HttpException('Invalid company ID', HttpStatus.BAD_REQUEST);
    }

    const normalizedCompanyId = this.normalizeCompanyId(companyId);
    try {
      const result = await this.orgChartService.getManualOrgChart(
        normalizedCompanyId,
      );
      return { result, status: 'ok' };
    } catch (error) {
      this.logger.error(
        `Get MANUAL org chart failed for ${companyId}`,
        error,
      );
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Failed to fetch manual org chart',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /org-chart/:companyId/theorg-enriched
   *
   * Fetches the existing org chart from ES/S3, appends real-name leadership
   * data from TheOrg, passes all people through the Python org-chart builder,
   * and returns the merged, fully-classified org chart.
   *
   * Query params:
   *   companyName  – human-readable company name (e.g. "Litify")
   *   theOrgSlug   – TheOrg company slug (defaults to companyId)
   *   country      – optional country filter forwarded to the base chart lookup
   *   functionRoot – optional function-root filter
   *
   * NOTE: This route must be declared BEFORE `:companyId/:country` so that
   * "theorg-enriched" is not consumed as the :country parameter.
   */
  @Get(':companyId/theorg-enriched')
  async getTheOrgEnrichedOrgChart(
    @Param('companyId') companyId: string,
    @Query('companyName') companyName: string | undefined,
    @Query('theOrgSlug') theOrgSlug: string | undefined,
    @Query('theOrgMode') theOrgMode: string | undefined,
    @Query('country') country: string | undefined,
    @Query('functionRoot') functionRoot: string | undefined,
    @Req() req: Request,
  ) {
    if (!companyId || companyId.includes('/') || companyId.includes('..')) {
      throw new HttpException('Invalid company ID', HttpStatus.BAD_REQUEST);
    }

    const normalizedCompanyId = this.normalizeCompanyId(companyId);

    try {
      const result =
        await this.orgChartTheOrgEnrichmentService.getEnrichedOrgChart(
          normalizedCompanyId,
          {
            companyName,
            theOrgSlug: theOrgSlug ?? normalizedCompanyId,
            theOrgMode:
              theOrgMode === 'teams' ||
              theOrgMode === 'orgchart' ||
              theOrgMode === 'combined'
                ? theOrgMode
                : undefined,
            country,
            functionRoot,
          },
        );
      return {
        result: await this.proxyOrgChartPayload(result),
        status: 'ok',
      };
    } catch (error) {
      this.logger.error(
        `TheOrg-enriched org chart failed for companyId=${companyId}`,
        error,
      );
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Failed to build TheOrg-enriched org chart',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':companyId/:country/:functionRoot')
  async getOrgChartPath3(
    @Param('companyId') companyId: string,
    @Param('country') country: string,
    @Param('functionRoot') functionRoot: string,
    @Query('companyName') companyName: string | undefined,
    @Query('website') website: string | undefined,
    @Req() req: Request,
  ) {
    return this.getOrgChartInternal(req, companyId, {
      companyName,
      website,
      country,
      functionRoot,
    });
  }

  @Get(':companyId/:country')
  async getOrgChartPath2(
    @Param('companyId') companyId: string,
    @Param('country') country: string,
    @Query('companyName') companyName: string | undefined,
    @Query('website') website: string | undefined,
    @Req() req: Request,
  ) {
    return this.getOrgChartInternal(req, companyId, {
      companyName,
      website,
      country,
      functionRoot: undefined,
    });
  }

  @Get(':companyId')
  async getOrgChart(
    @Param('companyId') companyId: string,
    @Query('companyName') companyName: string | undefined,
    @Query('website') website: string | undefined,
    @Query('country') country: string | undefined,
    @Query('functionRoot') functionRoot: string | undefined,
    @Req() req: Request,
  ) {
    return this.getOrgChartInternal(req, companyId, {
      companyName,
      website,
      country,
      functionRoot,
    });
  }

  private async getOrgChartInternal(
    req: Request,
    companyId: string,
    options: {
      companyName?: string;
      website?: string;
      country?: string;
      functionRoot?: string;
    },
  ) {
    if (!companyId || companyId.includes('/') || companyId.includes('..')) {
      throw new HttpException('Invalid company ID', HttpStatus.BAD_REQUEST);
    }
    const normalizedCompanyId = this.normalizeCompanyId(companyId);
    const clientIp =
      OrgChartClientIpService.extractClientIpFromRequest(req);
    const clientUserAgent =
      OrgChartClientIpService.extractClientUserAgentFromRequest(req);
    const ipDecision =
      await this.orgChartClientIpService.recordRequestAndGetDecision(
        clientIp,
        clientUserAgent,
      );
    if (ipDecision?.blocked) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
    const serveCachedOnly = ipDecision?.serveCachedOnly === true;
    try {
      const authToken = this.getAuthToken(req);
      const result = await this.orgChartService.getOrgChart(
        normalizedCompanyId,
        { ...options, serveCachedOnly },
        authToken,
      );
      if (
        clientIp &&
        this.orgChartClientIpService.shouldCountAsChartServed(result)
      ) {
        await this.orgChartClientIpService.recordChartServed(clientIp);
      }
      return {
        result: await this.proxyOrgChartPayload(result),
        status: 'ok',
      };
    } catch (error) {
      this.logger.error(`Get org chart failed for ${companyId}`, error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to fetch org chart',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':companyId/node-people')
  async getNodePeople(
    @Param('companyId') companyId: string,
    @Body() body: OrgChartNodePeopleDto,
    @Req() req: Request,
  ) {
    if (!companyId || companyId.includes('/') || companyId.includes('..')) {
      throw new HttpException('Invalid company ID', HttpStatus.BAD_REQUEST);
    }

    const normalizedCompanyId = this.normalizeCompanyId(companyId);
    try {
      const authToken = this.getAuthToken(req);
      const result = await this.orgChartService.getNodePeople(
        normalizedCompanyId,
        body,
        authToken,
      );
      return {
        ...(await this.imageProxyService.proxyImagesInPayload(result)),
        status: 'ok',
      };
    } catch (error) {
      this.logger.error(
        `Get node people failed for companyId=${companyId}`,
        error,
      );
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Failed to fetch people for node',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('query')
  async postQuery(@Body() dto: OrgChartQueryDto, @Req() req: Request) {
    try {
      const authToken = this.getAuthToken(req);
      const result = await this.orgChartService.postQuery(
        {
          query: dto.query,
          params: dto.params,
          selected_context_menu: dto.selected_context_menu,
          selected_nodes: dto.selected_nodes,
          selected_blocks: dto.selected_blocks,
        },
        authToken,
      );
      return { result, status: 'ok' };
    } catch (error) {
      this.logger.error('Org chart query failed', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Query failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('search')
  async searchOrgChartFromLinkedIn(
    @Body()
    body: {
      rawQuery: string;
      cleanedQuery: string;
      companyName?: string;
      companyId?: string;
      jobTitles?: string[];
      mode:
        | 'current_node'
        | 'leadership'
        | 'entire_company'
        | 'function_grade'
        | 'all_people'
        | 'selected_nodes';
      maxPages?: number;
      searchType?: 'classic' | 'sales_navigator' | 'recruiter';
      requestId?: string;
      country?: string;
      functionRoot?: string;
    },
    @Req() req: Request,
  ) {
    try {
      const normalizedHeaders = Object.fromEntries(
        Object.entries(req.headers).flatMap(([key, value]) => {
          if (Array.isArray(value)) {
            return [[key, value.join(', ')]];
          }
          return typeof value === 'string' ? [[key, value]] : [];
        }),
      );

      return await this.orgChartLinkedInBuildService.searchOrgchartFromLinkedIn(
        body,
        normalizedHeaders,
      );
    } catch (error) {
      this.logger.error('Org chart LinkedIn search failed', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to search org chart',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('search/cancel')
  async cancelOrgChartSearch(
    @Body() body: { requestId?: string },
    @Req() req: Request,
  ) {
    if (!body?.requestId?.trim()) {
      throw new HttpException(
        'Body field "requestId" is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const normalizedHeaders = Object.fromEntries(
      Object.entries(req.headers).flatMap(([key, value]) => {
        if (Array.isArray(value)) {
          return [[key, value.join(', ')]];
        }
        return typeof value === 'string' ? [[key, value]] : [];
      }),
    );

    return this.orgChartLinkedInBuildService.cancelOrgchartSearch(
      { requestId: body.requestId.trim() },
      normalizedHeaders,
    );
  }

  @Post('from-job')
  async buildOrgChartFromJobCandidates(
    @Body() body: { jobId: string; jobName?: string },
    @Req() req: Request,
  ) {
    const authToken = this.getAuthToken(req);
    if (!authToken) {
      throw new HttpException('Authentication required', HttpStatus.UNAUTHORIZED);
    }

    try {
      return await this.orgChartLinkedInBuildService.buildOrgChartFromJobCandidates(
        body,
        authToken,
      );
    } catch (error) {
      this.logger.error('Build org chart from job failed', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Failed to build org chart from job',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('contact-info')
  async getContactInfo(
    @Body()
    body: {
      linkedinUrl: string;
    },
    @Req() req: Request,
  ) {
    if (!body?.linkedinUrl || !body.linkedinUrl.trim()) {
      throw new HttpException(
        'Body field "linkedinUrl" is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const authToken = this.getAuthToken(req);
      const result = await this.orgChartService.getContactInfoForPerson(
        { linkedinUrl: body.linkedinUrl },
        authToken,
      );
      return { ...result, status: 'ok' };
    } catch (error) {
      this.logger.error('Get contact info failed', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to fetch contact info',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('companies/find-by-name')
  async findCompanyByName(
    @Body() body: { companyName: string },
    @Req() req: Request,
  ) {
    if (!body?.companyName || !body.companyName.trim()) {
      throw new HttpException(
        'Body field "companyName" is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const authToken = this.getAuthToken(req);
      if (!authToken) {
        throw new HttpException('Authentication required', HttpStatus.UNAUTHORIZED);
      }

      const workspaceMemberId = (req as { workspaceMemberId?: string }).workspaceMemberId;
      const result = await this.orgChartService.findCompanyByName(
        body.companyName,
        authToken,
        workspaceMemberId,
      );
      return { ...result, status: 'ok' };
    } catch (error) {
      this.logger.error('Find company by name failed', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to find company',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
