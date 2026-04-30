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
  UseGuards,
} from '@nestjs/common';

import { Request, Response } from 'express';
import { v4 as uuidV4 } from 'uuid';

import { ApifyEmployeeCountService } from 'src/engine/core-modules/apify/services/apify-employee-count.service';
import { ApifyService } from 'src/engine/core-modules/apify/services/apify.service';
import { UnipileCompanyService } from 'src/engine/core-modules/arx-chat/services/unipile-company.service';
import { WorkspaceMemberProfileUnipileService } from 'src/engine/core-modules/arx-chat/services/workspace-member-profile-unipile.service';
import { ApiKeyService } from 'src/engine/core-modules/auth/services/api-key.service';
import { BrightDataSerpService } from 'src/engine/core-modules/bright-data/services/bright-data-serp.service';
import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { ApolloIoRestService } from 'src/engine/core-modules/candidate-search/services/apollo-io-rest.service';
import { CandidateSearchHandlerService } from 'src/engine/core-modules/candidate-search/services/candidate-search-handler.service';
import {
  ClassicPeopleSearchStrategyResult,
  GeneratedSearchParameters,
  RecruiterPeopleSearchStrategyResult,
  SalesNavigatorPeopleSearchStrategyResult,
} from 'src/engine/core-modules/candidate-search/types/candidate-search-request.type';
import { constructSearchParamKey } from 'src/engine/core-modules/candidate-search/utils/search-parameter.utils';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { OrgChartService } from 'src/engine/core-modules/org-chart/services/org-chart.service';
import { OrgChartLinkedinCandidateSource } from 'src/engine/core-modules/org-chart/types/orgchart-linkedin-candidate-source.type';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { LinkedinXraySearchEngine } from 'src/modules/linkedin-xray/types/linkedin-xray-search-job.types';

import { CompanyAutocompleteDto } from '../dto/company-autocomplete.dto';
import { OrgChartNodePeopleDto } from '../dto/org-chart-node-people.dto';
import { OrgChartQueryDto } from '../dto/org-chart-query.dto';
import { CompanyLogoService } from '../services/company-logo.service';
import { ImageProxyService } from '../services/image-proxy.service';
import { OrgChartClientIpService } from '../services/org-chart-client-ip.service';
import { OrgChartEsService } from '../services/org-chart-es.service';
import { OrgChartLinkedInBuildService } from '../services/org-chart-linkedin-build.service';
import { OrgChartTheOrgEnrichmentService } from '../services/org-chart-theorg-enrichment.service';
import { OrgChartS3Service } from '../services/orgchart-s3.service';
import { PythonOrgChartService } from '../services/python-org-chart.service';
import { resolveFirstAutocompleteSource } from '../utils/first-autocomplete-source.util';
import { applyAsOfSnapshotToCandidates } from '../utils/orgchart-asof-snapshot.util';
import {
  computeTimelineMetricsFromCandidates,
  computeTimelineProfilesFromCandidates,
} from '../utils/orgchart-timeline-metrics.util';
import { normalizePersonForPythonOrgChartBuild } from '../utils/python-org-chart-person.util';
import {
  ApifyCompanyProfileActorItem,
  generateSampleApifyCompanyProfileActorItems,
  generateSampleContactOutPeopleSearchResponse,
} from '../utils/sample-company/sampleCompanyDatasets';

@Controller('org-chart')
export class OrgChartController {
  private readonly logger = new Logger(OrgChartController.name);
  private static readonly APOLLO_FIRST_LOAD_RESULT_CAP = 2000;
  private static readonly APOLLO_FIRST_LOAD_IN_PROGRESS_TTL_SECONDS = 60 * 10;

  constructor(
    private readonly orgChartService: OrgChartService,
    private readonly orgChartLinkedInBuildService: OrgChartLinkedInBuildService,
    private readonly orgChartEsService: OrgChartEsService,
    private readonly orgChartTheOrgEnrichmentService: OrgChartTheOrgEnrichmentService,
    private readonly companyLogoService: CompanyLogoService,
    private readonly imageProxyService: ImageProxyService,
    private readonly apifyEmployeeCountService: ApifyEmployeeCountService,
    private readonly apifyService: ApifyService,
    private readonly unipileCompanyService: UnipileCompanyService,
    private readonly workspaceMemberProfileUnipileService: WorkspaceMemberProfileUnipileService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly orgChartClientIpService: OrgChartClientIpService,
    private readonly pythonOrgChartService: PythonOrgChartService,
    private readonly brightDataSerpService: BrightDataSerpService,
    private readonly candidateSearchHandlerService: CandidateSearchHandlerService,
    private readonly apolloIoRestService: ApolloIoRestService,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly apiKeyService: ApiKeyService,
    private readonly orgChartS3Service: OrgChartS3Service,
    @InjectCacheStorage(CacheStorageNamespace.EngineOrgChart)
    private readonly orgChartCacheStorageService: CacheStorageService,
  ) {}

  private shareCacheKey(shareToken: string): string {
    return `orgchart-share:${shareToken}`;
  }

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

  private parseExpectedEmployeeCountQuery(
    raw: string | undefined,
  ): number | undefined {
    if (raw === undefined || raw === null) {
      return undefined;
    }
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      return undefined;
    }
    const n = Number(trimmed);

    if (!Number.isFinite(n) || n <= 0) {
      return undefined;
    }

    return n;
  }

  private proxyOrgChartPayload(
    result: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.imageProxyService.proxyImagesInPayload(result);
  }

  private extractDomainFromWebsite(website?: string): string | undefined {
    const raw = website?.trim();
    if (!raw) return undefined;
    try {
      const normalized =
        raw.startsWith('http://') || raw.startsWith('https://')
          ? raw
          : `https://${raw}`;
      const host = new URL(normalized).hostname.trim().toLowerCase();
      return host || undefined;
    } catch {
      return raw.toLowerCase();
    }
  }

  private apolloFirstLoadInProgressKey(companyId: string): string {
    return `apollo-first-load-in-progress:${companyId}`;
  }

  @UseGuards(JwtAuthGuard)
  @Post('share/create')
  async createOrgChartShareLink(
    @Body()
    body: {
      companyId?: string;
      companyName?: string;
      ttlSeconds?: number;
    },
    @Req() req: Request,
  ): Promise<{
    status: 'ok';
    shareToken: string;
    accessKey: string;
    expiresAt: string;
  }> {
    const authToken = this.getAuthToken(req);

    if (!authToken) {
      throw new HttpException(
        'Authentication required',
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (!(req as { user?: unknown }).user) {
      throw new HttpException(
        'Authentication required',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const companyId = body?.companyId?.trim() ?? '';

    if (!companyId || companyId.includes('/') || companyId.includes('..')) {
      throw new HttpException('Invalid company ID', HttpStatus.BAD_REQUEST);
    }

    const ttlSeconds =
      typeof body.ttlSeconds === 'number' && Number.isFinite(body.ttlSeconds)
        ? Math.floor(body.ttlSeconds)
        : 0;

    if (ttlSeconds <= 0) {
      throw new HttpException(
        'Body field "ttlSeconds" is required and must be > 0',
        HttpStatus.BAD_REQUEST,
      );
    }
    // Guardrail: 30 days max to keep tokens short-lived.
    if (ttlSeconds > 60 * 60 * 24 * 30) {
      throw new HttpException(
        'ttlSeconds cannot exceed 30 days',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Ensure we have a persisted org chart to share (S3 is source of truth for share viewer).
    const normalizedCompanyId = this.normalizeCompanyId(companyId);
    const existing =
      await this.orgChartS3Service.getOrgChart(normalizedCompanyId);

    if (!existing) {
      throw new HttpException(
        'No persisted org chart found. Generate the full org chart first, then share.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const workspaceId =
      await this.workspaceQueryService.getWorkspaceIdFromToken(authToken);

    if (!workspaceId) {
      throw new HttpException('Workspace not found', HttpStatus.UNAUTHORIZED);
    }

    const apiKeyId = uuidV4();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    // Create workspace API key row (so JWT jti has backing record + expiresAt/revocation).
    const createKeyMutation = `
      mutation CreateOneApiKey($input: ApiKeyCreateInput!) {
        createApiKey(data: $input) {
          id
        }
      }
    `;
    const keyNameParts = [
      'org_chart_share',
      normalizedCompanyId,
      expiresAt.toISOString(),
    ];
    const keyName = keyNameParts.join('::').slice(0, 180);

    await this.staticGraphQLService.executeGraphQL(
      createKeyMutation,
      {
        input: {
          id: apiKeyId,
          name: keyName,
          expiresAt: expiresAt.toISOString(),
        },
      },
      authToken,
    );

    const token = await this.apiKeyService.generateApiKeyToken(
      workspaceId,
      apiKeyId,
      expiresAt,
    );

    if (!token?.token) {
      throw new HttpException(
        'Failed to generate access key',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const shareToken = uuidV4();

    await this.orgChartCacheStorageService.set(
      this.shareCacheKey(shareToken),
      {
        companyId: normalizedCompanyId,
        companyName:
          typeof body.companyName === 'string'
            ? body.companyName.trim()
            : undefined,
        createdAt: new Date().toISOString(),
      },
      ttlSeconds,
    );

    return {
      status: 'ok',
      shareToken,
      accessKey: token.token,
      expiresAt: expiresAt.toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('share/:shareToken')
  async getSharedOrgChart(
    @Param('shareToken') shareToken: string,
    @Req() req: Request,
  ): Promise<{ status: 'ok'; result: Record<string, unknown> }> {
    const trimmed = (shareToken ?? '').trim();

    if (!trimmed) {
      throw new HttpException('Invalid share token', HttpStatus.BAD_REQUEST);
    }

    const authToken = this.getAuthToken(req);

    if (!authToken) {
      throw new HttpException('Access key required', HttpStatus.UNAUTHORIZED);
    }
    if (!(req as { apiKey?: unknown }).apiKey) {
      throw new HttpException('Access key required', HttpStatus.UNAUTHORIZED);
    }

    const mapping = await this.orgChartCacheStorageService.get<{
      companyId?: string;
      companyName?: string;
    }>(this.shareCacheKey(trimmed));

    const companyId = mapping?.companyId?.trim() ?? '';

    if (!companyId) {
      // Treat as expired / missing.
      throw new HttpException('Share link expired', HttpStatus.GONE);
    }

    const orgChart = await this.orgChartS3Service.getOrgChart(companyId);

    if (!orgChart) {
      throw new HttpException('Org chart not found', HttpStatus.NOT_FOUND);
    }

    const payload: Record<string, unknown> = {
      ...(orgChart as unknown as Record<string, unknown>),
      ...(mapping?.companyName?.trim()
        ? { job_company_name: mapping.companyName.trim() }
        : {}),
    };

    return {
      status: 'ok' as const,
      result: await this.proxyOrgChartPayload(payload),
    };
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
    res.setHeader('Content-Type', contentType ?? 'image/png');
    res.send(Buffer.from(body));
  }

  /**
   * Proxy external images (e.g. LinkedIn profile photos) so the response
   * can set Cross-Origin-Resource-Policy and avoid CORP blocking in the browser.
   */
  @Get('image-proxy')
  async getImageProxy(@Query('url') url: string, @Res() res: Response) {
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
      const companyIds = await this.orgChartEsService.getIndexedCompanyIds(500);

      return { companyIds, status: 'ok' };
    } catch (error) {
      this.logger.error('Get sitemap index failed', error);
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Failed to fetch sitemap index',
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

    if (
      !normalizedLetter ||
      normalizedLetter.length !== 1 ||
      !/[a-z]/.test(normalizedLetter)
    ) {
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
        error instanceof Error
          ? error.message
          : 'Failed to fetch companies list',
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
      const pairs = await this.orgChartEsService.getDistinctCountryTypePairs();

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
    const batchIndex = Math.max(0, parseInt(batchIndexParam ?? '0', 10) || 0);

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
      const count = await this.orgChartEsService.getGlobalFullcompanyCount();

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
    const batchIndex = Math.max(0, parseInt(batchIndexParam ?? '0', 10) || 0);
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

  /**
   * Whether org-chart LinkedIn flows can use Unipile (member account) or Apify (server token),
   * and whether the Python HTTP org chart agent (arxena-site) is reachable when HTTP mode is used.
   */
  @Get('linkedin-data-sources-status')
  async getLinkedinDataSourcesStatus(@Req() req: Request) {
    let linkedinUnipileConnected = false;
    const authToken = this.getAuthToken(req);

    if (authToken) {
      try {
        const workspaceId =
          await this.workspaceQueryService.getWorkspaceIdFromToken(authToken);
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

        linkedinUnipileConnected = !!accountId;
      } catch {
        linkedinUnipileConnected = false;
      }
    }

    const apifyActorConfigured = this.apifyService.isConfigured();
    const linkedinXrayConfigured = this.brightDataSerpService.isConfigured();
    const m7kqDirectoryApiReady = this.apolloIoRestService.isConfigured();
    const pythonOrgChartAgentAvailable =
      await this.pythonOrgChartService.isOrgChartAgentReachable();

    return {
      status: 'ok' as const,
      linkedinUnipileConnected,
      apifyActorConfigured,
      linkedinXrayConfigured,
      m7kqDirectoryApiReady,
      pythonOrgChartAgentAvailable,
    };
  }

  @Get('companies/:companyId/top-hired-from')
  async getTopHiredFrom(@Param('companyId') companyId: string) {
    if (!companyId || companyId.includes('/') || companyId.includes('..')) {
      throw new HttpException('Invalid company ID', HttpStatus.BAD_REQUEST);
    }
    const normalizedCompanyId = this.normalizeCompanyId(companyId);

    try {
      const companies =
        await this.orgChartEsService.getTopHiredFromCompanies(
          normalizedCompanyId,
        );

      return { companies, status: 'ok' };
    } catch (error) {
      this.logger.error(
        `Get top hired from failed for companyId=${companyId}`,
        error,
      );
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Failed to fetch top hired from',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('companies/:companyId/indexed-urls')
  async getIndexedUrls(@Param('companyId') companyId: string) {
    if (!companyId || companyId.includes('/') || companyId.includes('..')) {
      throw new HttpException('Invalid company ID', HttpStatus.BAD_REQUEST);
    }
    const normalizedCompanyId = this.normalizeCompanyId(companyId);

    try {
      const urls =
        await this.orgChartEsService.getIndexedUrlsForCompany(
          normalizedCompanyId,
        );

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
  async companyAutocomplete(
    @Body() dto: CompanyAutocompleteDto,
    @Req() req: Request,
  ) {
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

  /**
   * Apollo.io organization search for org-chart company picker (meta.id = organization_id).
   * Consumes Apollo credits per their pricing.
   */
  @Post('companies/autocomplete-apollo')
  async companyAutocompleteApollo(
    @Body() dto: CompanyAutocompleteDto,
    @Req() req: Request,
  ) {
    const authToken = this.getAuthToken(req);

    if (!authToken) {
      throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
    }
    if (!this.apolloIoRestService.isConfigured()) {
      return { result: [], status: 'ok' as const };
    }
    const q = dto.input_text?.trim() ?? '';

    if (!q) {
      return { result: [], status: 'ok' as const };
    }
    try {
      const raw = await this.apolloIoRestService.organizationsSearch({
        q_organization_name: q,
        page: 1,
        per_page: 15,
      });
      const organizations = raw.organizations;
      const list = Array.isArray(organizations)
        ? organizations.filter(
            (o): o is Record<string, unknown> =>
              o !== null && typeof o === 'object',
          )
        : [];

      const result = list.map((org) => {
        const id = String(org.organization_id ?? org.id ?? '');
        const name = String(org.name ?? '');
        const linkedinUrl =
          typeof org.linkedin_url === 'string' ? org.linkedin_url : undefined;
        let linkedin_slug: string | undefined;

        if (linkedinUrl) {
          const m = linkedinUrl.match(/linkedin\.com\/company\/([^/?#]+)/i);

          linkedin_slug = m?.[1]
            ? decodeURIComponent(m[1].replace(/\/$/, ''))
            : undefined;
        }
        const primaryDomain =
          typeof org.primary_domain === 'string'
            ? org.primary_domain
            : undefined;
        const website =
          typeof org.website_url === 'string'
            ? org.website_url
            : primaryDomain
              ? `https://${primaryDomain}`
              : undefined;
        const city = typeof org.city === 'string' ? org.city : '';
        const state = typeof org.state === 'string' ? org.state : '';
        const country = typeof org.country === 'string' ? org.country : '';
        const locParts = [city, state, country].filter((p) => p && p.trim());
        const location_name =
          locParts.length > 0 ? locParts.join(', ') : undefined;
        const industry =
          typeof org.industry === 'string' ? org.industry : undefined;
        const employeeCount =
          typeof org.estimated_num_employees === 'number'
            ? org.estimated_num_employees
            : typeof org.organization_headcount === 'number'
              ? org.organization_headcount
              : undefined;

        return {
          name,
          meta: {
            id,
            website,
            industry,
            location_name,
            linkedin_url: linkedinUrl,
            linkedin_slug,
            display_name: name,
            employee_count: employeeCount,
          },
          count: employeeCount ?? 0,
        };
      });

      return { result, status: 'ok' as const };
    } catch (error) {
      this.logger.error('Apollo company autocomplete failed', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Autocomplete failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('manual/:companyId')
  async getManualOrgChart(@Param('companyId') companyId: string) {
    if (!companyId || companyId.includes('/') || companyId.includes('..')) {
      throw new HttpException('Invalid company ID', HttpStatus.BAD_REQUEST);
    }

    const normalizedCompanyId = this.normalizeCompanyId(companyId);

    try {
      const result =
        await this.orgChartService.getManualOrgChart(normalizedCompanyId);

      return { result, status: 'ok' };
    } catch (error) {
      this.logger.error(`Get MANUAL org chart failed for ${companyId}`, error);
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Failed to fetch manual org chart',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /org-chart/:companyId/enriched
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
  @Get(':companyId/enriched')
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
    const apiToken = this.getAuthToken(req);

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
            apiToken,
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

  /**
   * GET /org-chart/:companyId/timeline
   *
   * Returns timeline metadata + join/leave deltas for window presets.
   * For now this is experience-driven and primarily intended for the `sample-company`
   * dataset and for sources that preserve experience payloads (Apify/ContactOut).
   *
   * Query params:
   * - asOfMonth: YYYY-MM (defaults to current month)
   * - sampleSource: contactout|apify (sample-company only)
   * - sampleProfiles: number (sample-company only)
   * - apifyIncludePast: true|false (sample-company only)
   */
  @Get(':companyId/timeline')
  async getOrgChartTimelineMetrics(
    @Param('companyId') companyId: string,
    @Query('companyName') companyName: string | undefined,
    @Query('asOfMonth') asOfMonth: string | undefined,
    @Query('sampleSource') sampleSource: string | undefined,
    @Query('sampleProfiles') sampleProfiles: string | undefined,
    @Query('apifyIncludePast') apifyIncludePastRaw: string | undefined,
  ) {
    if (!companyId || companyId.includes('/') || companyId.includes('..')) {
      throw new HttpException('Invalid company ID', HttpStatus.BAD_REQUEST);
    }
    const normalizedCompanyId = this.normalizeCompanyId(companyId);
    const resolvedName = (companyName ?? '').trim() || normalizedCompanyId;

    // Currently implemented for sample-company (dev dataset).
    if (normalizedCompanyId !== 'sample-company') {
      return {
        status: 'ok',
        result: computeTimelineMetricsFromCandidates({
          candidates: [],
          companyName: resolvedName,
          asOfMonth,
        }),
      };
    }

    const totalProfilesParsed =
      sampleProfiles !== undefined ? Number.parseInt(sampleProfiles, 10) : NaN;
    const totalProfiles =
      Number.isFinite(totalProfilesParsed) && totalProfilesParsed > 0
        ? Math.min(1000, totalProfilesParsed)
        : 100;
    const includePast =
      String(apifyIncludePastRaw ?? '').toLowerCase() === 'true';

    const src = (sampleSource ?? 'contactout').trim().toLowerCase();
    const linkedinCompanyUrl = `https://www.linkedin.com/company/${normalizedCompanyId}/`;
    const candidates =
      src === 'apify'
        ? this.buildSampleCompanyOrgChartPeopleFromApify({
            companyId: normalizedCompanyId,
            companyName: resolvedName,
            linkedinCompanyUrl,
            totalProfiles,
            includePast,
          })
        : this.buildSampleCompanyOrgChartPeopleFromContactOut({
            companyId: normalizedCompanyId,
            companyName: resolvedName,
            domain: 'sample-company.com',
            totalProfiles,
          });

    return {
      status: 'ok',
      result: computeTimelineMetricsFromCandidates({
        candidates,
        companyName: resolvedName,
        asOfMonth,
      }),
    };
  }

  @Get(':companyId/timeline/profiles')
  async getOrgChartTimelineProfiles(
    @Param('companyId') companyId: string,
    @Query('companyName') companyName: string | undefined,
    @Query('asOfMonth') asOfMonth: string | undefined,
    @Query('sampleSource') sampleSource: string | undefined,
    @Query('sampleProfiles') sampleProfiles: string | undefined,
    @Query('apifyIncludePast') apifyIncludePastRaw: string | undefined,
    @Query('event') eventRaw: string | undefined,
    @Query('window') windowRaw: string | undefined,
    @Query('limit') limitRaw: string | undefined,
  ) {
    if (!companyId || companyId.includes('/') || companyId.includes('..')) {
      throw new HttpException('Invalid company ID', HttpStatus.BAD_REQUEST);
    }
    const normalizedCompanyId = this.normalizeCompanyId(companyId);
    const resolvedName = (companyName ?? '').trim() || normalizedCompanyId;

    const event =
      eventRaw === 'joined' ||
      eventRaw === 'left' ||
      eventRaw === 'current' ||
      eventRaw === 'past'
        ? eventRaw
        : 'current';
    const window =
      windowRaw === '1m' ||
      windowRaw === '3m' ||
      windowRaw === '6m' ||
      windowRaw === '1y'
        ? windowRaw
        : '1m';
    const limitParsed =
      limitRaw !== undefined ? Number.parseInt(limitRaw, 10) : undefined;

    if (normalizedCompanyId !== 'sample-company') {
      return {
        status: 'ok',
        result: computeTimelineProfilesFromCandidates({
          candidates: [],
          companyName: resolvedName,
          asOfMonth,
          event,
          window,
          limit: limitParsed,
        }),
      };
    }

    const totalProfilesParsed =
      sampleProfiles !== undefined ? Number.parseInt(sampleProfiles, 10) : NaN;
    const totalProfiles =
      Number.isFinite(totalProfilesParsed) && totalProfilesParsed > 0
        ? Math.min(1000, totalProfilesParsed)
        : 100;
    const includePast =
      String(apifyIncludePastRaw ?? '').toLowerCase() === 'true';
    const src = (sampleSource ?? 'contactout').trim().toLowerCase();
    const linkedinCompanyUrl = `https://www.linkedin.com/company/${normalizedCompanyId}/`;
    const candidates =
      src === 'apify'
        ? this.buildSampleCompanyOrgChartPeopleFromApify({
            companyId: normalizedCompanyId,
            companyName: resolvedName,
            linkedinCompanyUrl,
            totalProfiles,
            includePast,
          })
        : this.buildSampleCompanyOrgChartPeopleFromContactOut({
            companyId: normalizedCompanyId,
            companyName: resolvedName,
            domain: 'sample-company.com',
            totalProfiles,
          });

    return {
      status: 'ok',
      result: computeTimelineProfilesFromCandidates({
        candidates,
        companyName: resolvedName,
        asOfMonth,
        event,
        window,
        limit: limitParsed,
      }),
    };
  }

  @Get(':companyId/:country/:functionRoot')
  async getOrgChartPath3(
    @Param('companyId') companyId: string,
    @Param('country') country: string,
    @Param('functionRoot') functionRoot: string,
    @Query('companyName') companyName: string | undefined,
    @Query('website') website: string | undefined,
    @Query('expectedEmployeeCount')
    expectedEmployeeCountRaw: string | undefined,
    @Req() req: Request,
  ) {
    return this.getOrgChartInternal(req, companyId, {
      companyName,
      website,
      country,
      functionRoot,
      expectedEmployeeCount: this.parseExpectedEmployeeCountQuery(
        expectedEmployeeCountRaw,
      ),
    });
  }

  @Get(':companyId/:country')
  async getOrgChartPath2(
    @Param('companyId') companyId: string,
    @Param('country') country: string,
    @Query('companyName') companyName: string | undefined,
    @Query('website') website: string | undefined,
    @Query('expectedEmployeeCount')
    expectedEmployeeCountRaw: string | undefined,
    @Req() req: Request,
  ) {
    return this.getOrgChartInternal(req, companyId, {
      companyName,
      website,
      country,
      functionRoot: undefined,
      expectedEmployeeCount: this.parseExpectedEmployeeCountQuery(
        expectedEmployeeCountRaw,
      ),
    });
  }

  @Get(':companyId')
  async getOrgChart(
    @Param('companyId') companyId: string,
    @Query('companyName') companyName: string | undefined,
    @Query('website') website: string | undefined,
    @Query('companyDomain') companyDomain: string | undefined,
    @Query('country') country: string | undefined,
    @Query('functionRoot') functionRoot: string | undefined,
    @Query('asOfMonth') asOfMonth: string | undefined,
    @Query('expectedEmployeeCount')
    expectedEmployeeCountRaw: string | undefined,
    @Req() req: Request,
  ) {
    return this.getOrgChartInternal(req, companyId, {
      companyName,
      website,
      companyDomain,
      country,
      functionRoot,
      asOfMonth,
      expectedEmployeeCount: this.parseExpectedEmployeeCountQuery(
        expectedEmployeeCountRaw,
      ),
    });
  }

  private async getOrgChartInternal(
    req: Request,
    companyId: string,
    options: {
      companyName?: string;
      website?: string;
      companyDomain?: string;
      country?: string;
      functionRoot?: string;
      asOfMonth?: string;
      expectedEmployeeCount?: number;
    },
  ) {
    if (!companyId || companyId.includes('/') || companyId.includes('..')) {
      throw new HttpException('Invalid company ID', HttpStatus.BAD_REQUEST);
    }
    const normalizedCompanyId = this.normalizeCompanyId(companyId);

    if (normalizedCompanyId === 'sample-company') {
      const result = await this.buildSampleCompanyOrgChart({
        companyId: normalizedCompanyId,
        companyName: options.companyName,
        country: options.country,
        functionRoot: options.functionRoot,
        expectedEmployeeCount: options.expectedEmployeeCount,
        sampleSource:
          (req.query?.sampleSource as string | undefined) ?? undefined,
        apifyIncludePast:
          String(req.query?.apifyIncludePast ?? '').toLowerCase() === 'true',
        totalProfilesRaw:
          (req.query?.sampleProfiles as string | undefined) ?? undefined,
        asOfMonth: options.asOfMonth,
      });

      return { result: await this.proxyOrgChartPayload(result), status: 'ok' };
    }

    const clientIp = OrgChartClientIpService.extractClientIpFromRequest(req);
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
      const firstSourceRequested = resolveFirstAutocompleteSource({
        authToken,
      });
      let firstSourceUsed: 'apollo' | 'elasticsearch' = firstSourceRequested;
      let fallbackApplied = false;
      let fallbackReason:
        | 'apollo_result_count_exceeds_limit'
        | 'apollo_error'
        | undefined;
      let apolloTotalCount: number | undefined;
      let apolloQueued = false;
      let apolloQueueRequestId: string | undefined;

      let orgChartPayload: Record<string, unknown> | null = null;
      let orgChartEsTransportError: boolean | undefined;

      if (firstSourceRequested === 'apollo' && !serveCachedOnly && authToken) {
        try {
          const countEstimate =
            await this.orgChartLinkedInBuildService.getApolloOrgPeopleCountEstimate(
              {
                companyId: normalizedCompanyId,
                companyName: options.companyName,
                website: options.website,
                country: options.country,
                functionRoot: options.functionRoot,
              },
            );

          if (typeof countEstimate.totalEntries === 'number') {
            apolloTotalCount = countEstimate.totalEntries;
          }

          if (
            typeof apolloTotalCount === 'number' &&
            apolloTotalCount > OrgChartController.APOLLO_FIRST_LOAD_RESULT_CAP
          ) {
            fallbackApplied = true;
            fallbackReason = 'apollo_result_count_exceeds_limit';
            firstSourceUsed = 'elasticsearch';
          } else {
            const inProgressKey =
              this.apolloFirstLoadInProgressKey(normalizedCompanyId);
            const inProgress = await this.orgChartCacheStorageService.get<{
              requestId?: string;
            }>(inProgressKey);

            if (inProgress?.requestId?.trim()) {
              apolloQueued = true;
              apolloQueueRequestId = inProgress.requestId.trim();
              firstSourceUsed = 'elasticsearch';
            } else {
              const requestId = `orgchart-firstload-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`;

              await this.orgChartCacheStorageService.set(
                inProgressKey,
                { requestId },
                OrgChartController.APOLLO_FIRST_LOAD_IN_PROGRESS_TTL_SECONDS,
              );

              await this.orgChartLinkedInBuildService.enqueueApolloOrgChartBuildJob(
                {
                  apiToken: authToken,
                  requestId,
                  companyId: normalizedCompanyId,
                  companyName: options.companyName ?? normalizedCompanyId,
                  country: options.country,
                  functionRoot: options.functionRoot,
                  linkedinCompanyUrl: undefined,
                  companyDomain:
                    options.companyDomain?.trim() ||
                    this.extractDomainFromWebsite(options.website),
                  shouldWriteCompanyOrgChartCache: true,
                },
              );

              apolloQueued = true;
              apolloQueueRequestId = requestId;
              firstSourceUsed = 'elasticsearch';
            }
          }
        } catch (error) {
          this.logger.warn(
            `Apollo first-load failed for companyId=${normalizedCompanyId}; falling back to Elasticsearch`,
            error as Error,
          );
          fallbackApplied = true;
          fallbackReason = 'apollo_error';
          firstSourceUsed = 'elasticsearch';
        }
      } else {
        firstSourceUsed = 'elasticsearch';
      }

      if (firstSourceUsed === 'elasticsearch' || !orgChartPayload) {
        const orgChartOutcome = await this.orgChartService.getOrgChart(
          normalizedCompanyId,
          { ...options, serveCachedOnly },
          authToken,
        );

        orgChartPayload = orgChartOutcome.data;
        orgChartEsTransportError = orgChartOutcome.orgChartEsTransportError;
      }

      if (
        clientIp &&
        orgChartPayload &&
        this.orgChartClientIpService.shouldCountAsChartServed(orgChartPayload)
      ) {
        await this.orgChartClientIpService.recordChartServed(clientIp);
      }

      return {
        result: await this.proxyOrgChartPayload(orgChartPayload ?? {}),
        status: 'ok',
        firstSourceRequested,
        firstSourceUsed,
        fallbackApplied,
        ...(fallbackReason ? { fallbackReason } : {}),
        ...(typeof apolloTotalCount === 'number' ? { apolloTotalCount } : {}),
        ...(apolloQueued ? { apolloQueued: true } : {}),
        ...(apolloQueueRequestId ? { apolloQueueRequestId } : {}),
        ...(orgChartEsTransportError ? { orgChartEsTransportError: true } : {}),
      };
    } catch (error) {
      this.logger.error(`Get org chart failed for ${companyId}`, error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to fetch org chart',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private pickApifyTitleAtCompany(
    item: ApifyCompanyProfileActorItem,
    companyName: string,
  ): string {
    const ex = Array.isArray(item.experience) ? item.experience : [];
    const normalizedWant = companyName.trim().toLowerCase();
    const atCompany = ex.filter(
      (e) => (e.companyName ?? '').trim().toLowerCase() === normalizedWant,
    );
    // Prefer current: endDate.text === "Present"
    const current = atCompany.find((e) =>
      (e.endDate?.text ?? '').toLowerCase().includes('present'),
    );

    return (
      current?.position?.trim() ||
      atCompany[0]?.position?.trim() ||
      item.headline?.trim() ||
      ''
    );
  }

  private buildSampleCompanyOrgChartPeopleFromApify(input: {
    companyId: string;
    companyName: string;
    linkedinCompanyUrl: string;
    totalProfiles: number;
    includePast: boolean;
  }): Array<Record<string, unknown>> {
    const raw = generateSampleApifyCompanyProfileActorItems({
      companyName: input.companyName,
      linkedinCompanyUrl: input.linkedinCompanyUrl,
      totalProfiles: input.totalProfiles,
      seed: 4242,
    });
    const filtered = input.includePast
      ? raw
      : raw.filter((p) => {
          const ex = Array.isArray(p.experience) ? p.experience : [];
          const normalizedWant = input.companyName.trim().toLowerCase();

          return ex.some(
            (e) =>
              (e.companyName ?? '').trim().toLowerCase() === normalizedWant &&
              (e.endDate?.text ?? '').toLowerCase().includes('present'),
          );
        });

    return filtered.map((p) => {
      const firstName = (p.firstName ?? '').trim();
      const lastName = (p.lastName ?? '').trim();
      const fullName = `${firstName} ${lastName}`.trim() || 'Unknown';
      const locParsed = p.location?.parsed;
      const title = this.pickApifyTitleAtCompany(p, input.companyName);
      const partial: Record<string, unknown> = {
        name: fullName,
        full_name: fullName,
        job_title: title,
        job_company_id: input.companyId,
        job_company_name: input.companyName,
        job_company_linkedin_url: input.linkedinCompanyUrl,
        linkedin_url: p.linkedinUrl ?? '',
        location_country: locParsed?.country ?? '',
        location_region: locParsed?.state ?? '',
        location_locality: locParsed?.city ?? '',
        location_name: p.location?.linkedinText ?? locParsed?.text ?? '',
        profile_picture_url: p.photo ?? p.profilePicture?.url ?? '',
        source: 'apify',
        sources: ['apify'],
        // keep original payload available for downstream experiments
        org_apify: p,
      };

      return normalizePersonForPythonOrgChartBuild(partial, {
        companyId: input.companyId,
        companyName: input.companyName,
        defaultCountry: (locParsed?.country ?? '').trim() || 'global',
      });
    });
  }

  private buildSampleCompanyOrgChartPeopleFromContactOut(input: {
    companyId: string;
    companyName: string;
    domain: string;
    totalProfiles: number;
  }): Array<Record<string, unknown>> {
    const response = generateSampleContactOutPeopleSearchResponse({
      companyName: input.companyName,
      domain: input.domain,
      totalProfiles: input.totalProfiles,
      seed: 1337,
    });
    const profiles = Object.entries(response.profiles);

    return profiles.map(([linkedinUrl, p], index) => {
      const ex = Array.isArray(p.experience) ? p.experience : [];
      const normalizedWant = input.companyName.trim().toLowerCase();
      const atCompany = ex.filter(
        (e) => (e.company_name ?? '').trim().toLowerCase() === normalizedWant,
      );
      const current = atCompany.find((e) => e.is_current === true);
      const title = current?.title?.trim() || p.title?.trim() || '';

      const fullName =
        (p.full_name ?? '').trim() || `Sample Person ${index + 1}`;
      const partial: Record<string, unknown> = {
        name: fullName,
        full_name: fullName,
        job_title: title,
        job_company_id: input.companyId,
        job_company_name: input.companyName,
        job_company_linkedin_url: `https://www.linkedin.com/company/${input.companyName
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '-')}/`,
        linkedin_url: linkedinUrl,
        location_name: p.location ?? '',
        profile_picture_url: p.profile_picture_url ?? '',
        source: 'contactout',
        sources: ['contactout'],
        org_contactout: p,
      };

      return normalizePersonForPythonOrgChartBuild(partial, {
        companyId: input.companyId,
        companyName: input.companyName,
        defaultCountry:
          typeof p.country === 'string' && p.country.trim()
            ? p.country
            : 'global',
      });
    });
  }

  private async buildSampleCompanyOrgChart(input: {
    companyId: string;
    companyName?: string;
    country?: string;
    functionRoot?: string;
    expectedEmployeeCount?: number;
    sampleSource?: string;
    apifyIncludePast: boolean;
    totalProfilesRaw?: string;
    asOfMonth?: string;
  }): Promise<Record<string, unknown>> {
    const companyName =
      (input.companyName ?? 'Sample Company').trim() || 'Sample Company';
    const totalProfilesParsed =
      input.totalProfilesRaw !== undefined
        ? Number.parseInt(input.totalProfilesRaw, 10)
        : NaN;
    const totalProfiles =
      Number.isFinite(totalProfilesParsed) && totalProfilesParsed > 0
        ? Math.min(1000, totalProfilesParsed)
        : 100;

    const sampleSource = (input.sampleSource ?? 'contactout')
      .trim()
      .toLowerCase();
    const linkedinCompanyUrl = `https://www.linkedin.com/company/${input.companyId}/`;

    const people =
      sampleSource === 'apify'
        ? this.buildSampleCompanyOrgChartPeopleFromApify({
            companyId: input.companyId,
            companyName,
            linkedinCompanyUrl,
            totalProfiles,
            includePast: input.apifyIncludePast,
          })
        : this.buildSampleCompanyOrgChartPeopleFromContactOut({
            companyId: input.companyId,
            companyName,
            domain: 'sample-company.com',
            totalProfiles,
          });

    const peopleForAsOf = input.asOfMonth?.trim()
      ? applyAsOfSnapshotToCandidates({
          candidates: people as Array<Record<string, unknown>>,
          companyName,
          asOfMonth: input.asOfMonth,
        })
      : people;

    const built =
      await this.pythonOrgChartService.createOrgChartFromStandardizedPeople({
        people: peopleForAsOf,
        jobName: companyName,
        jobId: input.companyId,
        functionRoot: input.functionRoot,
        country: input.country,
        industry: 'Computer Software',
        industryCategory: 'Computer Software',
      });

    // Ensure the caller sees sample meta too (useful for debugging UI).
    return {
      ...built,
      company_id: input.companyId,
      job_company_id: input.companyId,
      job_company_name: companyName,
      job_company_linkedin_url: linkedinCompanyUrl,
      people_count: people.length,
      sample_source: sampleSource,
      sample_profiles_requested: totalProfiles,
      sample_apify_include_past: input.apifyIncludePast,
      ...(input.asOfMonth ? { as_of_month: input.asOfMonth } : {}),
    };
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

  /**
   * Org-chart structured context (company, mode, filters) → unresolved LinkedIn search parameters.
   * Candidate-search pipeline endpoints accept free text only; use this from org-chart flows.
   */
  @Post('generate-unresolved-search-parameters')
  async generateUnresolvedOrgChartSearchParameters(
    @Body()
    body: {
      prompt: string;
      rawQuery?: string;
      cleanedQuery?: string;
      searchType: 'classic' | 'sales_navigator' | 'recruiter';
      searchCategory: 'people' | 'companies' | 'posts' | 'jobs';
      orgChartContext: {
        mode?: string;
        companyName?: string;
        jobTitles?: string[];
        country?: string;
        functionRoot?: string;
        businessDivisionRawQuery?: string;
        businessDivisionLinkedinKeywords?: string;
      };
      queryGenerator?: 'python' | 'multi_agent';
      candidateSource?: OrgChartLinkedinCandidateSource;
    },
    @Req() req: Request,
  ): Promise<{
    searchParameters: GeneratedSearchParameters | Record<string, unknown>;
    searchStrategies?:
      | Array<
          | ClassicPeopleSearchStrategyResult
          | SalesNavigatorPeopleSearchStrategyResult
          | RecruiterPeopleSearchStrategyResult
        >
      | undefined;
  }> {
    const apiToken = this.getAuthToken(req);

    if (!apiToken) {
      throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
    }
    if (body.prompt == null || typeof body.prompt !== 'string') {
      throw new HttpException(
        'prompt is required and must be a string',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (
      body.orgChartContext === undefined ||
      body.orgChartContext === null ||
      typeof body.orgChartContext !== 'object'
    ) {
      throw new HttpException(
        'orgChartContext is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const rawQuery = body.rawQuery ?? body.prompt;
    const cleanedQuery = body.cleanedQuery ?? body.prompt;
    const orgChartGenerateOptions = {
      orgChartContext: body.orgChartContext,
      queryGenerator: body.queryGenerator,
      ...(body.candidateSource !== undefined
        ? { candidateSource: body.candidateSource }
        : {}),
    };

    const unresolvedSearchParams =
      await this.candidateSearchHandlerService.generateUnresolvedSearchParams(
        rawQuery,
        cleanedQuery,
        body.searchType,
        body.searchCategory,
        apiToken,
        body.prompt,
        undefined,
        undefined,
        undefined,
        false,
        undefined,
        orgChartGenerateOptions,
      );

    const searchParamKey = constructSearchParamKey(
      body.searchType,
      body.searchCategory,
    );
    const primaryParams =
      unresolvedSearchParams[searchParamKey] ?? unresolvedSearchParams;
    const strategiesKey = `${searchParamKey}Strategies`;
    const strategies =
      body.searchCategory === 'people'
        ? ((unresolvedSearchParams[strategiesKey] as
            | Array<
                | ClassicPeopleSearchStrategyResult
                | SalesNavigatorPeopleSearchStrategyResult
                | RecruiterPeopleSearchStrategyResult
              >
            | undefined) ?? [])
        : undefined;

    return {
      searchParameters: primaryParams,
      searchStrategies: strategies,
    };
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
        | 'business_division_map'
        | 'selected_nodes';
      maxPages?: number;
      searchType?: 'classic' | 'sales_navigator' | 'recruiter';
      requestId?: string;
      country?: string;
      functionRoot?: string;
      stdFunction?: string;
      stdGrade?: string;
      linkedinCompanyUrl?: string;
      linkedinUnipileAccountId?: string;
      candidateSource?: OrgChartLinkedinCandidateSource;
      /** Raw industry label (e.g. "Computer Software") forwarded to Python list_data.industry */
      industry?: string;
      /** Macro category override forwarded to Python list_data.industry_category */
      industryCategory?: string;
      multiSource?: boolean;
      sources?: string[];
      apifyMaxItems?: number;
      profileScraperMode?: string;
      businessDivisionRawQuery?: string;
      validateAndScoreLinkedInResults?: boolean;
      queryGenerator?: 'python' | 'multi_agent';
      xraySearchEngine?: LinkedinXraySearchEngine;
      includePaginatedHtml?: boolean;
    },
    @Query('account_id') accountIdQuery: string | undefined,
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

      const mergedBody = {
        ...body,
        linkedinUnipileAccountId:
          accountIdQuery?.trim() || body.linkedinUnipileAccountId?.trim(),
      };

      return await this.orgChartLinkedInBuildService.searchOrgchartFromLinkedIn(
        mergedBody,
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

  /**
   * Clears Redis org-chart keys and S3 persisted folder for the company (authenticated user).
   */
  @Post('company-cache/clear')
  async clearCompanyOrgChartCache(
    @Body() body: { companyId?: string; companyName?: string },
    @Req() req: Request,
  ) {
    const authToken = this.getAuthToken(req);

    if (!authToken) {
      throw new HttpException(
        'Authentication required',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const companyId = body?.companyId?.trim();
    const companyName = body?.companyName?.trim();

    if (!companyId && !companyName) {
      throw new HttpException(
        'At least one of companyId or companyName is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      await this.orgChartService.clearCompanyOrgChartCaches({
        companyId: companyId || undefined,
        companyName: companyName || undefined,
      });

      return { status: 'ok' as const };
    } catch (error) {
      this.logger.error('Clear company org chart cache failed', error);
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Failed to clear org chart cache',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Persists contact enrichment (emails/phones/linkedinUrl/fullName) back into the
   * stored org chart (Redis + S3) so reloads don't re-consume credits.
   */
  @Post(':companyId/enrichment/apply')
  async applyOrgChartEnrichment(
    @Param('companyId') companyId: string,
    @Body()
    body: {
      companyName?: string;
      m7kqPersonId?: string;
      companyDomain?: string;
      linkedinUrl?: string;
      emails?: string[];
      phones?: string[];
      fullName?: string;
      source?: string;
    },
    @Req() req: Request,
  ) {
    const authToken = this.getAuthToken(req);

    if (!authToken) {
      throw new HttpException(
        'Authentication required',
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (!companyId || companyId.includes('/') || companyId.includes('..')) {
      throw new HttpException('Invalid company ID', HttpStatus.BAD_REQUEST);
    }

    const normalizedCompanyId = this.normalizeCompanyId(companyId);

    try {
      const result = await this.orgChartService.applyEnrichmentToStoredOrgChart(
        normalizedCompanyId,
        {
          companyName: body.companyName,
          m7kqPersonId: body.m7kqPersonId,
          companyDomain: body.companyDomain,
          linkedinUrl: body.linkedinUrl,
          emails: body.emails,
          phones: body.phones,
          fullName: body.fullName,
          source: body.source,
        },
        authToken,
      );

      return { status: 'ok' as const, ...result };
    } catch (error) {
      this.logger.error(
        `Apply org chart enrichment failed for companyId=${companyId}`,
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to persist enrichment',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('from-job')
  async buildOrgChartFromJobCandidates(
    @Body() body: { jobId: string; jobName?: string },
    @Req() req: Request,
  ) {
    const authToken = this.getAuthToken(req);

    if (!authToken) {
      throw new HttpException(
        'Authentication required',
        HttpStatus.UNAUTHORIZED,
      );
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
        throw new HttpException(
          'Authentication required',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const workspaceMemberId = (req as { workspaceMemberId?: string })
        .workspaceMemberId;
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
