import { Injectable } from '@nestjs/common';
import type {
    LinkedInCurrentPosition,
    LinkedInPeopleSearchResult,
} from 'src/engine/core-modules/linkedin-search/types/linkedin-search-response.type';
import {
    LinkedInSearchTransformerService,
    TransformedCandidateForTable,
} from './linkedin-search-transformer.service';

type ApifyDatePart = {
  month?: string;
  year?: number;
  text?: string;
};

type ApifyExperienceEntry = {
  position?: string;
  companyName?: string;
  companyLinkedinUrl?: string;
  startDate?: ApifyDatePart;
  endDate?: ApifyDatePart;
};

type ApifyLocation = {
  linkedinText?: string;
  parsed?: {
    text?: string;
    country?: string;
    countryCode?: string;
    state?: string;
    city?: string;
  };
};

/** Apify LinkedIn company profile scraper actor item (Harvest-style full profile). */
export type ApifyCompanyProfileActorItem = {
  id?: string;
  publicIdentifier?: string;
  linkedinUrl?: string;
  firstName?: string;
  lastName?: string;
  headline?: string;
  about?: string;
  photo?: string;
  location?: ApifyLocation;
  currentPosition?: Array<{ companyName?: string }>;
  experience?: ApifyExperienceEntry[];
};

const APIFY_TABLE_JOB_ID = 'linkedin_search_job';
const APIFY_TABLE_JOB_NAME = 'Apify company profile scraper';

function pickCurrentJobTitle(
  item: ApifyCompanyProfileActorItem,
  preferredCompanyName?: string,
): string {
  const headline = item.headline?.trim() ?? '';
  if (headline) {
    return headline;
  }
  const current = item.currentPosition?.[0];
  if (current?.companyName && preferredCompanyName) {
    const match = item.experience?.find(
      (e) =>
        e.companyName &&
        preferredCompanyName &&
        e.companyName.toLowerCase() === preferredCompanyName.toLowerCase(),
    );
    if (match?.position) {
      return match.position.trim();
    }
  }
  const firstExp = item.experience?.[0];
  return firstExp?.position?.trim() ?? '';
}

function pickJobCompanyName(
  item: ApifyCompanyProfileActorItem,
  fallbackCompanyName: string,
): string {
  const fromCurrent = item.currentPosition?.[0]?.companyName?.trim();
  if (fromCurrent) {
    return fromCurrent;
  }
  const first = item.experience?.[0]?.companyName?.trim();
  return first || fallbackCompanyName;
}

function buildCurrentPositions(
  item: ApifyCompanyProfileActorItem,
  defaultCompanyName: string,
): LinkedInCurrentPosition[] {
  const company = pickJobCompanyName(item, defaultCompanyName);
  const role = pickCurrentJobTitle(item, company);
  return [
    {
      company,
      company_id: null,
      description: null,
      role,
      location: null,
      industry: [],
      tenure_at_role: { years: 0, months: 0 },
      tenure_at_company: { years: 0, months: 0 },
      start: { year: new Date().getFullYear(), month: 1 },
      skills: null,
    },
  ];
}

function apifyRowToLinkedInPeopleSearchResult(
  raw: Record<string, unknown>,
  options: { defaultCompanyName: string },
  index: number,
): LinkedInPeopleSearchResult {
  const item = raw as ApifyCompanyProfileActorItem;
  const defaultCompanyName = options.defaultCompanyName.trim();
  const firstName = (item.firstName ?? '').trim();
  const lastName = (item.lastName ?? '').trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  const loc = item.location;
  const parsed = loc?.parsed;
  const locationName =
    loc?.linkedinText?.trim() || parsed?.text?.trim() || null;
  const linkedinUrl =
    (typeof item.linkedinUrl === 'string' && item.linkedinUrl.trim()) ||
    (item.publicIdentifier
      ? `https://www.linkedin.com/in/${item.publicIdentifier}`
      : '');
  const publicId = item.publicIdentifier?.trim() || null;
  const stableId =
    (typeof item.id === 'string' && item.id) ||
    publicId ||
    linkedinUrl ||
    `apify_${index}`;

  return {
    object: 'SearchResult',
    type: 'PEOPLE',
    id: stableId,
    public_identifier: publicId,
    public_profile_url: linkedinUrl || null,
    profile_url: linkedinUrl || null,
    profile_picture_url: item.photo ?? null,
    profile_picture_url_large: item.photo ?? null,
    member_urn: null,
    name: fullName || null,
    first_name: firstName,
    last_name: lastName,
    network_distance: 'OUT_OF_NETWORK',
    location: locationName,
    industry: null,
    keywords_match: '',
    headline: item.headline ?? '',
    connections_count: 0,
    followers_count: 0,
    pending_invitation: false,
    can_send_inmail: false,
    hiddenCandidate: false,
    interestLikelihood: '',
    privacySettings: {
      allowConnectionsBrowse: true,
      showPremiumSubscriberIcon: false,
    },
    skills: [],
    premium: false,
    verified: false,
    open_profile: false,
    shared_connections_count: 0,
    recent_posts_count: 0,
    recently_hired: false,
    mentioned_in_the_news: false,
    current_positions: buildCurrentPositions(item, defaultCompanyName),
    education: [],
    work_experience: [],
    certifications: [],
    projects: [],
  };
}

@Injectable()
export class ApifyLinkedInCompanyProfileTransformerService {
  constructor(
    private readonly linkedInSearchTransformer: LinkedInSearchTransformerService,
  ) {}

  /**
   * Maps Apify company-profile actor rows to the same table shape as Unipile LinkedIn people search
   * (LinkedInSearchTransformerService), for org chart and caching.
   */
  transformApifyRowsToTableFormat(
    items: Record<string, unknown>[],
    options: { defaultCompanyName: string; companyLinkedinUrl?: string },
  ): TransformedCandidateForTable[] {
    if (!items.length) {
      return [];
    }

    const asPeopleResults: LinkedInPeopleSearchResult[] = items.map(
      (row, index) =>
        apifyRowToLinkedInPeopleSearchResult(row, options, index),
    );

    const tableRows =
      this.linkedInSearchTransformer.transformSearchResultsToTableFormat(
        asPeopleResults,
        APIFY_TABLE_JOB_ID,
        APIFY_TABLE_JOB_NAME,
      );

    const withMetadata =
      this.linkedInSearchTransformer.addMetadataToCandidates(tableRows, {
        searchType: 'classic',
        searchCategory: 'people',
        timestamp: new Date().toISOString(),
        processingTime: 0,
      });

    return withMetadata.map((row, index) => {
      const raw = items[index] as ApifyCompanyProfileActorItem;
      const parsed = raw.location?.parsed;
      const country =
        (typeof parsed?.countryCode === 'string' &&
          parsed.countryCode.trim()) ||
        (typeof parsed?.country === 'string' && parsed.country.trim()) ||
        row.locationCountry;
      const region =
        (typeof parsed?.state === 'string' && parsed.state.trim()) ||
        row.locationRegion;
      const locality =
        (typeof parsed?.city === 'string' && parsed.city.trim()) ||
        row.locationLocality;
      const locName =
        (typeof raw.location?.linkedinText === 'string' &&
          raw.location.linkedinText.trim()) ||
        (typeof parsed?.text === 'string' && parsed.text.trim()) ||
        row.locationName ||
        row.location;

      return {
        ...row,
        location: locName ?? row.location,
        locationName: locName ?? row.locationName,
        locationCountry: country ?? row.locationCountry,
        locationRegion: region ?? row.locationRegion,
        locationLocality: locality ?? row.locationLocality,
        // Preserve raw experience for timeline snapshotting utilities.
        org_apify_experience: raw.experience ?? null,
        org_apify: raw,
        ...(options.companyLinkedinUrl
          ? { jobCompanyLinkedinUrl: options.companyLinkedinUrl.trim() }
          : {}),
      };
    });
  }
}
