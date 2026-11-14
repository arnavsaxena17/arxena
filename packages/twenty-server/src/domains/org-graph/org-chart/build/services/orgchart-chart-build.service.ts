import { Injectable, Logger } from '@nestjs/common';
import { CandidateAvatarStorageService } from 'src/engine/core-modules/candidate-avatar/services/candidate-avatar-storage.service';
import { LinkedInRecruiterPeopleTransformerService } from 'src/domains/ingestion/candidate-sourcing/services/data-sources/linkedin-recruiter-people-transformer.service';
import {
  LinkedInSearchTransformerService,
  type CandidateTableRow,
} from 'src/domains/ingestion/candidate-sourcing/services/data-sources/linkedin-search-transformer.service';
import type { LinkedInSearchResult } from 'src/domains/discovery/transport/linkedin-search/types/linkedin-search-response.type';
import { OrgChartProfileDataSourceMapperService } from 'src/domains/org-graph/org-chart/services/org-chart-profile-data-source-mapper.service';
import { PythonOrgChartService } from 'src/domains/org-graph/org-chart/services/python-org-chart.service';
import type { OrgChartLinkedinCandidateSource } from 'src/domains/org-graph/org-chart/types/orgchart-linkedin-candidate-source.type';
import { applyOrgChartCompanyMetadata } from 'src/domains/org-graph/org-chart/utils/apply-org-chart-company-metadata.util';
import { mergeOrgChartCompanyTenureOntoOrgChartData } from 'src/domains/org-graph/org-chart/utils/merge-orgchart-company-tenure.util';
import {
  extractUnipileProfileFieldsFromSearchRow,
  mergeOrgChartUnipileProfileFieldsOntoOrgChartData,
  type OrgChartUnipileProfileFields,
} from 'src/domains/org-graph/org-chart/utils/merge-orgchart-unipile-profile-fields.util';
import {
  applyApolloOnlyNodeLockState,
  assignApolloPublicSlugToAllPersonSlots,
  backfillUnmappedLinkedInSlotsWithApolloSlug,
  mergeContactAvailabilityOntoOrgChartData,
  mergeContactAvailabilityOntoOrgChartDataByPersonId,
  mergeProfileSourceSlugsOntoOrgChartData,
  normalizeOrgChartLinkedinUrlKey,
  ORGCHART_DATA_SOURCE_SLUG_APOLLO,
  readProviderContactHintsFromSearchRow,
  type OrgChartNodeContactAvailability,
} from 'src/domains/org-graph/org-chart/utils/merge-orgchart-profile-source-slugs.util';
import { OrgChartData } from 'twenty-shared';
import {
  applyAsOfSnapshotToCandidates,
  applyEntireCompanyExperienceTitlesToCandidates,
  companyTenureFromDerivedExperience,
} from 'src/domains/org-graph/org-chart/utils/orgchart-asof-snapshot.util';
import { extractLinkedinProfileUrlFromOrgChartCandidateRow } from 'src/domains/org-graph/org-chart/utils/orgchart-candidate-linkedin-url.util';

type OrgChartCandidateInput = CandidateTableRow | Record<string, unknown>;

type StandardizedOrgChartPerson = {
  full_name: string;
  job_title: string;
  job_company_linkedin_url: string;
  job_company_id: string;
  job_company_name: string;
  industry: string;
  country: string;
  job_company_website: string;
  linkedin_url: string;
  facebook_url: string;
  twitter_url: string;
  gender: string;
  location_country: string;
  location_region: string;
  location_locality: string;
  location_metro: string;
  location_name: string;
  inferred_salary: string;
  inferred_years_experience: string;
  emails: string;
  phone_numbers: string;
  profile_picture_url: string;
  id: string;
  network_distance?: string;
  shared_connections_count?: number;
  premium?: boolean;
  verified?: boolean;
  open_profile?: boolean;
  followers_count?: number;
  connections_count?: number;
};

// Turns people already found at a company into an org chart: maps them to
// the Python builder's input and hands them over. It searches nothing.
@Injectable()
export class OrgChartChartBuildService {
  private readonly logger = new Logger(OrgChartChartBuildService.name);

  constructor(
    private readonly pythonOrgChartService: PythonOrgChartService,
    private readonly orgChartProfileDataSourceMapperService: OrgChartProfileDataSourceMapperService,
    private readonly candidateAvatarStorageService: CandidateAvatarStorageService,
    private readonly linkedinSearchResultTransformer: LinkedInSearchTransformerService,
    private readonly linkedinRecruiterPeopleTransformer: LinkedInRecruiterPeopleTransformerService,
  ) {}

  async buildOrgChartFromLinkedInCompanyCandidates(
    candidates: OrgChartCandidateInput[],
    options: {
      companyName: string;
      companyId?: string;
      mode?: string;
      function?: string;
      /** When set, used as job_company_linkedin_url for the Python service (overrides /company/{companyId}) */
      companyLinkedinUrl?: string;
      /** Company website from the build request; persisted on orgchart.json top-level metadata. */
      website?: string;
      /** Raw industry label forwarded to Python list_data.industry */
      industry?: string;
      /** Macro category override forwarded to Python list_data.industry_category */
      industryCategory?: string;
      /**
       * When a candidate row has no `source`, map profile provenance using this
       * chart-level channel (server-only; clients receive opaque `ds_*` slugs on nodes).
       */
      profileSourceFallback?: OrgChartLinkedinCandidateSource;
      /** Optional MonthYear snapshot filter in YYYY-MM. */
      asOfMonth?: string;
    },
  ): Promise<OrgChartData> {
    const { companyName, companyId, mode, function: fn } = options;
    const normalizedCompanyName = (companyName ?? '').trim();
    const normalizedCompanyId =
      (companyId ?? '').trim() ||
      (normalizedCompanyName
        ? normalizedCompanyName.replace(/\s+/g, '').toLowerCase()
        : '');

    const trimmedCanonical = options.companyLinkedinUrl?.trim();
    const companyLinkedinUrl =
      trimmedCanonical && trimmedCanonical.length > 0
        ? trimmedCanonical.replace(/\/+$/, '')
        : normalizedCompanyId !== ''
          ? `https://www.linkedin.com/company/${normalizedCompanyId}`
          : '';
    const normalizedWebsite = options.website?.trim() ?? '';

    const applyBuildRequestCompanyMetadata = <T extends OrgChartData>(
      orgChart: T,
    ): T =>
      applyOrgChartCompanyMetadata(orgChart, {
        website: normalizedWebsite || undefined,
        linkedinCompanyUrl: companyLinkedinUrl || undefined,
      }) as T;

    const urlToSlug = new Map<string, string>();
    const urlToContact = new Map<string, OrgChartNodeContactAvailability>();
    /** When `linkedin_url` is empty, merge hints onto nodes by `candidates[i].id`. */
    const personIdToContact = new Map<
      string,
      OrgChartNodeContactAvailability
    >();
    const { profileSourceFallback } = options;

    const asOfMonthTrimmed = options.asOfMonth?.trim() ?? '';
    const modeNorm = (mode ?? '').trim().toLowerCase();
    const isEntireCompany = modeNorm === 'entire_company';

    let candidatesForSnapshot = candidates as Array<Record<string, unknown>>;
    if (asOfMonthTrimmed) {
      candidatesForSnapshot = applyAsOfSnapshotToCandidates({
        candidates: candidatesForSnapshot,
        companyName: normalizedCompanyName,
        companyLinkedinUrl: companyLinkedinUrl || undefined,
        asOfMonth: asOfMonthTrimmed,
      });
    } else if (isEntireCompany) {
      candidatesForSnapshot = applyEntireCompanyExperienceTitlesToCandidates({
        candidates: candidatesForSnapshot,
        companyName: normalizedCompanyName,
        companyLinkedinUrl: companyLinkedinUrl || undefined,
      });
    }

    const tenureByUrl = new Map<string, 'current' | 'past'>();
    const tenureById = new Map<string, 'current' | 'past'>();
    const unipileByUrl = new Map<string, OrgChartUnipileProfileFields>();
    const unipileById = new Map<string, OrgChartUnipileProfileFields>();
    for (const candidate of candidatesForSnapshot) {
      const raw = candidate as Record<string, unknown>;
      const tenure = companyTenureFromDerivedExperience({
        row: raw,
        companyName: normalizedCompanyName,
        companyLinkedinUrl: companyLinkedinUrl || undefined,
      });
      const li = extractLinkedinProfileUrlFromOrgChartCandidateRow(raw).trim();
      const rawPeopleId =
        typeof raw.peopleId === 'string' ? raw.peopleId.trim() : '';
      const rawTempId = typeof raw.tempId === 'string' ? raw.tempId.trim() : '';
      const rawRowId = typeof raw.id === 'string' ? raw.id.trim() : '';
      const idForLookup =
        rawPeopleId.length > 0
          ? rawPeopleId
          : rawTempId.length > 0
            ? rawTempId
            : rawRowId.length > 0
              ? rawRowId
              : '';

      if (tenure !== 'unknown') {
        if (li.length > 0) {
          tenureByUrl.set(normalizeOrgChartLinkedinUrlKey(li), tenure);
        }
        if (idForLookup.length > 0) {
          tenureById.set(idForLookup, tenure);
        }
      }

      const unipileFields = extractUnipileProfileFieldsFromSearchRow(raw);
      if (Object.keys(unipileFields).length > 0) {
        if (li.length > 0) {
          unipileByUrl.set(normalizeOrgChartLinkedinUrlKey(li), unipileFields);
        }
        if (idForLookup.length > 0) {
          unipileById.set(idForLookup, unipileFields);
        }
      }
    }

    const people: StandardizedOrgChartPerson[] = candidatesForSnapshot.map(
      (candidate, index) => {
        const raw = candidate as Record<string, unknown>;

        const fullName =
          (typeof (raw as { fullName?: unknown }).fullName === 'string' &&
            (raw as { fullName: string }).fullName) ||
          (typeof (raw as { name?: unknown }).name === 'string' &&
            (raw as { name: string }).name) ||
          '';

        const rawJob =
          typeof (raw as { jobTitle?: unknown }).jobTitle === 'string'
            ? (raw as { jobTitle: string }).jobTitle?.trim()
            : '';
        const rawHeadline =
          typeof (raw as { headline?: unknown }).headline === 'string'
            ? (raw as { headline: string }).headline?.trim()
            : '';
        const rawJobTitleSnake =
          typeof (raw as { job_title?: unknown }).job_title === 'string'
            ? (raw as { job_title: string }).job_title?.trim()
            : '';
        const rawLinkedInHeadline =
          typeof (raw as { linkedin_headline?: unknown }).linkedin_headline ===
          'string'
            ? (raw as { linkedin_headline: string }).linkedin_headline?.trim()
            : '';
        const jobTitleStr =
          (rawJob && rawJob !== 'N/A' ? rawJob : '') ||
          rawHeadline ||
          rawJobTitleSnake ||
          rawLinkedInHeadline ||
          '';
        const jobTitle = typeof jobTitleStr === 'string' ? jobTitleStr : '';

        const jobCompanyName =
          (typeof (raw as { jobCompanyName?: unknown }).jobCompanyName ===
            'string' &&
            (raw as { jobCompanyName: string }).jobCompanyName) ||
          (typeof (raw as { company?: unknown }).company === 'string' &&
            (raw as { company: string }).company) ||
          normalizedCompanyName;

        const locationName =
          (typeof (raw as { locationName?: unknown }).locationName ===
            'string' &&
            (raw as { locationName: string }).locationName) ||
          (typeof (raw as { location?: unknown }).location === 'string' &&
            (raw as { location: string }).location) ||
          '';

        const industry =
          (typeof (raw as { industry?: unknown }).industry === 'string' &&
            (raw as { industry: string }).industry) ||
          '';

        const linkedinUrl =
          extractLinkedinProfileUrlFromOrgChartCandidateRow(raw);

        const locationCountry =
          (typeof (raw as { locationCountry?: unknown }).locationCountry ===
            'string' &&
            (raw as { locationCountry: string }).locationCountry) ||
          '';

        const locationRegion =
          (typeof (raw as { locationRegion?: unknown }).locationRegion ===
            'string' &&
            (raw as { locationRegion: string }).locationRegion) ||
          '';

        const locationLocality =
          (typeof (raw as { locationLocality?: unknown }).locationLocality ===
            'string' &&
            (raw as { locationLocality: string }).locationLocality) ||
          '';

        const rawPeopleId =
          typeof (raw as { peopleId?: unknown }).peopleId === 'string'
            ? (raw as { peopleId: string }).peopleId.trim()
            : '';
        const rawTempId =
          typeof (raw as { tempId?: unknown }).tempId === 'string'
            ? (raw as { tempId: string }).tempId.trim()
            : '';
        const rawRowId =
          typeof (raw as { id?: unknown }).id === 'string'
            ? (raw as { id: string }).id.trim()
            : '';
        const idValue =
          (rawPeopleId.length > 0 ? rawPeopleId : '') ||
          (rawTempId.length > 0 ? rawTempId : '') ||
          (rawRowId.length > 0 ? rawRowId : '') ||
          (linkedinUrl !== '' ? linkedinUrl : '') ||
          `${fullName || 'candidate'}-${jobCompanyName || 'company'}-${index}`;

        const profilePictureUrl =
          (typeof (raw as { profile_picture_url?: unknown })
            .profile_picture_url === 'string' &&
            (raw as { profile_picture_url: string }).profile_picture_url) ||
          (typeof (raw as { profile_picture_url_large?: unknown })
            .profile_picture_url_large === 'string' &&
            (raw as { profile_picture_url_large: string })
              .profile_picture_url_large) ||
          (typeof (raw as { profilePictureUrl?: unknown }).profilePictureUrl ===
            'string' &&
            (raw as { profilePictureUrl: string }).profilePictureUrl) ||
          (typeof (raw as { displayPicture?: unknown }).displayPicture ===
            'string' &&
            (raw as { displayPicture: string }).displayPicture) ||
          '';

        const publicSlug =
          this.orgChartProfileDataSourceMapperService.toPublicSlugFromRow(
            raw,
            profileSourceFallback,
          );
        if (publicSlug && linkedinUrl.trim().length > 0) {
          urlToSlug.set(
            normalizeOrgChartLinkedinUrlKey(linkedinUrl),
            publicSlug,
          );
        }

        const contactSlot = readProviderContactHintsFromSearchRow(
          raw,
          ORGCHART_DATA_SOURCE_SLUG_APOLLO,
        );
        if (
          linkedinUrl.trim().length > 0 &&
          (contactSlot.hasEmail !== undefined ||
            contactSlot.hasDirectPhone !== undefined ||
            contactSlot.hasOrgPhone !== undefined)
        ) {
          urlToContact.set(
            normalizeOrgChartLinkedinUrlKey(linkedinUrl),
            contactSlot,
          );
        }
        if (
          idValue.trim().length > 0 &&
          (contactSlot.hasEmail !== undefined ||
            contactSlot.hasDirectPhone !== undefined ||
            contactSlot.hasOrgPhone !== undefined)
        ) {
          personIdToContact.set(idValue.trim(), contactSlot);
        }

        return {
          full_name: fullName,
          job_title: jobTitle,
          job_company_linkedin_url: companyLinkedinUrl,
          job_company_id: normalizedCompanyId || jobCompanyName || '',
          job_company_name: jobCompanyName,
          industry,
          country: locationCountry || 'global',
          job_company_website: normalizedWebsite,
          linkedin_url: linkedinUrl,
          facebook_url: '',
          twitter_url: '',
          gender: '',
          location_country: locationCountry,
          location_region: locationRegion,
          location_locality: locationLocality,
          location_metro: '',
          location_name: locationName,
          inferred_salary: '',
          inferred_years_experience: '',
          emails: '',
          phone_numbers: '',
          profile_picture_url: profilePictureUrl,
          id: idValue,
          ...extractUnipileProfileFieldsFromSearchRow(raw),
        };
      },
    );

    const peopleWithAvatars =
      await this.candidateAvatarStorageService.ingestBatch(people);

    this.logger.log(
      `OrgchartLinkedInSearch: building org chart from ${peopleWithAvatars.length} candidates for company="${normalizedCompanyName}"`,
    );

    const jobNameSuffix = fn
      ? fn.replace(/\s+/g, '-').toLowerCase()
      : mode === 'leadership'
        ? 'leadership'
        : mode === 'entire_company'
          ? 'entire'
          : (mode ?? 'chart');
    const jobName = `orgchart-${normalizedCompanyName.replace(/\s+/g, '-')}-${jobNameSuffix}`;

    const yugaNormalizedId = normalizedCompanyId
      .replace(/-/g, '_')
      .toLowerCase();
    const isYugaLabsCompany =
      yugaNormalizedId === 'yuga_labs' ||
      normalizedCompanyName.toLowerCase().trim() === 'yuga labs';

    try {
      const built =
        await this.pythonOrgChartService.createOrgChartFromStandardizedPeople({
          people: peopleWithAvatars,
          jobName,
          projectId: normalizedCompanyId || undefined,
          functionRoot: fn,
          industry: options.industry,
          industryCategory: options.industryCategory,
        });
      const apolloPublicSlug =
        this.orgChartProfileDataSourceMapperService.toPublicSlugFromRow({
          source: 'apollo',
        });
      const isApolloChart =
        options.profileSourceFallback === 'm7kq' ||
        options.profileSourceFallback === 'apollo';
      const withDataSourceSlugs =
        isApolloChart && apolloPublicSlug !== undefined
          ? assignApolloPublicSlugToAllPersonSlots(built, apolloPublicSlug)
          : apolloPublicSlug !== undefined
            ? backfillUnmappedLinkedInSlotsWithApolloSlug(
                mergeProfileSourceSlugsOntoOrgChartData(built, urlToSlug),
                apolloPublicSlug,
              )
            : mergeProfileSourceSlugsOntoOrgChartData(built, urlToSlug);
      const withUrlContact = mergeContactAvailabilityOntoOrgChartData(
        withDataSourceSlugs,
        urlToContact,
      );
      const merged = mergeContactAvailabilityOntoOrgChartDataByPersonId(
        withUrlContact,
        personIdToContact,
      );
      const withTenure = mergeOrgChartCompanyTenureOntoOrgChartData(
        merged,
        tenureByUrl,
        tenureById,
      );
      const withUnipile = mergeOrgChartUnipileProfileFieldsOntoOrgChartData(
        withTenure,
        unipileByUrl,
        unipileById,
      );
      const withMetadata = applyBuildRequestCompanyMetadata(
        apolloPublicSlug
          ? applyApolloOnlyNodeLockState(withUnipile, apolloPublicSlug)
          : withUnipile,
      );

      return withMetadata;
    } catch (error) {
      if (!isYugaLabsCompany) {
        throw error;
      }
      const staticChart =
        await this.pythonOrgChartService.loadYugaLabsStaticAssistOrNull();
      if (!staticChart) {
        throw error;
      }
      this.logger.warn(
        `Yuga Labs org chart build failed; using static yuga_labs_all_org_chart_assist.json. ${error instanceof Error ? error.message : String(error)}`,
      );
      const apolloPublicSlug =
        this.orgChartProfileDataSourceMapperService.toPublicSlugFromRow({
          source: 'apollo',
        });
      const isApolloChart =
        options.profileSourceFallback === 'm7kq' ||
        options.profileSourceFallback === 'apollo';
      const withDataSourceSlugs =
        isApolloChart && apolloPublicSlug !== undefined
          ? assignApolloPublicSlugToAllPersonSlots(
              staticChart,
              apolloPublicSlug,
            )
          : apolloPublicSlug !== undefined
            ? backfillUnmappedLinkedInSlotsWithApolloSlug(
                mergeProfileSourceSlugsOntoOrgChartData(staticChart, urlToSlug),
                apolloPublicSlug,
              )
            : mergeProfileSourceSlugsOntoOrgChartData(staticChart, urlToSlug);
      const withUrlContact = mergeContactAvailabilityOntoOrgChartData(
        withDataSourceSlugs,
        urlToContact,
      );
      const merged = mergeContactAvailabilityOntoOrgChartDataByPersonId(
        withUrlContact,
        personIdToContact,
      );
      const withTenure = mergeOrgChartCompanyTenureOntoOrgChartData(
        merged,
        tenureByUrl,
        tenureById,
      );
      const withUnipile = mergeOrgChartUnipileProfileFieldsOntoOrgChartData(
        withTenure,
        unipileByUrl,
        unipileById,
      );
      return applyBuildRequestCompanyMetadata(
        apolloPublicSlug
          ? applyApolloOnlyNodeLockState(withUnipile, apolloPublicSlug)
          : withUnipile,
      );
    }
  }

  transformUnipileRawItemsToOrgChartCandidates(
    items: LinkedInSearchResult[],
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
  ): CandidateTableRow[] {
    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }

    const transformer =
      searchType === 'recruiter'
        ? this.linkedinRecruiterPeopleTransformer
        : this.linkedinSearchResultTransformer;

    const transformed = transformer.transformSearchResultsToTableFormat(
      items,
      'linkedin_search_job',
      `${searchType} people search results`,
    );

    return transformer.addMetadataToCandidates(transformed, {
      searchType,
      searchCategory: 'people',
      timestamp: new Date().toISOString(),
      processingTime: 0,
    });
  }
}
