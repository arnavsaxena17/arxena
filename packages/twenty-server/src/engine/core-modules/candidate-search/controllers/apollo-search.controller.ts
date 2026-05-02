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
} from '@nestjs/common';

import { ApolloIoRestService } from '../services/apollo-io-rest.service';
import { ApolloPeopleSearchTransformerService } from '../services/apollo-people-search-transformer.service';

type ApolloPeopleSearchBody = {
  keywords?: string;
  personTitles?: string[];
  organizationIds?: string[];
  personLocations?: string[];
  organizationLocations?: string[];
  includeSimilarTitles?: boolean;
  page?: number;
  perPage?: number;
};

const retryOrganisationSearchForId = false

type ApolloCompaniesSearchBody = {
  organizationName?: string;
  domains?: string[];
  organizationLocations?: string[];
  page?: number;
  perPage?: number;
};

@Controller('candidate-search/apollo')
export class ApolloSearchController {
  private readonly logger = new Logger(ApolloSearchController.name);

  constructor(
    private readonly apolloIoRestService: ApolloIoRestService,
    private readonly apolloPeopleSearchTransformer: ApolloPeopleSearchTransformerService,
  ) {}

  @Post('people')
  async searchPeople(
    @Body() body: ApolloPeopleSearchBody,
    @Req() req: { headers: { authorization?: string } },
  ) {
    const apiToken = req.headers.authorization?.replace('Bearer ', '');
    if (!apiToken) {
      throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
    }
    if (!this.apolloIoRestService.isConfigured()) {
      throw new HttpException(
        'Apollo API is not configured (APOLLO_API_KEY)',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    try {
      const raw = await this.apolloIoRestService.peopleSearch({
        q_keywords: body.keywords,
        person_titles: body.personTitles,
        organization_ids: body.organizationIds,
        person_locations: body.personLocations,
        organization_locations: body.organizationLocations,
        include_similar_titles: body.includeSimilarTitles,
        page: body.page,
        per_page: body.perPage,
      });

      const transformedCandidates =
        this.apolloPeopleSearchTransformer.transformApolloPeopleToTableRows(
          raw as Record<string, unknown>,
        );

      const pagination = raw.pagination as
        | Record<string, unknown>
        | undefined;
      const totalEntries =
        typeof pagination?.total_entries === 'number'
          ? pagination.total_entries
          : transformedCandidates.length;

      return {
        searchResults: {
          items: transformedCandidates,
          cursor:
            typeof pagination?.page === 'number' &&
            typeof pagination?.total_pages === 'number'
              ? String(pagination.page)
              : null,
          paging: {
            total_count: totalEntries,
            page: pagination?.page,
            per_page: pagination?.per_page,
            total_pages: pagination?.total_pages,
          },
        },
        transformedCandidates,
        resolvedSearchParameters: body,
        searchMetadata: {
          searchType: 'apollo',
          searchCategory: 'people',
          timestamp: new Date().toISOString(),
        },
        rawApolloResponse: raw,
      };
    } catch (error: unknown) {
      this.logger.error('Apollo people search failed', error);
      const message =
        error instanceof Error ? error.message : 'Apollo people search failed';
      const status =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { status?: number } }).response?.status
          : undefined;
      throw new HttpException(
        message,
        status === 429 ? HttpStatus.TOO_MANY_REQUESTS : HttpStatus.BAD_GATEWAY,
      );
    }
  }

  @Post('companies')
  async searchCompanies(
    @Body() body: ApolloCompaniesSearchBody,
    @Req() req: { headers: { authorization?: string } },
  ) {
    const apiToken = req.headers.authorization?.replace('Bearer ', '');
    if (!apiToken) {
      throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
    }
    if (!this.apolloIoRestService.isConfigured()) {
      throw new HttpException(
        'Apollo API is not configured (APOLLO_API_KEY)',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    this.logger.log(
      `Apollo searchCompanies request organizationName="${(body.organizationName ?? '').slice(0, 120)}" page=${body.page ?? 1} perPage=${body.perPage ?? 10}`,
    );

    try {
      const raw = await this.apolloIoRestService.organizationsSearch({
        q_organization_name: body.organizationName,
        q_organization_domains_list: body.domains,
        organization_locations: body.organizationLocations,
        page: body.page,
        per_page: body.perPage,
      });
      return { organizations: raw, status: 'ok' as const };
    } catch (error: unknown) {
      this.logger.error('Apollo companies search failed', error);
      const message =
        error instanceof Error
          ? error.message
          : 'Apollo companies search failed';
      throw new HttpException(message, HttpStatus.BAD_GATEWAY);
    }
  }

  @Get('organizations/:organizationId/job-postings')
  async getJobPostings(
    @Param('organizationId') organizationId: string,
    @Query('page') page?: string,
    @Query('per_page') perPage?: string,
    @Req() req?: { headers: { authorization?: string } },
  ) {
    const apiToken = req?.headers.authorization?.replace('Bearer ', '');
    if (!apiToken) {
      throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
    }
    if (!this.apolloIoRestService.isConfigured()) {
      throw new HttpException(
        'Apollo API is not configured (APOLLO_API_KEY)',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    try {
      const parsedPage = page ? parseInt(page, 10) : undefined;
      const parsedPerPage = perPage ? parseInt(perPage, 10) : undefined;
      const raw = await this.apolloIoRestService.organizationJobPostings(
        organizationId,
        parsedPage,
        parsedPerPage,
      );
      return { jobPostings: raw, status: 'ok' as const };
    } catch (error: unknown) {
      this.logger.error('Apollo job postings failed', error);
      const message =
        error instanceof Error ? error.message : 'Apollo job postings failed';
      throw new HttpException(message, HttpStatus.BAD_GATEWAY);
    }
  }
}
