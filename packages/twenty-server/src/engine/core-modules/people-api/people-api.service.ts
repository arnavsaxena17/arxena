import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

import { ApolloIoRestService } from 'src/engine/core-modules/candidate-search/services/apollo-io-rest.service';
import { TitleTaxonomyRemoteService } from 'src/engine/core-modules/candidate-search/services/title-taxonomy-remote.service';
import { ContactOutPeopleSearchService } from 'src/engine/core-modules/org-chart/services/contactout-people-search.service';
import { HarvestLinkedinService } from 'src/engine/core-modules/org-chart/services/harvest-linkedin.service';
import { PdlPersonOrgMovementService } from 'src/engine/core-modules/org-chart/services/pdl-person-org-movement.service';
import { PeopleEsService } from 'src/engine/core-modules/org-chart/services/people-es.service';

import { resolveApolloFilters } from 'src/engine/core-modules/candidate-search/constants/taxonomy-platform-maps';
import {
  PEOPLE_DATA_SOURCE_CATEGORIES,
  type PeopleDataSourceAlias,
} from './constants/people-data-source-aliases';
import {
  PEOPLE_TAXONOMY_FUNCTION_ROOT_VALUES,
  PEOPLE_TAXONOMY_GRADE_VALUES,
  TAXONOMY_FUNCTION_ROOT_CONSTANTS,
  TAXONOMY_GRADE_CATEGORY_CONSTANTS,
  TAXONOMY_GRADE_LEVEL_CONSTANTS,
  type TaxonomyConstantsResponse,
} from './constants/taxonomy-constants';
import type { ExpandJobTitlesDto } from './dto/expand-job-titles.dto';
import type { PeopleSearchByTaxonomyDto } from './dto/people-search-by-taxonomy.dto';
import type { PeopleSearchDto } from './dto/people-search.dto';
import type { TaxonomyBooleanStringsDto } from './dto/taxonomy-boolean-strings.dto';
import type { TaxonomyManualBooleanQueriesDto } from './dto/taxonomy-manual-boolean-queries.dto';
import type {
  DataSourcesStatusResponse,
  ExpandJobTitlesResponse,
  PeopleSearchByTaxonomyResponse,
  PeopleSearchResponse,
  TaxonomyBooleanStringsResponse,
  TaxonomyManualBooleanQueriesResponse,
  TaxonomyItem,
  TaxonomyTreeResponse,
} from './people-api.types';
import {
  PeopleCompanyScopeResolver,
  type PeopleCompanyScope,
} from './services/people-company-scope.resolver';
import { PeopleLinkedInSourcingService } from './services/people-linkedin-sourcing.service';
import { PeopleSearchDataSourceResolver } from './services/people-search-data-source.resolver';
import {
  PeopleLocationScopeResolver,
  type PeopleLocationScope,
} from './services/people-location-scope.resolver';
import { buildTaxonomyTreeFromFlatLists } from './utils/build-taxonomy-tree.util';
import { collectPeopleSearchLocations } from './utils/collect-people-search-locations.util';
import { extractCandidateExperience } from './utils/extract-candidate-experience.util';
import { extractCandidateJobTitle } from './utils/extract-candidate-job-title.util';
import { extractTaxonomyItemValue } from './utils/extract-taxonomy-item-value.util';
import {
  classificationToResolvedFields,
  matchesTaxonomyFilter,
} from './utils/filter-people-by-taxonomy.util';
import {
  findStdFunctionCatalogMatch,
  listStdFunctionItemsForRoot,
  matchStdFunctionRoot,
  matchStdGrade,
} from './utils/match-people-taxonomy-filter.util';
import {
  PEOPLE_SEARCH_COMPANY_REQUIRED_MESSAGE,
  PeopleNaturalLanguageParserService,
} from './services/people-natural-language-parser.service';

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
    private readonly peopleLinkedInSourcingService: PeopleLinkedInSourcingService,
    private readonly peopleCompanyScopeResolver: PeopleCompanyScopeResolver,
    private readonly peopleLocationScopeResolver: PeopleLocationScopeResolver,
    private readonly peopleNaturalLanguageParserService: PeopleNaturalLanguageParserService,
    private readonly peopleSearchDataSourceResolver: PeopleSearchDataSourceResolver,
  ) {}

  getDataSourcesStatus(): DataSourcesStatusResponse {
    const unipileConfigured =
      this.peopleLinkedInSourcingService.isUnipileConfigured();
    const configuredByAlias: Record<PeopleDataSourceAlias, boolean> = {
      auto: unipileConfigured,
      index: this.peopleEsService.isEnabled(),
      apollo: this.apolloIoRestService.isConfigured(),
      pdl: this.pdlPersonOrgMovementService.isConfigured(),
      contactout: this.contactOutPeopleSearchService.isConfigured(),
      harvest: this.harvestLinkedinService.isConfigured(),
      unipile: unipileConfigured,
      pool: unipileConfigured,
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

  getTaxonomyConstants(): TaxonomyConstantsResponse {
    return {
      status: 'ok',
      gradeLevels: TAXONOMY_GRADE_LEVEL_CONSTANTS,
      gradeCategories: TAXONOMY_GRADE_CATEGORY_CONSTANTS,
      functionRoots: TAXONOMY_FUNCTION_ROOT_CONSTANTS,
    };
  }

  async getTaxonomyTree(): Promise<TaxonomyTreeResponse> {
    const [rootsResult, functionsResult] = await Promise.all([
      this.titleTaxonomyRemoteService.getFunctionRoots(),
      this.titleTaxonomyRemoteService.getFunctions(),
    ]);

    const roots = Array.isArray(rootsResult) ? rootsResult : [];
    const functions = Array.isArray(functionsResult) ? functionsResult : [];

    return {
      status: 'ok',
      gradeLevels: TAXONOMY_GRADE_LEVEL_CONSTANTS,
      functionRoots: buildTaxonomyTreeFromFlatLists(roots, functions),
    };
  }

  async getFunctionRoots(title?: string): Promise<{
    status: 'ok';
    items?: TaxonomyItem[];
    item?: TaxonomyItem | null;
  }> {
    const result =
      await this.titleTaxonomyRemoteService.getFunctionRoots(title);
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

  async searchPeople(
    body: PeopleSearchDto,
    apiToken?: string,
    options?: { workspaceId?: string },
  ): Promise<PeopleSearchResponse> {
    await this.assertTaxonomyFilters(body);

    const naturalLanguage = body.naturalLanguage?.trim();
    if (naturalLanguage && !body.searchUrl?.trim()) {
      return this.searchPeopleFromNaturalLanguage(
        body,
        naturalLanguage,
        apiToken,
        options,
      );
    }

    return this.executePeopleSearch(body, apiToken, options);
  }

  private async searchPeopleFromNaturalLanguage(
    body: PeopleSearchDto,
    naturalLanguage: string,
    apiToken?: string,
    options?: { workspaceId?: string },
  ): Promise<PeopleSearchResponse> {
    const parsed =
      await this.peopleNaturalLanguageParserService.parse(naturalLanguage);
    const jobTitle = parsed.jobTitle;

    const companyId = body.companyId?.trim() || undefined;
    const companyName = body.companyName?.trim() || parsed.companyName;
    const website = body.website?.trim() || parsed.website;
    const linkedinCompanyUrl = body.linkedinCompanyUrl?.trim() || undefined;
    const locations = collectPeopleSearchLocations({
      locations: [...(body.locations ?? []), parsed.location],
      country: body.country,
    });

    if (!companyId && !companyName && !website && !linkedinCompanyUrl) {
      throw new HttpException(
        PEOPLE_SEARCH_COMPANY_REQUIRED_MESSAGE,
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
      `Title resolve jobTitle="${jobTitle}" stdFunction=${stdFunction ?? ''} stdGrade=${stdGrade ?? ''} stdFunctionRoot=${stdFunctionRoot ?? ''} locations=${locations.join('|')}`,
    );

    const searchResult = await this.executePeopleSearch(
      {
        dataSource: body.dataSource,
        accountId: body.accountId,
        companyId,
        companyName,
        website,
        linkedinCompanyUrl,
        locations,
        country: body.country,
        stdFunction: stdFunction ?? undefined,
        stdFunctionRoot: stdFunctionRoot ?? undefined,
        stdGrade: stdGrade ?? undefined,
        jobTitle,
        limit: body.limit,
        offset: body.offset,
      },
      apiToken,
      options,
    );

    return {
      ...searchResult,
      resolved: {
        jobTitle,
        normalizedTitle: classification.normalized_title?.trim() || null,
        stdFunction,
        stdFunctionRoot,
        stdGrade,
        confidence: classification.confidence ?? 0,
        location: parsed.location ?? locations[0] ?? null,
      },
    };
  }

  private async executePeopleSearch(
    body: PeopleSearchDto,
    apiToken?: string,
    options?: { workspaceId?: string },
  ): Promise<PeopleSearchResponse> {
    const resolvedSource = await this.peopleSearchDataSourceResolver.resolve({
      dataSource: body.dataSource,
      accountId: body.accountId,
      apiToken,
      workspaceId: options?.workspaceId,
    });
    const sourcedBody: PeopleSearchDto = {
      ...body,
      dataSource: resolvedSource.dataSource,
      accountId: resolvedSource.accountId ?? body.accountId,
    };
    const companyScope = await this.peopleCompanyScopeResolver.resolve({
      companyName: sourcedBody.companyName,
      companyId: sourcedBody.companyId,
      website: sourcedBody.website,
      linkedinCompanyUrl: sourcedBody.linkedinCompanyUrl,
      country: sourcedBody.country,
      authToken: apiToken,
    });
    const searchLocations = collectPeopleSearchLocations(sourcedBody);
    const locationScope = await this.peopleLocationScopeResolver.resolve({
      location: searchLocations[0],
      country: sourcedBody.country,
      accountId: sourcedBody.accountId,
      dataSource: sourcedBody.dataSource,
    });
    const additionalLocationIds: string[] = [];
    for (const extraLocation of searchLocations.slice(1)) {
      const extraScope = await this.peopleLocationScopeResolver.resolve({
        location: extraLocation,
        accountId: sourcedBody.accountId,
        dataSource: sourcedBody.dataSource,
      });
      if (extraScope.linkedinLocationId) {
        additionalLocationIds.push(extraScope.linkedinLocationId);
      }
    }
    const locationIds = [
      ...(locationScope.linkedinLocationId
        ? [locationScope.linkedinLocationId]
        : []),
      ...additionalLocationIds,
    ];
    locationScope.linkedinLocationIds = locationIds;
    const scopedBody: PeopleSearchDto = {
      ...sourcedBody,
      companyName: companyScope.companyName ?? sourcedBody.companyName,
      companyId: companyScope.companyId ?? sourcedBody.companyId,
      website: companyScope.website ?? sourcedBody.website,
      linkedinCompanyUrl:
        companyScope.linkedinUrl ?? sourcedBody.linkedinCompanyUrl,
      locations: searchLocations,
      country:
        locationScope.linkedinLocationName ??
        locationScope.raw ??
        sourcedBody.country,
    };
    const dataSource = scopedBody.dataSource ?? resolvedSource.dataSource;
    const searchUrl = scopedBody.searchUrl?.trim();

    if (
      searchUrl &&
      dataSource !== 'harvest' &&
      dataSource !== 'unipile' &&
      dataSource !== 'pool'
    ) {
      throw new HttpException(
        'searchUrl requires dataSource harvest, unipile, pool, or auto with a connected LinkedIn Unipile account',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.log(
      `People API search dataSource=${dataSource} stdFunction=${scopedBody.stdFunction ?? ''} stdGrade=${scopedBody.stdGrade ?? ''} companyVia=${companyScope.resolvedVia} companyId=${companyScope.companyId ?? ''} website=${companyScope.website ?? ''} locationVia=${locationScope.resolvedVia} location=${locationScope.linkedinLocationName ?? locationScope.raw ?? ''}`,
    );

    const result = await this.dispatchPeopleSearch(
      scopedBody,
      dataSource,
      apiToken,
      locationScope,
    );

    return this.mergeLocationScopeIntoResult(
      this.mergeCompanyScopeIntoResult(result, companyScope),
      locationScope,
    );
  }

  private async dispatchPeopleSearch(
    body: PeopleSearchDto,
    dataSource: PeopleDataSourceAlias,
    apiToken?: string,
    locationScope?: PeopleLocationScope,
  ): Promise<PeopleSearchResponse> {
    if (dataSource === 'index') {
      return this.searchPeopleFromIndex(body, dataSource, locationScope);
    }

    if (dataSource === 'apollo') {
      return this.searchPeopleFromApollo(body, dataSource, locationScope);
    }

    if (dataSource === 'contactout') {
      return this.searchPeopleFromContactOut(body, dataSource);
    }

    if (dataSource === 'pdl') {
      throw new HttpException(
        `People search via data source "pdl" is not yet exposed on this endpoint.`,
        HttpStatus.NOT_IMPLEMENTED,
      );
    }

    if (
      dataSource === 'harvest' ||
      dataSource === 'unipile' ||
      dataSource === 'pool'
    ) {
      return this.searchPeopleFromLinkedIn(
        body,
        dataSource,
        apiToken,
        locationScope,
      );
    }

    throw new HttpException(
      `Unknown data source "${dataSource}"`,
      HttpStatus.BAD_REQUEST,
    );
  }

  private mergeCompanyScopeIntoResult(
    result: PeopleSearchResponse,
    companyScope: PeopleCompanyScope,
  ): PeopleSearchResponse {
    const existingCompany = result.query?.company;
    const slug =
      existingCompany?.slug?.trim() || companyScope.companyId || null;
    const linkedinUrl =
      existingCompany?.linkedinUrl?.trim() || companyScope.linkedinUrl || null;
    const website =
      companyScope.website?.trim() || existingCompany?.website || null;

    return {
      ...result,
      query: {
        ...result.query,
        company: {
          name:
            existingCompany?.name?.trim() || companyScope.companyName || null,
          slug,
          linkedinUrl,
          website,
          resolvedVia: companyScope.resolvedVia,
        },
      },
    };
  }

  private mergeLocationScopeIntoResult(
    result: PeopleSearchResponse,
    locationScope: PeopleLocationScope,
  ): PeopleSearchResponse {
    if (locationScope.resolvedVia === 'omitted') {
      return result;
    }

    return {
      ...result,
      query: {
        ...result.query,
        location: {
          raw: locationScope.raw ?? null,
          linkedinId: locationScope.linkedinLocationId ?? null,
          title: locationScope.linkedinLocationName ?? null,
          resolvedVia: locationScope.resolvedVia,
        },
      },
    };
  }

  async searchPeopleByTaxonomy(
    body: PeopleSearchByTaxonomyDto,
    apiToken: string,
  ): Promise<PeopleSearchByTaxonomyResponse> {
    const stdFunction = body.stdFunction?.trim() || undefined;
    const stdFunctionRoot = body.stdFunctionRoot?.trim() || undefined;
    const stdGrade = body.stdGrade?.trim() || undefined;

    await this.assertTaxonomyFilters({
      stdFunction,
      stdFunctionRoot,
      stdGrade,
    });

    this.assertTaxonomySearchInput({
      stdFunction,
      stdFunctionRoot,
      stdGrade,
      website: body.website,
      linkedinCompanyUrl: body.linkedinCompanyUrl,
      companyId: body.companyId,
      companyName: body.companyName,
    });

    const dataSource = body.dataSource ?? 'unipile';
    const searchResult = await this.searchPeople(
      {
        dataSource,
        accountId: body.accountId,
        website: body.website,
        linkedinCompanyUrl: body.linkedinCompanyUrl,
        companyId: body.companyId,
        companyName: body.companyName,
        stdFunction,
        stdFunctionRoot,
        stdGrade,
        location: body.location,
        country: body.country,
        limit: body.limit,
      },
      apiToken,
    );

    if (
      searchResult.dataSource !== 'harvest' &&
      searchResult.dataSource !== 'unipile' &&
      searchResult.dataSource !== 'pool'
    ) {
      throw new HttpException(
        `Unexpected data source "${searchResult.dataSource}" for taxonomy search`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      status: 'ok',
      dataSource: searchResult.dataSource,
      query: {
        keywords: searchResult.query?.keywords ?? null,
        jobTitle: searchResult.query?.jobTitle ?? null,
        company: searchResult.query?.company ?? {
          name: null,
          slug: null,
          linkedinUrl: null,
        },
        ...(stdFunction ? { stdFunction } : {}),
        ...(stdFunctionRoot ? { stdFunctionRoot } : {}),
        ...(stdGrade ? { stdGrade } : {}),
        ...(searchResult.query?.appliedFilters
          ? { appliedFilters: searchResult.query.appliedFilters }
          : {}),
        ...(searchResult.query?.location
          ? { location: searchResult.query.location }
          : {}),
      },
      total: searchResult.total,
      totalBeforeFilter: searchResult.totalBeforeFilter ?? searchResult.total,
      items: searchResult.items as PeopleSearchByTaxonomyResponse['items'],
    };
  }

  private async searchPeopleFromIndex(
    body: PeopleSearchDto,
    dataSource: PeopleDataSourceAlias,
    locationScope?: PeopleLocationScope,
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
      !!body.locations?.some((value) => value.trim().length > 0) ||
      !!locationScope?.raw ||
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
      country:
        locationScope?.linkedinLocationName ??
        locationScope?.raw ??
        body.country,
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
    locationScope?: PeopleLocationScope,
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

    const stdFunction = body.stdFunction?.trim() || undefined;
    const stdFunctionRoot = body.stdFunctionRoot?.trim() || undefined;
    const stdGrade = body.stdGrade?.trim() || undefined;

    const apolloFilters = resolveApolloFilters({
      functionRoot: stdFunctionRoot,
      stdFunction,
      stdGrade,
    });

    const titleParts = [stdFunction, stdGrade, body.jobTitle]
      .map((value) => value?.trim())
      .filter((value): value is string => !!value);

    const personLocations = (
      locationScope?.linkedinLocationName ??
      locationScope?.raw ??
      body.locations?.[0] ??
      body.country
    )?.trim();

    const raw = await this.apolloIoRestService.peopleSearch({
      q_keywords: body.query,
      person_titles:
        apolloFilters.person_department_or_subdepartments.length === 0 &&
        titleParts.length > 0
          ? titleParts
          : undefined,
      person_locations: personLocations ? [personLocations] : undefined,
      q_organization_domains_list: domain ? [domain] : undefined,
      person_seniorities:
        apolloFilters.person_seniorities.length > 0
          ? apolloFilters.person_seniorities
          : undefined,
      person_department_or_subdepartments:
        apolloFilters.person_department_or_subdepartments.length > 0
          ? apolloFilters.person_department_or_subdepartments
          : undefined,
      per_page: body.limit ?? 20,
      page:
        body.offset && body.limit
          ? Math.floor(body.offset / body.limit) + 1
          : 1,
    });

    const people = Array.isArray((raw as { people?: unknown }).people)
      ? ((raw as { people: Record<string, unknown>[] }).people ?? [])
      : [];

    const queryMeta = {
      keywords: body.query?.trim() || null,
      company: {
        name: companyName || null,
        slug: null,
        linkedinUrl: null,
      },
      ...(stdFunction ? { stdFunction } : {}),
      ...(stdFunctionRoot ? { stdFunctionRoot } : {}),
      ...(stdGrade ? { stdGrade } : {}),
      appliedFilters: {
        person_department_or_subdepartments:
          apolloFilters.person_department_or_subdepartments,
        person_seniorities: apolloFilters.person_seniorities,
      },
    };

    if (stdFunction || stdFunctionRoot) {
      const filtered = await this.filterCandidatesByTaxonomy(people, {
        stdFunction,
        stdFunctionRoot,
        stdGrade,
      });

      return {
        status: 'ok',
        dataSource,
        total: filtered.length,
        totalBeforeFilter: people.length,
        query: queryMeta,
        items: filtered,
      };
    }

    return {
      status: 'ok',
      dataSource,
      total: people.length,
      totalBeforeFilter: people.length,
      query: queryMeta,
      items: people,
    };
  }

  private async searchPeopleFromLinkedIn(
    body: PeopleSearchDto,
    dataSource: 'harvest' | 'unipile' | 'pool',
    apiToken?: string,
    locationScope?: PeopleLocationScope,
  ): Promise<PeopleSearchResponse> {
    if (
      !apiToken?.trim() &&
      dataSource !== 'harvest' &&
      dataSource !== 'pool' &&
      !body.accountId?.trim()
    ) {
      throw new HttpException(
        'Authorization token is required for LinkedIn people search',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const searchUrl = body.searchUrl?.trim();
    const hasTaxonomy =
      !!body.stdFunction?.trim() ||
      !!body.stdFunctionRoot?.trim() ||
      !!body.stdGrade?.trim();
    const hasCompany =
      !!body.website?.trim() ||
      !!body.companyId?.trim() ||
      !!body.companyName?.trim() ||
      !!body.linkedinCompanyUrl?.trim();

    if (!searchUrl && !hasCompany) {
      throw new HttpException(
        'companyName, companyId, linkedinCompanyUrl, or website is required for LinkedIn search',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (
      !searchUrl &&
      !hasTaxonomy &&
      !body.jobTitle?.trim() &&
      !body.query?.trim()
    ) {
      throw new HttpException(
        'At least one of stdFunction, stdFunctionRoot, stdGrade, jobTitle, or query is required for LinkedIn search',
        HttpStatus.BAD_REQUEST,
      );
    }

    const stdFunction = body.stdFunction?.trim() || undefined;
    const stdFunctionRoot = body.stdFunctionRoot?.trim() || undefined;
    const stdGrade = body.stdGrade?.trim() || undefined;

    const sourcingResult = await this.peopleLinkedInSourcingService.search({
      apiToken: apiToken ?? '',
      website: body.website,
      linkedinCompanyUrl: body.linkedinCompanyUrl,
      companyId: body.companyId,
      companyName: body.companyName,
      stdFunction,
      stdFunctionRoot,
      stdGrade,
      country:
        locationScope?.linkedinLocationName ??
        locationScope?.raw ??
        body.country,
      locationIds: locationScope?.linkedinLocationIds,
      dataSource,
      accountId: body.accountId,
      limit: body.limit ?? 20,
      linkedinSearchKeywords:
        body.jobTitle?.trim() || body.query?.trim() || undefined,
      searchUrl,
    });

    const queryMeta = {
      ...(searchUrl ? { searchUrl } : {}),
      keywords: sourcingResult.keywords,
      jobTitle: sourcingResult.jobTitle,
      company: sourcingResult.company,
      ...(stdFunction ? { stdFunction } : {}),
      ...(stdFunctionRoot ? { stdFunctionRoot } : {}),
      ...(stdGrade ? { stdGrade } : {}),
      appliedFilters: sourcingResult.appliedFilters,
    };

    const responseDataSource = sourcingResult.dataSource;

    if (stdFunction || stdFunctionRoot) {
      const filtered = await this.filterCandidatesByTaxonomy(
        sourcingResult.items,
        {
          stdFunction,
          stdFunctionRoot,
          stdGrade,
        },
      );

      return {
        status: 'ok',
        dataSource: responseDataSource,
        total: filtered.length,
        totalBeforeFilter: sourcingResult.items.length,
        query: queryMeta,
        items: filtered,
      };
    }

    return {
      status: 'ok',
      dataSource: responseDataSource,
      total: sourcingResult.items.length,
      totalBeforeFilter: sourcingResult.items.length,
      query: queryMeta,
      items: sourcingResult.items,
    };
  }

  async assertTaxonomyFilters(args: {
    stdFunction?: string;
    stdFunctionRoot?: string;
    stdGrade?: string;
  }): Promise<void> {
    const stdGrade = args.stdGrade?.trim();
    if (stdGrade && !matchStdGrade(stdGrade)) {
      throw new HttpException(
        `Unknown stdGrade "${stdGrade}". Valid values: ${PEOPLE_TAXONOMY_GRADE_VALUES.join(', ')}.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const stdFunctionRoot = args.stdFunctionRoot?.trim();
    if (stdFunctionRoot && !matchStdFunctionRoot(stdFunctionRoot)) {
      throw new HttpException(
        `Unknown stdFunctionRoot "${stdFunctionRoot}". Valid values: ${PEOPLE_TAXONOMY_FUNCTION_ROOT_VALUES.join(', ')}.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const stdFunction = args.stdFunction?.trim();
    if (!stdFunction) {
      return;
    }

    const matchedFunctionRoot = stdFunctionRoot
      ? matchStdFunctionRoot(stdFunctionRoot)
      : undefined;
    const catalogResult = await this.titleTaxonomyRemoteService.getFunctions(
      matchedFunctionRoot ?? stdFunctionRoot,
    );
    const catalog = Array.isArray(catalogResult) ? catalogResult : [];
    if (catalog.length === 0) {
      throw new HttpException(
        'Title taxonomy service is unavailable to validate stdFunction',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const items = listStdFunctionItemsForRoot(
      catalog,
      matchedFunctionRoot ?? stdFunctionRoot,
    );

    if (!findStdFunctionCatalogMatch(stdFunction, items)) {
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: matchedFunctionRoot
            ? `Unknown stdFunction "${stdFunction}" for stdFunctionRoot "${matchedFunctionRoot}".`
            : `Unknown stdFunction "${stdFunction}". Pass stdFunctionRoot to list valid functions for that department.`,
          stdFunctionRoot: matchedFunctionRoot ?? null,
          items,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private assertTaxonomySearchInput(args: {
    stdFunction?: string;
    stdFunctionRoot?: string;
    stdGrade?: string;
    website?: string;
    linkedinCompanyUrl?: string;
    companyId?: string;
    companyName?: string;
  }): void {
    const hasCompany =
      !!args.website?.trim() ||
      !!args.linkedinCompanyUrl?.trim() ||
      !!args.companyId?.trim() ||
      !!args.companyName?.trim();
    if (!hasCompany) {
      throw new HttpException(
        'At least one of website, linkedinCompanyUrl, companyId, or companyName is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const hasFunction = !!args.stdFunction?.trim();
    const hasRoot = !!args.stdFunctionRoot?.trim();
    if (hasFunction === hasRoot) {
      throw new HttpException(
        'Provide exactly one of stdFunction or stdFunctionRoot',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (args.stdGrade?.trim() && !hasFunction && !hasRoot) {
      throw new HttpException(
        'stdGrade requires stdFunction or stdFunctionRoot',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async filterCandidatesByTaxonomy(
    items: Array<Record<string, unknown>>,
    criteria: {
      stdFunction?: string;
      stdFunctionRoot?: string;
      stdGrade?: string;
    },
  ): Promise<
    Array<
      Record<string, unknown> & {
        resolved: {
          stdFunction: string | null;
          stdFunctionRoot: string | null;
          stdGrade: string | null;
          confidence: number;
        };
      }
    >
  > {
    const profiles = items.map((item) => ({
      jobTitle: extractCandidateJobTitle(item) ?? '',
      experience: extractCandidateExperience(item),
    }));
    const classifications =
      await this.titleTaxonomyRemoteService.classifyProfiles(profiles);

    if (!classifications) {
      throw new HttpException(
        'Title taxonomy service is unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const kept: Array<
      Record<string, unknown> & {
        resolved: {
          stdFunction: string | null;
          stdFunctionRoot: string | null;
          stdGrade: string | null;
          confidence: number;
        };
      }
    > = [];
    const dropped: Array<{
      jobTitle: string;
      stdFunction: string | null;
      stdFunctionRoot: string | null;
      stdGrade: string | null;
    }> = [];

    for (const [index, item] of items.entries()) {
      const resolved = classificationToResolvedFields(classifications[index]);
      if (!matchesTaxonomyFilter(resolved, criteria)) {
        dropped.push({
          jobTitle: extractCandidateJobTitle(item) ?? '',
          stdFunction: resolved.stdFunction,
          stdFunctionRoot: resolved.stdFunctionRoot,
          stdGrade: resolved.stdGrade,
        });
        continue;
      }
      kept.push({
        ...item,
        resolved,
      });
    }

    this.logger.log(
      `People API taxonomy filter received=${items.length} kept=${kept.length} dropped=${dropped.length} criteria=stdFunction=${criteria.stdFunction ?? ''} stdFunctionRoot=${criteria.stdFunctionRoot ?? ''} stdGrade=${criteria.stdGrade ?? ''} dropped=${JSON.stringify(dropped)}`,
    );

    return kept;
  }

  async expandJobTitles(
    dto: ExpandJobTitlesDto,
  ): Promise<ExpandJobTitlesResponse> {
    const jobTitle = dto.jobTitle?.trim();
    if (!jobTitle) {
      throw new HttpException('jobTitle is required', HttpStatus.BAD_REQUEST);
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

    // Build a structured query from the classified taxonomy fields for keyword generation.
    const queryParts = [stdFunction, stdGrade, stdFunctionRoot, jobTitle]
      .filter((value): value is string => !!value)
      .slice(0, 2);

    const keywordsResult =
      queryParts.length > 0
        ? await this.titleTaxonomyRemoteService.searchKeywordsFromQuery({
            query: queryParts.join(' '),
            companyName: dto.companyName,
            resolvedIntent: {
              std_function: stdFunction,
              std_function_root: stdFunctionRoot,
              std_grade: stdGrade,
            },
          })
        : null;

    return {
      status: 'ok',
      jobTitle,
      normalizedTitle: classification.normalized_title?.trim() || null,
      stdFunction,
      stdFunctionRoot,
      stdGrade,
      confidence: classification.confidence ?? 0,
      booleanQuery: keywordsResult?.boolean_query ?? null,
      keywordGroups: keywordsResult?.keyword_groups ?? [],
    };
  }

  async getTaxonomyBooleanStrings(
    dto: TaxonomyBooleanStringsDto,
  ): Promise<TaxonomyBooleanStringsResponse> {
    const hasInput =
      !!dto.stdFunction?.trim() ||
      !!dto.stdGrade?.trim() ||
      !!dto.stdFunctionRoot?.trim();

    if (!hasInput) {
      throw new HttpException(
        'At least one of stdFunction, stdGrade, or stdFunctionRoot is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Compose a natural-language query from the taxonomy values for the keyword service.
    const queryParts = [dto.stdFunction, dto.stdGrade, dto.stdFunctionRoot]
      .map((value) => value?.trim())
      .filter((value): value is string => !!value);
    const query = queryParts.join(' ');

    const result =
      await this.titleTaxonomyRemoteService.searchKeywordsFromQuery({
        query,
        companyName: dto.companyName,
        resolvedIntent: {
          std_function: dto.stdFunction?.trim() ?? null,
          std_function_root: dto.stdFunctionRoot?.trim() ?? null,
          std_grade: dto.stdGrade?.trim() ?? null,
        },
      });

    if (!result) {
      throw new HttpException(
        'Title taxonomy service is unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return {
      status: 'ok',
      query,
      booleanQuery: result.boolean_query ?? null,
      keywordGroups: result.keyword_groups ?? [],
    };
  }

  async getManualBooleanQueries(
    dto: TaxonomyManualBooleanQueriesDto,
  ): Promise<TaxonomyManualBooleanQueriesResponse> {
    const result =
      await this.titleTaxonomyRemoteService.getManualBooleanQueries({
        kind: dto.kind?.trim(),
        label: dto.label?.trim(),
        stdGrade: dto.stdGrade?.trim(),
        stdFunction: dto.stdFunction?.trim(),
        stdFunctionRoot: dto.stdFunctionRoot?.trim(),
        includeEmpty: dto.includeEmpty,
      });

    if (!result) {
      throw new HttpException(
        'Title taxonomy service is unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const items = (result.items ?? []).map((item) => ({
      kind: item.kind,
      label: item.label,
      stdGrade: item.std_grade,
      booleanQuery: item.boolean_query,
      keywords: item.keywords ?? '',
    }));

    return {
      status: 'ok',
      found: result.found ?? items.length > 0,
      count: result.count ?? items.length,
      items,
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

    const result = await this.contactOutPeopleSearchService.searchCompanyPeople(
      {
        companyName,
        domain,
        maxScanProfiles: body.limit ?? 20,
      },
    );

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
