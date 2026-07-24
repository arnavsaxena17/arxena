import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';

import { ApolloIoRestService } from 'src/engine/core-modules/candidate-search/services/apollo-io-rest.service';
import { TitleTaxonomyRemoteService } from 'src/engine/core-modules/candidate-search/services/title-taxonomy-remote.service';
import { ContactOutPeopleSearchService } from 'src/engine/core-modules/org-chart/services/contactout-people-search.service';
import { HarvestLinkedinService } from 'src/engine/core-modules/org-chart/services/harvest-linkedin.service';
import { PdlPersonOrgMovementService } from 'src/engine/core-modules/org-chart/services/pdl-person-org-movement.service';
import { PeopleEsService } from 'src/engine/core-modules/org-chart/services/people-es.service';

import {
  PEOPLE_DATA_SOURCE_CATEGORIES,
  type PeopleDataSourceAlias,
} from './constants/people-data-source-aliases';
import type { PeopleSearchDto } from './dto/people-search.dto';
import type { TitleFromJobSearchDto } from './dto/title-from-job-search.dto';
import type {
  DataSourcesStatusResponse,
  PeopleSearchByTitleResponse,
  PeopleSearchResponse,
  TaxonomyItem,
} from './people-api.types';
import { extractTaxonomyItemValue } from './utils/extract-taxonomy-item-value.util';

@Injectable()
export class PeopleApiService {
  private readonly logger = new Logger(PeopleApiService.name);

  constructor(
    private readonly peopleEsService: PeopleEsService,
    private readonly titleTaxonomyRemoteService: TitleTaxonomyRemoteService,
    private readonly apolloIoRestService: ApolloIoRestService,
    private readonly pdlPersonOrgMovementService: PdlPersonOrgMovementService,
    private readonly contactOutPeopleSearchService: ContactOutPeopleSearchService,
    private readonly harvestLinkedinService: HarvestLinkedinService,
  ) {}

  getDataSourcesStatus(): DataSourcesStatusResponse {
    const configuredByAlias: Record<PeopleDataSourceAlias, boolean> = {
      index: this.peopleEsService.isEnabled(),
      apollo: this.apolloIoRestService.isConfigured(),
      pdl: this.pdlPersonOrgMovementService.isConfigured(),
      contactout: this.contactOutPeopleSearchService.isConfigured(),
      harvest: this.harvestLinkedinService.isConfigured(),
    };

    return {
      status: 'ok',
      sources: PEOPLE_DATA_SOURCE_CATEGORIES.map((category) => ({
        alias: category.alias,
        label: category.label,
        description: category.description,
        supportsStdFunctionFilter: category.supportsStdFunctionFilter,
        supportsStdGradeFilter: category.supportsStdGradeFilter,
        configured: configuredByAlias[category.alias],
      })),
    };
  }

  async getFunctionRoots(title?: string): Promise<{
    status: 'ok';
    items?: TaxonomyItem[];
    item?: TaxonomyItem | null;
  }> {
    const result = await this.titleTaxonomyRemoteService.getFunctionRoots(title);
    if (Array.isArray(result)) {
      return { status: 'ok', items: result };
    }
    return { status: 'ok', item: result };
  }

  async getFunctions(
    functionRoot?: string,
    title?: string,
  ): Promise<{
    status: 'ok';
    items?: TaxonomyItem[];
    item?: TaxonomyItem | null;
  }> {
    const result = await this.titleTaxonomyRemoteService.getFunctions(
      functionRoot,
      title,
    );
    if (Array.isArray(result)) {
      return { status: 'ok', items: result };
    }
    return { status: 'ok', item: result };
  }

  async getGrades(
    gradeLevel?: string,
    title?: string,
  ): Promise<{
    status: 'ok';
    items?: TaxonomyItem[];
    item?: TaxonomyItem | null;
  }> {
    const result = await this.titleTaxonomyRemoteService.getGrades(
      gradeLevel,
      title,
    );
    if (Array.isArray(result)) {
      return { status: 'ok', items: result };
    }
    return { status: 'ok', item: result };
  }

  async searchPeopleByJobTitle(
    body: TitleFromJobSearchDto,
  ): Promise<PeopleSearchByTitleResponse> {
    const jobTitle = body.jobTitle?.trim();
    if (!jobTitle) {
      throw new HttpException('jobTitle is required', HttpStatus.BAD_REQUEST);
    }

    const hasCompanyScope =
      !!body.companyId?.trim() ||
      !!body.companyName?.trim() ||
      !!body.website?.trim();

    if (!hasCompanyScope) {
      throw new HttpException(
        'At least one of companyId, companyName, or website is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const classification =
      await this.titleTaxonomyRemoteService.classifyTitle(jobTitle);

    if (!classification) {
      throw new HttpException(
        'Title taxonomy service is unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const stdFunction = extractTaxonomyItemValue(classification.function);
    const stdFunctionRoot = extractTaxonomyItemValue(
      classification.function_root,
    );
    const stdGrade = extractTaxonomyItemValue(classification.grade);

    if (!stdFunction && !stdGrade) {
      throw new HttpException(
        `Could not resolve std_function or std_grade from job title: "${jobTitle}"`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    this.logger.log(
      `Title resolve jobTitle="${jobTitle}" stdFunction=${stdFunction ?? ''} stdGrade=${stdGrade ?? ''} stdFunctionRoot=${stdFunctionRoot ?? ''}`,
    );

    const searchResult = await this.searchPeople({
      dataSource: body.dataSource,
      companyId: body.companyId,
      companyName: body.companyName,
      website: body.website,
      country: body.country,
      stdFunction: stdFunction ?? undefined,
      stdGrade: stdGrade ?? undefined,
      jobTitle,
      limit: body.limit,
      offset: body.offset,
    });

    return {
      ...searchResult,
      resolved: {
        jobTitle,
        normalizedTitle: classification.normalized_title?.trim() || null,
        stdFunction,
        stdFunctionRoot,
        stdGrade,
        confidence: classification.confidence ?? 0,
      },
    };
  }

  async searchPeople(body: PeopleSearchDto): Promise<PeopleSearchResponse> {
    const dataSource = body.dataSource ?? 'index';

    this.logger.log(
      `People API search dataSource=${dataSource} stdFunction=${body.stdFunction ?? ''} stdGrade=${body.stdGrade ?? ''}`,
    );

    if (dataSource === 'index') {
      return this.searchPeopleFromIndex(body, dataSource);
    }

    if (dataSource === 'apollo') {
      return this.searchPeopleFromApollo(body, dataSource);
    }

    if (dataSource === 'contactout') {
      return this.searchPeopleFromContactOut(body, dataSource);
    }

    if (dataSource === 'pdl' || dataSource === 'harvest') {
      throw new HttpException(
        `People search via data source "${dataSource}" is not yet exposed on this endpoint. Use dataSource "index" for std_function and std_grade filters.`,
        HttpStatus.NOT_IMPLEMENTED,
      );
    }

    throw new HttpException(
      `Unknown data source "${dataSource}"`,
      HttpStatus.BAD_REQUEST,
    );
  }

  private async searchPeopleFromIndex(
    body: PeopleSearchDto,
    dataSource: PeopleDataSourceAlias,
  ): Promise<PeopleSearchResponse> {
    if (!this.peopleEsService.isEnabled()) {
      throw new HttpException(
        'People index is not configured (set ES_ENDPOINT)',
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

    const result = await this.peopleEsService.searchPeople({
      query: body.query,
      personName: body.personName,
      jobTitle: body.jobTitle,
      companyId: body.companyId,
      companyName: body.companyName,
      website: body.website,
      stdFunction: body.stdFunction,
      stdGrade: body.stdGrade,
      country: body.country,
      linkedinUrl: body.linkedinUrl,
      limit: body.limit,
      offset: body.offset,
    });

    return {
      status: 'ok',
      dataSource,
      total: result.total,
      items: result.items,
    };
  }

  private async searchPeopleFromApollo(
    body: PeopleSearchDto,
    dataSource: PeopleDataSourceAlias,
  ): Promise<PeopleSearchResponse> {
    if (!this.apolloIoRestService.isConfigured()) {
      throw new HttpException(
        'Apollo data source is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const domain = body.website?.trim();
    const companyName = body.companyName?.trim();
    if (!domain && !companyName) {
      throw new HttpException(
        'companyName or website is required for apollo data source',
        HttpStatus.BAD_REQUEST,
      );
    }

    const titleParts = [body.stdFunction, body.stdGrade, body.jobTitle]
      .map((value) => value?.trim())
      .filter((value): value is string => !!value);

    const raw = await this.apolloIoRestService.peopleSearch({
      q_keywords: body.query,
      person_titles: titleParts.length > 0 ? titleParts : undefined,
      person_locations: body.country?.trim() ? [body.country.trim()] : undefined,
      q_organization_domains_list: domain ? [domain] : undefined,
      per_page: body.limit ?? 20,
      page:
        body.offset && body.limit
          ? Math.floor(body.offset / body.limit) + 1
          : 1,
    });

    const people = Array.isArray((raw as { people?: unknown }).people)
      ? ((raw as { people: Record<string, unknown>[] }).people ?? [])
      : [];

    return {
      status: 'ok',
      dataSource,
      total: people.length,
      items: people,
    };
  }

  private async searchPeopleFromContactOut(
    body: PeopleSearchDto,
    dataSource: PeopleDataSourceAlias,
  ): Promise<PeopleSearchResponse> {
    if (!this.contactOutPeopleSearchService.isConfigured()) {
      throw new HttpException(
        'ContactOut data source is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const companyName = body.companyName?.trim();
    const domain = body.website?.trim();
    if (!companyName && !domain) {
      throw new HttpException(
        'companyName or website is required for contactout data source',
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = await this.contactOutPeopleSearchService.searchCompanyPeople({
      companyName,
      domain,
      maxScanProfiles: body.limit ?? 20,
    });

    const items = result.profiles.map(({ linkedinUrl, profile }) => ({
      linkedin_url: linkedinUrl,
      full_name: profile.full_name,
      job_title: profile.title ?? profile.headline,
      location_country: profile.country ?? profile.location,
      data_source: dataSource,
    }));

    return {
      status: 'ok',
      dataSource,
      total: result.totalResults,
      items,
    };
  }
}
