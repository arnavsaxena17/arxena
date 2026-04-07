import { Injectable, Logger } from '@nestjs/common';

import type {
  BrightDataDatasetSnapshotItem,
  BrightDataSerpGoogleJson,
  BrightDataSerpOrganicEntry,
} from 'src/engine/core-modules/bright-data/types/bright-data-serp.types';
import { normalizeLinkedInUrl } from 'src/engine/core-modules/candidate-sourcing/utils/linkedin-url.utils';
import type {
  LinkedInCurrentPosition,
  LinkedInPeopleSearchResult,
} from 'src/engine/core-modules/linkedin-search/types/linkedin-search-response.type';

import { BrightDataSerpService } from './bright-data-serp.service';

export type SerpSearchEngine = 'google' | 'bing';

export type FetchLinkedinPeoplePageUpdate = {
  engine: SerpSearchEngine;
  page: number;
  url: string;
  fetchedPages: number[];
  totalPagesAvailable?: number;
  /** SERP-reported total hit count when available (for org-chart progress remainingToFetch). */
  totalResultsReported?: number;
  resultsInPage: number;
  newUniqueResultsInPage: number;
  totalUniqueResults: number;
  candidates: LinkedInPeopleSearchResult[];
};

export type FetchLinkedinPeoplePostProcessInput = {
  engine: SerpSearchEngine;
  page: number;
  newUniqueCandidates: LinkedInPeopleSearchResult[];
  /** Total unique LinkedIn profiles collected before this page's new rows are added. */
  totalUniqueResultsSoFarBeforeThisPage: number;
};

export type FetchLinkedinPeopleResultsParams = {
  urls: Partial<Record<SerpSearchEngine, string>>;
  engines: SerpSearchEngine[];
  keywords?: Partial<Record<SerpSearchEngine, string>>;
  includePaginatedHtml?: boolean;
  dedupeByLinkedinUrl?: boolean;
  /**
   * After each page is parsed, optionally enrich rows (e.g. full LinkedIn profile via Bright Data)
   * and decide whether to continue SERP pagination (e.g. LLM validation vs target company).
   */
  postProcessPageCandidates?: (
    input: FetchLinkedinPeoplePostProcessInput,
  ) => Promise<{
    candidates: LinkedInPeopleSearchResult[];
    continuePagination: boolean;
  }>;
  onStatus?: (
    update: {
      engine: SerpSearchEngine;
      message: string;
      snapshotId?: string;
      pollingAttempt?: number;
    },
  ) => Promise<void> | void;
  onPageFetched?: (update: FetchLinkedinPeoplePageUpdate) => Promise<void> | void;
};

export type FetchLinkedinPeopleResultsResponse = {
  candidates: LinkedInPeopleSearchResult[];
  engines: Array<{
    engine: SerpSearchEngine;
    pagesFetched: number[];
    totalPagesAvailable?: number;
    totalResultsReported?: number;
  }>;
};

@Injectable()
export class BrightDataLinkedinPeopleSearchService {
  private readonly logger = new Logger(BrightDataLinkedinPeopleSearchService.name);

  constructor(private readonly brightDataSerpService: BrightDataSerpService) {}

  private get maxPages(): number {
    return Math.max(1, Number(process.env.BRIGHT_DATA_SERP_MAX_PAGES ?? 100));
  }

  async fetchAllPeopleResults(
    params: FetchLinkedinPeopleResultsParams,
  ): Promise<FetchLinkedinPeopleResultsResponse> {
    console.log("Fetching all people results in bright data linkedin people search service with params:", params)
    if (params.includePaginatedHtml) {
      return this.fetchAllPeopleResultsViaBrightDataSnapshot(params);
    }

    return this.fetchAllPeopleResultsViaDirectPagination(params);
  }

  private async fetchAllPeopleResultsViaDirectPagination(
    params: FetchLinkedinPeopleResultsParams,
  ): Promise<FetchLinkedinPeopleResultsResponse> {
    const engines = params.engines.filter(
      (engine): engine is SerpSearchEngine =>
        (engine === 'google' || engine === 'bing') &&
        typeof params.urls[engine] === 'string' &&
        Boolean(params.urls[engine]?.trim()),
    );

    const allCandidates: LinkedInPeopleSearchResult[] = [];
    const seenLinkedinUrls = new Set<string>();
    const engineSummaries: FetchLinkedinPeopleResultsResponse['engines'] = [];

    for (const engine of engines) {
      const baseUrl = params.urls[engine]?.trim();
      if (!baseUrl) {
        continue;
      }

      let currentUrl = baseUrl;
      let currentPage = 1;
      const fetchedPages: number[] = [];
      let totalPagesAvailable: number | undefined;
      let totalResultsReported: number | undefined;

      while (currentUrl && currentPage <= this.maxPages) {
        const serp = await this.brightDataSerpService.requestSerpJson(currentUrl);

        totalPagesAvailable =
          serp.pagination?.pages?.length ||
          serp.pagination?.next_page ||
          totalPagesAvailable;
        totalResultsReported = serp.general?.results_cnt ?? totalResultsReported;

        const pageCandidates = this.mapOrganicEntriesToCandidates(
          serp.organic ?? [],
          engine,
        );

        const newUniqueCandidates: LinkedInPeopleSearchResult[] = [];

        for (const candidate of pageCandidates) {
          const linkedinUrl = candidate.profile_url || candidate.public_profile_url;
          const dedupeKey = linkedinUrl ? normalizeLinkedInUrl(linkedinUrl) : candidate.id;

          if (params.dedupeByLinkedinUrl !== false && seenLinkedinUrls.has(dedupeKey)) {
            continue;
          }

          seenLinkedinUrls.add(dedupeKey);
          newUniqueCandidates.push(candidate);
        }

        let candidatesForPage = newUniqueCandidates;
        let continuePaginationAfterPage = true;

        if (params.postProcessPageCandidates && newUniqueCandidates.length > 0) {
          const processed = await params.postProcessPageCandidates({
            engine,
            page: currentPage,
            newUniqueCandidates,
            totalUniqueResultsSoFarBeforeThisPage: allCandidates.length,
          });
          candidatesForPage = processed.candidates;
          continuePaginationAfterPage = processed.continuePagination;
        }

        for (const candidate of candidatesForPage) {
          allCandidates.push(candidate);
        }

        fetchedPages.push(currentPage);

        await params.onPageFetched?.({
          engine,
          page: currentPage,
          url: currentUrl,
          fetchedPages: [...fetchedPages],
          totalPagesAvailable,
          totalResultsReported,
          resultsInPage: pageCandidates.length,
          newUniqueResultsInPage: candidatesForPage.length,
          totalUniqueResults: allCandidates.length,
          candidates: candidatesForPage,
        });

        if (pageCandidates.length === 0) {
          break;
        }

        if (newUniqueCandidates.length === 0 && currentPage > 1) {
          this.logger.log(
            `Stopping ${engine} SERP pagination at page ${currentPage}: page contained only duplicate LinkedIn profiles.`,
          );
          break;
        }

        if (!continuePaginationAfterPage) {
          this.logger.log(
            `Stopping ${engine} SERP pagination at page ${currentPage}: postProcessPageCandidates requested stop.`,
          );
          break;
        }

        const nextUrl = this.resolveNextPageUrl({
          engine,
          currentUrl,
          serp,
          currentPage,
        });

        if (!nextUrl || nextUrl === currentUrl) {
          break;
        }

        currentUrl = nextUrl;
        currentPage += 1;
      }

      engineSummaries.push({
        engine,
        pagesFetched: fetchedPages,
        totalPagesAvailable,
        totalResultsReported,
      });
    }

    return {
      candidates: allCandidates,
      engines: engineSummaries,
    };
  }

  private async fetchAllPeopleResultsViaBrightDataSnapshot(
    params: FetchLinkedinPeopleResultsParams,
  ): Promise<FetchLinkedinPeopleResultsResponse> {
    const engines = params.engines.filter(
      (engine): engine is SerpSearchEngine =>
        (engine === 'google' || engine === 'bing') &&
        Boolean(params.keywords?.[engine]?.trim()),
    );

    const allCandidates: LinkedInPeopleSearchResult[] = [];
    const seenLinkedinUrls = new Set<string>();
    const engineSummaries: FetchLinkedinPeopleResultsResponse['engines'] = [];

    for (const engine of engines) {
      const keyword = params.keywords?.[engine]?.trim();

      if (!keyword) {
        continue;
      }

      const { snapshotId } =
        await this.brightDataSerpService.createDatasetSnapshot({
          items: [
            {
              url:
                engine === 'google'
                  ? 'https://www.google.com/'
                  : 'https://www.bing.com/',
              keyword,
            },
          ],
          includePaginatedHtml: true,
          onStatus: async (update) => {
            const phaseMessage =
              update.phase === 'submitting'
                ? `Submitting Bright Data snapshot request for ${engine}...`
                : update.phase === 'submitted'
                  ? `Bright Data accepted the ${engine} scrape request and returned snapshot ${update.snapshot_id}.`
                  : update.phase === 'discovering_snapshot'
                    ? `Waiting for Bright Data to register a snapshot id for ${engine}...`
                    : `Discovered Bright Data snapshot ${update.snapshot_id} for ${engine}. Waiting for processing...`;

            await params.onStatus?.({
              engine,
              message: phaseMessage,
              snapshotId: update.snapshot_id,
              pollingAttempt: update.attempt,
            });
          },
        });

      this.logger.log(
        `Bright Data snapshot submission complete engine=${engine} snapshotId=${snapshotId} keyword=${keyword}`,
      );

      const snapshotItems =
        await this.brightDataSerpService.pollDatasetSnapshotUntilReady({
          snapshotId,
          onPoll: async (update) => {
            await params.onStatus?.({
              engine,
              message:
                update.status === 'ready'
                  ? `Bright Data snapshot ${snapshotId} is ready. Parsing results...`
                  : `Polling Bright Data snapshot ${snapshotId} (${update.status ?? 'running'})`,
              snapshotId,
              pollingAttempt: update.attempt,
            });
          },
        });

      const snapshotCandidates = this.extractSnapshotCandidates(snapshotItems, engine);
      const fetchedPages: number[] = [];
      let totalPagesAvailable =
        this.extractSnapshotTotalPages(snapshotItems) || undefined;

      for (const pageGroup of snapshotCandidates.pageGroups) {
        const newUniqueCandidates: LinkedInPeopleSearchResult[] = [];

        for (const candidate of pageGroup.candidates) {
          const linkedinUrl = candidate.profile_url || candidate.public_profile_url;
          const dedupeKey = linkedinUrl
            ? normalizeLinkedInUrl(linkedinUrl)
            : candidate.id;

          if (params.dedupeByLinkedinUrl !== false && seenLinkedinUrls.has(dedupeKey)) {
            continue;
          }

          seenLinkedinUrls.add(dedupeKey);
          newUniqueCandidates.push(candidate);
        }

        let candidatesForPage = newUniqueCandidates;
        let continuePaginationAfterPage = true;

        if (params.postProcessPageCandidates && newUniqueCandidates.length > 0) {
          const processed = await params.postProcessPageCandidates({
            engine,
            page: pageGroup.page,
            newUniqueCandidates,
            totalUniqueResultsSoFarBeforeThisPage: allCandidates.length,
          });
          candidatesForPage = processed.candidates;
          continuePaginationAfterPage = processed.continuePagination;
        }

        for (const candidate of candidatesForPage) {
          allCandidates.push(candidate);
        }

        fetchedPages.push(pageGroup.page);
        totalPagesAvailable = Math.max(
          totalPagesAvailable ?? 0,
          pageGroup.page,
          fetchedPages.length,
        );

        await params.onPageFetched?.({
          engine,
          page: pageGroup.page,
          url: pageGroup.url,
          fetchedPages: [...fetchedPages],
          totalPagesAvailable,
          totalResultsReported: snapshotCandidates.totalResultsReported,
          resultsInPage: pageGroup.candidates.length,
          newUniqueResultsInPage: candidatesForPage.length,
          totalUniqueResults: allCandidates.length,
          candidates: candidatesForPage,
        });

        if (!continuePaginationAfterPage) {
          this.logger.log(
            `Stopping ${engine} snapshot pagination at page ${pageGroup.page}: postProcessPageCandidates requested stop.`,
          );
          break;
        }
      }

      engineSummaries.push({
        engine,
        pagesFetched: fetchedPages,
        totalPagesAvailable,
        totalResultsReported: snapshotCandidates.totalResultsReported,
      });
    }

    return {
      candidates: allCandidates,
      engines: engineSummaries,
    };
  }

  private resolveNextPageUrl(input: {
    engine: SerpSearchEngine;
    currentUrl: string;
    serp: BrightDataSerpGoogleJson;
    currentPage: number;
  }): string | null {
    const explicitNextLink = input.serp.pagination?.next_page_link?.trim();
    if (explicitNextLink) {
      return explicitNextLink;
    }

    const url = new URL(input.currentUrl);

    if (input.engine === 'google') {
      const nextStart =
        input.serp.pagination?.next_page_start ??
        Number(url.searchParams.get('start') ?? '0') + 10;

      if (!Number.isFinite(nextStart)) {
        return null;
      }

      url.searchParams.set('start', String(nextStart));

      return url.toString();
    }

    const currentFirst = Number(url.searchParams.get('first') ?? '1');
    const nextFirst = Number.isFinite(currentFirst) ? currentFirst + 10 : input.currentPage * 10 + 1;

    url.searchParams.set('first', String(nextFirst));

    return url.toString();
  }

  private extractSnapshotCandidates(
    snapshotItems: BrightDataDatasetSnapshotItem[],
    engine: SerpSearchEngine,
  ): {
    pageGroups: Array<{
      page: number;
      url: string;
      candidates: LinkedInPeopleSearchResult[];
    }>;
    totalResultsReported?: number;
  } {
    const groupedEntries = new Map<
      number,
      { url: string; entries: BrightDataSerpOrganicEntry[] }
    >();
    let totalResultsReported: number | undefined;

    for (const item of snapshotItems) {
      totalResultsReported =
        item.general?.results_cnt ?? totalResultsReported;

      for (const entry of item.organic ?? []) {
        const page = this.resolveSnapshotEntryPage(entry.url, engine);
        const current = groupedEntries.get(page);

        if (current) {
          current.entries.push(entry);
          continue;
        }

        groupedEntries.set(page, {
          url: entry.url?.trim() || item.url?.trim() || '',
          entries: [entry],
        });
      }
    }

    const pageGroups = [...groupedEntries.entries()]
      .sort(([left], [right]) => left - right)
      .map(([page, group]) => ({
        page,
        url: group.url,
        candidates: this.mapOrganicEntriesToCandidates(group.entries, engine),
      }));

    return {
      pageGroups,
      totalResultsReported,
    };
  }

  private extractSnapshotTotalPages(
    snapshotItems: BrightDataDatasetSnapshotItem[],
  ): number | null {
    let maxPage = 1;

    for (const item of snapshotItems) {
      for (const page of item.pagination ?? []) {
        const numericPage = Number(page.page);

        if (Number.isFinite(numericPage) && numericPage > maxPage) {
          maxPage = numericPage;
        }
      }
    }

    return maxPage > 0 ? maxPage : null;
  }

  private resolveSnapshotEntryPage(
    sourceUrl: string | undefined,
    engine: SerpSearchEngine,
  ): number {
    if (!sourceUrl) {
      return 1;
    }

    try {
      const parsed = new URL(sourceUrl);

      if (engine === 'google') {
        const start = Number(parsed.searchParams.get('start') ?? '0');

        if (Number.isFinite(start) && start >= 0) {
          return Math.floor(start / 10) + 1;
        }
      }

      const first = Number(parsed.searchParams.get('first') ?? '1');

      if (Number.isFinite(first) && first >= 1) {
        return Math.floor((first - 1) / 10) + 1;
      }
    } catch {
      return 1;
    }

    return 1;
  }

  private mapOrganicEntriesToCandidates(
    organicEntries: BrightDataSerpOrganicEntry[],
    engine: SerpSearchEngine,
  ): LinkedInPeopleSearchResult[] {
    return organicEntries
      .map((entry, index) => this.mapOrganicEntryToCandidate(entry, engine, index))
      .filter((candidate): candidate is LinkedInPeopleSearchResult => candidate !== null);
  }

  private mapOrganicEntryToCandidate(
    entry: BrightDataSerpOrganicEntry,
    engine: SerpSearchEngine,
    index: number,
  ): LinkedInPeopleSearchResult | null {
    const linkedinUrl = this.extractLinkedinProfileUrl(entry.link);
    if (!linkedinUrl) {
      return null;
    }

    const publicIdentifier = this.extractPublicIdentifier(linkedinUrl);
    const title = (entry.title || '').trim();
    const [nameFromTitle, headlineFromTitle] = this.splitTitle(title);
    const extensionTexts = (entry.extensions ?? [])
      .map((extension) => extension.text?.trim() || '')
      .filter(Boolean);

    const location = extensionTexts[0] ?? null;
    const role = extensionTexts[1] ?? headlineFromTitle;
    const company = extensionTexts[2] ?? null;
    const name = nameFromTitle || this.fallbackNameFromUrl(publicIdentifier) || title || linkedinUrl;
    const headline = headlineFromTitle || entry.description?.trim() || role || '';

    const currentPositions: LinkedInCurrentPosition[] = role
      ? [
          {
            company: company || '',
            company_id: null,
            description: entry.description?.trim() || null,
            role,
            location,
            industry: [],
            tenure_at_role: { years: 0, months: 0 },
            tenure_at_company: { years: 0, months: 0 },
            start: { year: new Date().getUTCFullYear() },
            skills: null,
          },
        ]
      : [];

    const [firstName, ...lastNameParts] = name.split(/\s+/).filter(Boolean);

    return {
      object: 'SearchResult',
      type: 'PEOPLE',
      id: `${engine}-${publicIdentifier || index}-${entry.global_rank || index + 1}`,
      public_identifier: publicIdentifier,
      public_profile_url: linkedinUrl,
      profile_url: linkedinUrl,
      profile_picture_url: null,
      profile_picture_url_large: null,
      member_urn: null,
      name,
      first_name: firstName || '',
      last_name: lastNameParts.join(' '),
      network_distance: 'OUT_OF_NETWORK',
      location,
      industry: null,
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

  private extractLinkedinProfileUrl(link?: string): string | null {
    if (!link) {
      return null;
    }

    try {
      const parsed = new URL(link.trim());
      const normalizedHost = parsed.hostname.replace(/^www\./, '').toLowerCase();
      const normalizedPath = parsed.pathname.replace(/\/+$/, '');

      if (
        normalizedHost.endsWith('linkedin.com') &&
        (normalizedPath.startsWith('/in/') || normalizedPath.startsWith('/pub/'))
      ) {
        return normalizeLinkedInUrl(`${parsed.origin}${normalizedPath}`);
      }
    } catch {
      return null;
    }

    return null;
  }

  private extractPublicIdentifier(linkedinUrl: string | null): string | null {
    if (!linkedinUrl) {
      return null;
    }

    try {
      const parsed = new URL(linkedinUrl);
      const segments = parsed.pathname.split('/').filter(Boolean);

      if (segments.length >= 2 && (segments[0] === 'in' || segments[0] === 'pub')) {
        return segments[1] || null;
      }
    } catch {
      return null;
    }

    return null;
  }

  private splitTitle(title: string): [string, string] {
    const cleaned = title
      .replace(/\s+\|\s+LinkedIn$/i, '')
      .replace(/\s+-\s+LinkedIn$/i, '')
      .trim();

    if (!cleaned) {
      return ['', ''];
    }

    const separatorIndex = cleaned.indexOf(' - ');
    if (separatorIndex === -1) {
      return [cleaned, ''];
    }

    return [
      cleaned.slice(0, separatorIndex).trim(),
      cleaned.slice(separatorIndex + 3).trim(),
    ];
  }

  private fallbackNameFromUrl(publicIdentifier: string | null): string {
    if (!publicIdentifier) {
      return '';
    }

    return publicIdentifier
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}
