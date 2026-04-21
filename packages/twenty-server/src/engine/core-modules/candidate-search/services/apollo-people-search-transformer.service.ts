import { Injectable } from '@nestjs/common';

import {
    LinkedInSearchTransformerService,
    TransformedCandidateForTable,
} from 'src/engine/core-modules/candidate-sourcing/services/data-sources/linkedin-search-transformer.service';
import type {
    LinkedInCurrentPosition,
    LinkedInPeopleSearchResult,
} from 'src/engine/core-modules/linkedin-search/types/linkedin-search-response.type';

const APOLLO_TABLE_JOB_ID = 'apollo_search_job';
const APOLLO_TABLE_JOB_NAME = 'Apollo Search Results';

/** Extract LinkedIn public slug from profile URL for `public_identifier`. */
export function linkedinUrlToPublicIdentifier(
  linkedinUrl: string | undefined,
): string | null {
  if (!linkedinUrl?.trim()) return null;
  try {
    const u = linkedinUrl.trim();
    const match = u.match(/linkedin\.com\/in\/([^/?#]+)/i);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

@Injectable()
export class ApolloPeopleSearchTransformerService {
  constructor(
    private readonly linkedInSearchTransformer: LinkedInSearchTransformerService,
  ) {}

  /**
   * Map one Apollo person record (from mixed_people/api_search) to LinkedIn-shaped result.
   */
  apolloPersonToLinkedInPeopleResult(
    raw: Record<string, unknown>,
  ): LinkedInPeopleSearchResult {
    const id =
      typeof raw.id === 'string'
        ? raw.id
        : typeof raw.id === 'number'
          ? String(raw.id)
          : `apollo_${Date.now()}`;
    const firstName =
      typeof raw.first_name === 'string' ? raw.first_name : '';
    const lastName = typeof raw.last_name === 'string' ? raw.last_name : '';
    const name =
      typeof raw.name === 'string' && raw.name.trim()
        ? raw.name.trim()
        : [firstName, lastName].filter(Boolean).join(' ').trim() || 'Unknown';

    const title = typeof raw.title === 'string' ? raw.title : '';
    const headline =
      typeof raw.headline === 'string' && raw.headline.trim()
        ? raw.headline.trim()
        : title;

    const linkedinUrl =
      typeof raw.linkedin_url === 'string' ? raw.linkedin_url.trim() : '';
    const org =
      raw.organization && typeof raw.organization === 'object'
        ? (raw.organization as Record<string, unknown>)
        : undefined;
    const orgName =
      org && typeof org.name === 'string'
        ? org.name
        : typeof raw.organization_name === 'string'
          ? raw.organization_name
          : '';

    const city = typeof raw.city === 'string' ? raw.city : '';
    const state = typeof raw.state === 'string' ? raw.state : '';
    const country = typeof raw.country === 'string' ? raw.country : '';
    const locationParts = [city, state, country].filter((p) => p && p.trim());
    const location =
      locationParts.length > 0 ? locationParts.join(', ') : null;

    const currentPositions: LinkedInCurrentPosition[] = [];
    if (title || orgName) {
      currentPositions.push({
        company: orgName || '—',
        company_id: null,
        description: null,
        role: title || headline,
        location: location,
        industry: [],
        tenure_at_role: { years: 0, months: 0 },
        tenure_at_company: { years: 0, months: 0 },
        start: { year: new Date().getFullYear(), month: 1 },
        skills: null,
      });
    }

    const publicId = linkedinUrlToPublicIdentifier(linkedinUrl);

    return {
      object: 'SearchResult',
      type: 'PEOPLE',
      id,
      public_identifier: publicId,
      public_profile_url: linkedinUrl || null,
      profile_url: linkedinUrl || null,
      profile_picture_url:
        typeof raw.photo_url === 'string'
          ? raw.photo_url
          : typeof raw.profile_photo_url === 'string'
            ? raw.profile_photo_url
            : null,
      profile_picture_url_large: null,
      member_urn: null,
      name,
      first_name: firstName,
      last_name: lastName,
      network_distance: 'OUT_OF_NETWORK',
      location,
      industry:
        org && typeof org.industry === 'string' ? org.industry : null,
      keywords_match: '',
      headline,
      connections_count: 0,
      followers_count: 0,
      pending_invitation: false,
      can_send_inmail: false,
      hiddenCandidate: false,
      interestLikelihood: '',
      privacySettings: {
        allowConnectionsBrowse: false,
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
      current_positions: currentPositions,
      education: [],
      work_experience: [],
      certifications: [],
      projects: [],
    };
  }

  extractPeopleFromApolloResponse(
    data: Record<string, unknown>,
  ): Record<string, unknown>[] {
    const people = data.people;
    if (Array.isArray(people)) {
      return people.filter(
        (p): p is Record<string, unknown> =>
          p !== null && typeof p === 'object',
      );
    }
    const contacts = data.contacts;
    if (Array.isArray(contacts)) {
      return contacts.filter(
        (p): p is Record<string, unknown> =>
          p !== null && typeof p === 'object',
      );
    }
    return [];
  }

  transformApolloPeopleToTableRows(
    apolloResponse: Record<string, unknown>,
    options?: {
      companyName?: string;
      companyId?: string;
      companyLinkedinUrl?: string;
    },
  ): TransformedCandidateForTable[] {
    const rawPeople = this.extractPeopleFromApolloResponse(apolloResponse);
    if (!rawPeople.length) {
      return [];
    }

    const linkedInShaped = rawPeople.map((r) =>
      this.apolloPersonToLinkedInPeopleResult(r),
    );

    const tableRows =
      this.linkedInSearchTransformer.transformSearchResultsToTableFormat(
        linkedInShaped,
        APOLLO_TABLE_JOB_ID,
        APOLLO_TABLE_JOB_NAME,
      );

    const withMeta = this.linkedInSearchTransformer.addMetadataToCandidates(
      tableRows,
      {
        searchType: 'apollo',
        searchCategory: 'people',
        timestamp: new Date().toISOString(),
        processingTime: 0,
      },
    );

    const normalizedCompany = options?.companyName?.trim();
    const normalizedCompanyId = options?.companyId?.trim();
    const normalizedLinkedin = options?.companyLinkedinUrl?.trim();

    return withMeta.map((row) => ({
      ...row,
      source: 'apollo',
      campaign: 'apollo_people',
      ...(normalizedCompany
        ? {
            company: normalizedCompany,
            jobCompanyName: normalizedCompany,
          }
        : {}),
      ...(normalizedCompanyId ? { jobCompanyId: normalizedCompanyId } : {}),
      ...(normalizedLinkedin
        ? { jobCompanyLinkedinUrl: normalizedLinkedin }
        : {}),
    }));
  }
}
