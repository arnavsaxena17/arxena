import { Injectable, Logger, Optional } from '@nestjs/common';

import { createHash } from 'crypto';

import { isNonEmptyString } from '@sniptt/guards';

import { isDefined } from 'twenty-shared/utils';

import { type Candidate } from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/find-people-by-company.types';
import { TheOfficialBoardService } from 'src/engine/core-modules/theofficialboard/services/theofficialboard.service';
import { type TheOfficialBoardCompanyResponse } from 'src/engine/core-modules/theofficialboard/types/theofficialboard.types';
import { TheOrgService } from 'src/engine/core-modules/theorg/services/theorg.service';
import { type TheOrgCompanyResponse } from 'src/engine/core-modules/theorg/types/theorg.types';

// TheOrg and The Official Board already publish a company's leadership as
// structured people, so they are asked beside the Google SERP fan-out instead
// of being turned into queries. Both are external crawls that can be slow, so
// each is behind its own flag and under its own deadline: a slow one is
// dropped instead of holding the pair.
const THEORG_FLAG = 'USE_THEORG_AS_SERP_SOURCE';
const THEOFFICIALBOARD_FLAG = 'USE_THEOFFICIALBOARD_AS_SERP_SOURCE';
const THEORG_MODE_FLAG = 'THEORG_SERP_MODE';
const SOURCE_TIMEOUT_MS_FLAG = 'FIND_ROLE_SERP_ORG_SOURCE_TIMEOUT_MS';
// A big company page can list thousands of positions; the judge reads every
// candidate it is given, so each source contributes a bounded slice (the same
// ceiling the Google results use) instead of flooding it
const MAX_PEOPLE_PER_SOURCE = 40;
// A pair already spends up to 75s on Google; this keeps the added sources
// inside the same envelope
const DEFAULT_SOURCE_TIMEOUT_MS = 45_000;

export type SerpSourcePeople = {
  candidates: Candidate[];
  errors: string[];
};

type SerpProvider = 'theorg' | 'officialboard';

type ProviderResult = {
  provider: SerpProvider;
  candidates: Candidate[];
  error?: string;
};

const isFlagOn = (name: string): boolean => {
  const value = process.env[name]?.trim().toLowerCase();

  return value === 'true' || value === '1' || value === 'yes';
};

const readMilliseconds = (name: string, fallback: number): number => {
  const configured = Number(process.env[name]);

  return Number.isFinite(configured) && configured >= 0 ? configured : fallback;
};

// TheOrg slugs are hyphenated; the Official Board normalizes the name itself
const toSlug = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const toId = (value: string): string =>
  createHash('sha1').update(value).digest('hex');

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// The crawl cannot be cancelled, so a late rejection after the deadline must
// not surface as an unhandled one
const withTimeout = <TResult>(
  promise: Promise<TResult>,
  milliseconds: number,
  label: string,
): Promise<TResult> => {
  if (milliseconds <= 0) {
    return promise;
  }

  promise.catch(() => undefined);

  const deadline =
    milliseconds < 1000
      ? `${milliseconds}ms`
      : `${Math.round(milliseconds / 1000)}s`;

  return new Promise<TResult>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${deadline}`)),
      milliseconds,
    );

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
};

@Injectable()
export class FindPeopleSerpSourcesService {
  private readonly logger = new Logger(FindPeopleSerpSourcesService.name);

  constructor(
    // Optional: the module is not loaded where these are not wired (tests)
    @Optional()
    private readonly theOrgService?: TheOrgService,
    @Optional()
    private readonly theOfficialBoardService?: TheOfficialBoardService,
  ) {}

  isTheOrgEnabled(): boolean {
    return isFlagOn(THEORG_FLAG) && isDefined(this.theOrgService);
  }

  isTheOfficialBoardEnabled(): boolean {
    return (
      isFlagOn(THEOFFICIALBOARD_FLAG) && isDefined(this.theOfficialBoardService)
    );
  }

  isEnabled(): boolean {
    return this.isTheOrgEnabled() || this.isTheOfficialBoardEnabled();
  }

  private get sourceTimeoutMs(): number {
    return readMilliseconds(SOURCE_TIMEOUT_MS_FLAG, DEFAULT_SOURCE_TIMEOUT_MS);
  }

  // Both sources are asked at once and each failure stays its own, so a slow
  // or blocked provider does not cost the other
  async fetchPeople({
    companyName,
    alternateNames = [],
  }: {
    companyName: string;
    alternateNames?: string[];
  }): Promise<SerpSourcePeople> {
    const requests: Array<Promise<ProviderResult>> = [];

    if (this.isTheOrgEnabled()) {
      requests.push(
        this.fetchProvider('theorg', () =>
          this.fetchTheOrgPeople(companyName, alternateNames),
        ),
      );
    }

    if (this.isTheOfficialBoardEnabled()) {
      requests.push(
        this.fetchProvider('officialboard', () =>
          this.fetchTheOfficialBoardPeople(companyName, alternateNames),
        ),
      );
    }

    if (requests.length === 0) {
      return { candidates: [], errors: [] };
    }

    const results = await Promise.all(requests);
    const candidates: Candidate[] = [];
    const errors: string[] = [];

    for (const result of results) {
      candidates.push(...result.candidates);

      if (isDefined(result.error)) {
        errors.push(`${result.provider}: ${result.error}`);
      }

      this.logger.log(
        `find_people_by_company serp source ${result.provider} for "${companyName}": ${result.candidates.length} people${result.error ? ` (${result.error})` : ''}`,
      );
    }

    return { candidates, errors };
  }

  private async fetchProvider(
    provider: SerpProvider,
    task: () => Promise<Candidate[]>,
  ): Promise<ProviderResult> {
    try {
      const candidates = await withTimeout(
        task(),
        this.sourceTimeoutMs,
        provider,
      );

      return { provider, candidates };
    } catch (error) {
      return { provider, candidates: [], error: describeError(error) };
    }
  }

  // The name the user gave is the one the row is about: the sources resolve a
  // page from it, and a legal-suffix difference must not read as another
  // company. Their own name for the page stays in the evidence.
  private async fetchTheOrgPeople(
    companyName: string,
    alternateNames: string[],
  ): Promise<Candidate[]> {
    const service = this.theOrgService;

    if (!isDefined(service)) {
      return [];
    }

    for (const name of [companyName, ...alternateNames]) {
      const slug = toSlug(name);

      if (!isNonEmptyString(slug)) {
        continue;
      }

      try {
        const company = await service.fetchCompanyDetailsResolvingSlug(slug, {
          mode: this.theOrgMode,
          includePeopleProfiles: false,
          persist: false,
        });

        return this.theOrgCandidates(company, companyName);
      } catch (error) {
        // The next name is only worth a try when this one resolved to no page
        if (
          !/could not resolve|not found|\b404\b/i.test(describeError(error))
        ) {
          throw error;
        }
      }
    }

    return [];
  }

  private get theOrgMode(): 'teams' | 'orgchart' | 'offices' | 'combined' {
    const configured = process.env[THEORG_MODE_FLAG]?.trim().toLowerCase();

    return configured === 'teams' ||
      configured === 'orgchart' ||
      configured === 'offices'
      ? configured
      : 'combined';
  }

  private theOrgCandidates(
    company: TheOrgCompanyResponse,
    requestedCompanyName: string,
  ): Candidate[] {
    const companyName = company.companyName?.trim() || requestedCompanyName;
    const companyUrl = company.url?.trim() || 'https://theorg.com';
    const candidates: Candidate[] = [];

    for (const person of company.people ?? []) {
      const name = person.name?.trim();

      if (!isNonEmptyString(name)) {
        continue;
      }

      const title = person.role?.trim() ?? '';
      const linkedinUrl = person.linkedInUrl?.trim() ?? '';
      const profileUrl = person.profileUrl?.trim() || companyUrl;

      candidates.push({
        id: toId(`theorg:${String(person.id)}`),
        name,
        title,
        companyName: requestedCompanyName,
        linkedinUrl,
        evidenceText: `Listed on TheOrg as ${title || 'a leader'} at ${companyName}: ${profileUrl}`,
        source: 'google',
        provider: 'theorg',
      });
    }

    return candidates.slice(0, MAX_PEOPLE_PER_SOURCE);
  }

  private async fetchTheOfficialBoardPeople(
    companyName: string,
    alternateNames: string[],
  ): Promise<Candidate[]> {
    const service = this.theOfficialBoardService;

    if (!isDefined(service)) {
      return [];
    }

    for (const name of [companyName, ...alternateNames]) {
      if (!isNonEmptyString(name.trim())) {
        continue;
      }

      try {
        const company = await service.fetchCompanyDetailsResolvingSlug(name, {
          persist: false,
        });

        return this.theOfficialBoardCandidates(company, companyName);
      } catch (error) {
        // The next name is only worth a try when this one resolved to no page
        if (
          !/could not resolve|not found|\b404\b/i.test(describeError(error))
        ) {
          throw error;
        }
      }
    }

    return [];
  }

  // Masked people carry no name the user could act on, so they are skipped
  private theOfficialBoardCandidates(
    company: TheOfficialBoardCompanyResponse,
    requestedCompanyName: string,
  ): Candidate[] {
    const companyName = company.companyName?.trim() || requestedCompanyName;
    const companyUrl =
      company.url?.trim() ||
      `https://www.theofficialboard.com/org-chart/${company.slug}`;
    const candidates: Candidate[] = [];

    for (const person of company.candidates ?? []) {
      const name = person.name?.trim();

      if (person.isMasked || !isNonEmptyString(name)) {
        continue;
      }

      const title = (person.displayTitle ?? person.title ?? '').trim();

      candidates.push({
        id: toId(`officialboard:${person.id}`),
        name,
        title,
        companyName: requestedCompanyName,
        // The page publishes no LinkedIn profile for its people
        linkedinUrl: '',
        evidenceText: `Listed on TheOfficialBoard as ${title || 'a leader'} at ${companyName}: ${companyUrl}`,
        source: 'google',
        provider: 'officialboard',
      });
    }

    return candidates.slice(0, MAX_PEOPLE_PER_SOURCE);
  }
}
