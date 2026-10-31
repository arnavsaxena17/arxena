import { Injectable } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import { BRIGHT_DATA_COST_PER_RECORD_USD } from 'src/engine/core-modules/bright-data/ludicrous/constants/bright-data-ludicrous-pricing.const';
import { type BrightDataLudicrousQuery } from 'src/engine/core-modules/bright-data/ludicrous/types/bright-data-ludicrous.types';
import { BrightDataBusinessSearchService } from 'src/engine/core-modules/bright-data/services/bright-data-business-search.service';
import { mapBrightDataPersonToSearchItem } from 'src/engine/core-modules/bright-data/utils/bright-data-business-search.util';
import {
  type GoogleSerpOrganicItem,
  mapGoogleSerpOrganicResults,
} from 'src/engine/core-modules/org-chart/utils/map-google-serp-organic.util';
import { companyBrandKey } from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/company-name-variants.util';
import { FindPeopleGoogleSearchService } from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/find-people-google-search.service';
import {
  linkedinProfileUrlFromPostUrl,
  normalizeLinkedinProfileUrl,
  parseLinkedinSerpResult,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/parse-linkedin-serp-result.util';
import { personNamesMatch } from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/person-name-matching.util';

const BRIGHT_DATA_NAME_LOOKUP_LIMIT = 5;
const MAX_COMPANY_NAMES = 3;
const MAX_PROFILES = 3;
// Finding the profile is the point of this step, so its Google queries are
// retried harder than the broad company queries
const NAME_LOOKUP_SERP_RETRIES = 4;
// One lookup never holds a company longer than this: the profile is the point,
// but a person who cannot be found in a minute is returned without one
const NAME_LOOKUP_DEADLINE_MS = 60_000;

export type ResolvedLinkedinProfile = {
  linkedinUrl: string;
  // What the profile says; empty when only Google gave the URL, or when
  // Bright Data has the person but no title or company for them
  title: string;
  companyName: string;
  // The words the profile was read from, for whoever judges it
  evidence: string;
  via: 'bright_data' | 'google';
  // How many Bright Data profiles carry exactly this name; a name only one
  // profile has is far less likely to be a namesake
  sameNameProfileCount: number | null;
  // Does the profile hold the role at the company now, hold it in its history,
  // or was the company not confirmed at all. A past hit is an alumnus, not the
  // current owner, so callers must not treat it as one.
  companyRelation: 'current' | 'past' | 'unknown';
  derivedFromPost: boolean;
};

const shortest = (names: string[]): string =>
  [...names].sort((first, second) => first.length - second.length)[0];

// A name with no profile is a lead, a name with a LinkedIn URL is something
// that can be contacted, so every name found is chased to its profile. This
// returns the profiles that carry the name, not a verdict on them: a namesake
// ("132 Binita Shah, one at 99 Pancakes") or a profile whose company is a
// parent or operator of the target (Westlife for Hardcastle) only a reader who
// understands the companies can tell apart, so the caller judges them.
@Injectable()
export class LinkedinProfileResolverService {
  constructor(
    private readonly brightDataBusinessSearchService: BrightDataBusinessSearchService,
    private readonly googleSearchService: FindPeopleGoogleSearchService,
  ) {}

  async resolve({
    name,
    companyNames,
    title,
    googleOnlyWhenBrightDataMisses = false,
    skipBrightData = false,
    currentCompanyOnly = false,
  }: {
    name: string;
    // Every name the person's company goes by or is linked to, best first: the
    // employer their own results state, then the target and its alternates
    companyNames: string[];
    // The role the person is being resolved for; it is the disambiguator when
    // the name is common
    title?: string;
    // Ask Google only when the Bright Data name and company query found nobody:
    // slower and flakier than Bright Data, so callers on a budget skip it
    googleOnlyWhenBrightDataMisses?: boolean;
    // Bright Data is known to be unreachable: go straight to Google
    skipBrightData?: boolean;
    // Only the person at the company now counts (the role finder drops
    // alumni and namesakes anyway), so the past-company and name-only
    // fallbacks are not paid for
    currentCompanyOnly?: boolean;
  }): Promise<{
    profiles: ResolvedLinkedinProfile[];
    spentUsd: number;
    // Why a lookup could not run, so a miss is not mistaken for "no profile"
    errors: string[];
  }> {
    // One name per company, not per spelling: three spellings of one employer
    // used to be three paid searches
    const seenBrands = new Set<string>();
    const companies = companyNames
      .map((company) => company.trim())
      .filter((company) => {
        const brand = companyBrandKey(company);

        if (!isNonEmptyString(company) || seenBrands.has(brand)) {
          return false;
        }

        seenBrands.add(brand);

        return true;
      })
      .slice(0, MAX_COMPANY_NAMES);
    const errors: string[] = [];
    const lookUpBrightData = () =>
      (skipBrightData
        ? Promise.resolve({
            profiles: [] as ResolvedLinkedinProfile[],
            spentUsd: 0,
          })
        : this.resolveViaBrightData(name, companies, { currentCompanyOnly })
      ).catch((error) => {
        errors.push(
          `${name}: bright_data ${error instanceof Error ? error.message : String(error)}`,
        );

        return { profiles: [] as ResolvedLinkedinProfile[], spentUsd: 0 };
      });
    const noGoogle = {
      profiles: [] as ResolvedLinkedinProfile[],
      errors: [] as string[],
    };
    let fromBrightData: Awaited<ReturnType<typeof lookUpBrightData>>;
    let fromGoogle: Awaited<ReturnType<typeof this.resolveViaGoogle>>;

    if (googleOnlyWhenBrightDataMisses) {
      fromBrightData = await lookUpBrightData();
      // Profiles found by name alone are mostly namesakes, so only a hit on
      // the name and company query spares the Google lookup
      fromGoogle = fromBrightData.profiles.some(
        (profile) => profile.sameNameProfileCount === null,
      )
        ? noGoogle
        : await this.resolveViaGoogle(name, companies, title, {
            stopAtFirstMatch: currentCompanyOnly,
          });
    } else {
      [fromBrightData, fromGoogle] = await Promise.all([
        lookUpBrightData(),
        this.resolveViaGoogle(name, companies, title, {
          stopAtFirstMatch: currentCompanyOnly,
        }),
      ]);
    }

    errors.push(
      ...fromGoogle.errors.map((error) => `${name}: google ${error}`),
    );

    const byUrl = new Map<string, ResolvedLinkedinProfile>();

    // A current role first, then what Google showed, then an alumnus, then the
    // profiles found by name alone (mostly namesakes)
    for (const profile of [
      ...fromBrightData.profiles.filter(
        (candidate) => candidate.companyRelation === 'current',
      ),
      ...fromGoogle.profiles,
      ...fromBrightData.profiles.filter(
        (candidate) => candidate.companyRelation === 'past',
      ),
      ...fromBrightData.profiles.filter(
        (candidate) =>
          candidate.companyRelation === 'unknown' &&
          candidate.sameNameProfileCount !== null,
      ),
    ]) {
      const key = normalizeLinkedinProfileUrl(profile.linkedinUrl);
      const existing = byUrl.get(key);

      if (existing === undefined) {
        byUrl.set(key, profile);
      } else {
        // The same person seen twice: keep the stronger company evidence and
        // whatever Bright Data knows about namesakes
        const companyRelation =
          existing.companyRelation === 'current' ||
          profile.companyRelation === 'current'
            ? 'current'
            : existing.companyRelation === 'past' ||
                profile.companyRelation === 'past'
              ? 'past'
              : 'unknown';

        byUrl.set(key, {
          ...existing,
          companyRelation,
          sameNameProfileCount:
            existing.sameNameProfileCount ?? profile.sameNameProfileCount,
        });
      }
    }

    const profiles = [...byUrl.values()].slice(0, MAX_PROFILES);

    return {
      profiles,
      spentUsd: fromBrightData.spentUsd,
      errors: profiles.length === 0 ? [...new Set(errors)] : [],
    };
  }

  // Name and company first, one query per company name, as a structured
  // ludicrous query: the plain instant/smart name search returns nothing for a
  // name like "Suresh N" (verified live), while the exact-name text filter does.
  // Current company first, then past company (an alumnus is still that person),
  // then the name alone for profiles with no company filled in.
  private async resolveViaBrightData(
    name: string,
    companies: string[],
    { currentCompanyOnly }: { currentCompanyOnly: boolean },
  ): Promise<{ profiles: ResolvedLinkedinProfile[]; spentUsd: number }> {
    let spentUsd = 0;
    let firstError: unknown;
    const profiles: ResolvedLinkedinProfile[] = [];
    const search = async (query: BrightDataLudicrousQuery) => {
      const result = await this.brightDataBusinessSearchService.search({
        entity: 'people',
        mode: 'ludicrous',
        query,
        limit: BRIGHT_DATA_NAME_LOOKUP_LIMIT,
      });

      spentUsd += result.documents.length * BRIGHT_DATA_COST_PER_RECORD_USD;

      return result;
    };
    // A failed company query is not fatal while another one answers, but if
    // every source failed the caller must hear why instead of "no profile"
    const searchSafely = async (query: BrightDataLudicrousQuery) =>
      search(query).catch((error) => {
        firstError = firstError ?? error;

        return null;
      });
    // "all" not "any": "Suresh N" must not match every Suresh at the company
    const byName = { text: { name: { value: name, mode: 'all' as const } } };
    const collect = (
      documents: Array<Parameters<typeof this.toProfile>[0]>,
      relation: ResolvedLinkedinProfile['companyRelation'],
    ) => {
      for (const document of documents) {
        const profile = this.toProfile(document, name, null, relation);

        if (profile !== null) {
          profiles.push(profile);
        }
      }
    };

    const atCompany = (
      field: 'current_company_name' | 'past_company_names',
    ): BrightDataLudicrousQuery => {
      const filters = companies.map((company) => ({
        text: { [field]: { value: company, mode: 'all' as const } },
      }));

      return filters.length === 1 ? filters[0] : { or: filters };
    };
    // Every company name in one search: the name and any of them
    const current =
      companies.length > 0
        ? await searchSafely({
            and: [byName, atCompany('current_company_name')],
          })
        : null;

    collect(current?.documents ?? [], 'current');

    if (currentCompanyOnly) {
      if (profiles.length === 0 && firstError !== undefined) {
        throw firstError;
      }

      return { profiles, spentUsd };
    }

    // The current-company query is the one that identifies the role holder; a
    // past hit only says they worked there, so it is a fallback, not a peer
    if (profiles.length === 0) {
      const past =
        companies.length > 0
          ? await searchSafely({
              and: [byName, atCompany('past_company_names')],
            })
          : null;

      collect(past?.documents ?? [], 'past');
    }

    if (profiles.length === 0) {
      const nameOnly = await searchSafely(byName);
      const count = nameOnly?.matched ?? 0;

      for (const document of nameOnly?.documents ?? []) {
        const profile = this.toProfile(document, name, count, 'unknown');

        if (profile !== null) {
          profiles.push(profile);
        }
      }
    }

    if (profiles.length === 0 && firstError !== undefined) {
      throw firstError;
    }

    return { profiles, spentUsd };
  }

  private toProfile(
    document: Parameters<typeof mapBrightDataPersonToSearchItem>[0],
    name: string,
    sameNameProfileCount: number | null,
    companyRelation: ResolvedLinkedinProfile['companyRelation'],
  ): ResolvedLinkedinProfile | null {
    const item = mapBrightDataPersonToSearchItem(document);
    const documentName = typeof item.name === 'string' ? item.name : '';
    const linkedinUrl = typeof item.url === 'string' ? item.url : '';

    if (
      !isNonEmptyString(linkedinUrl) ||
      !personNamesMatch(documentName, name)
    ) {
      return null;
    }

    const title = typeof item.title === 'string' ? item.title : '';
    const companyName =
      typeof item.companyName === 'string' ? item.companyName : '';

    return {
      linkedinUrl,
      title,
      companyName,
      evidence: [title, companyName].filter(isNonEmptyString).join(' at '),
      via: 'bright_data',
      sameNameProfileCount,
      companyRelation,
      derivedFromPost: false,
    };
  }

  // The plain query and the same with "linkedin" run together, not one after
  // the other: a failed query used to cost the second its turn, a minute later.
  // A caller paying per lookup asks them in turn and stops at the first hit.
  // Quoted and site: forms returned the wrong results ("Binita Shah" "99
  // Pancakes" gave eight results and not her). The company is the shortest name
  // it goes by: "Hardcastle Restaurants" finds people the full legal name does not.
  // The title is the disambiguator for a common name ("Suresh N").
  private async resolveViaGoogle(
    name: string,
    companies: string[],
    title?: string,
    { stopAtFirstMatch = false }: { stopAtFirstMatch?: boolean } = {},
  ): Promise<{ profiles: ResolvedLinkedinProfile[]; errors: string[] }> {
    const company = companies.length > 0 ? shortest(companies) : '';
    const errors: string[] = [];
    const deadline = new AbortController();
    const deadlineTimer = setTimeout(
      () => deadline.abort(),
      NAME_LOOKUP_DEADLINE_MS,
    );
    const role = title?.trim() ?? '';
    const queries = [
      `${name} ${company}`.trim(),
      `${name} ${company} linkedin`.trim(),
      role !== '' ? `${name} ${company} ${role}`.trim() : '',
    ].filter((query) => query !== '');
    const ask = async (query: string) => {
      try {
        return await this.googleSearchService.request(query, {
          retries: NAME_LOOKUP_SERP_RETRIES,
          signal: deadline.signal,
        });
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));

        return null;
      }
    };
    const byUrl = new Map<string, ResolvedLinkedinProfile>();
    const collect = (serp: Awaited<ReturnType<typeof ask>>) => {
      for (const item of mapGoogleSerpOrganicResults(serp?.organic, 10)) {
        for (const profile of this.googleItemToProfile(item, name)) {
          byUrl.set(
            normalizeLinkedinProfileUrl(profile.linkedinUrl),
            byUrl.get(normalizeLinkedinProfileUrl(profile.linkedinUrl)) ??
              profile,
          );
        }
      }
    };
    const uniqueQueries = [...new Set(queries)].slice(0, 3);

    try {
      if (stopAtFirstMatch) {
        // One query at a time, stopping at the first that names the person: a
        // found profile used to still cost the other two phrasings
        for (const query of uniqueQueries) {
          collect(await ask(query));

          if (byUrl.size > 0 || deadline.signal.aborted) {
            break;
          }
        }
      } else {
        (await Promise.all(uniqueQueries.map(ask))).forEach(collect);
      }
    } finally {
      clearTimeout(deadlineTimer);
    }

    return {
      profiles: [...byUrl.values()],
      errors: byUrl.size === 0 ? [...new Set(errors)] : [],
    };
  }

  private googleItemToProfile(
    item: GoogleSerpOrganicItem,
    name: string,
  ): ResolvedLinkedinProfile[] {
    const person = parseLinkedinSerpResult(item);
    const evidence = `${item.title} ${item.snippet ?? ''}`.trim();

    if (person !== null) {
      return personNamesMatch(person.name, name)
        ? [
            {
              linkedinUrl: person.linkedinUrl,
              title: person.title,
              companyName: person.companyName,
              evidence,
              via: 'google',
              sameNameProfileCount: null,
              // Google names the company but not whether the role is current
              companyRelation: 'unknown',
              derivedFromPost: false,
            },
          ]
        : [];
    }

    // Only a post by them: the author's id has to read as the name
    const derivedUrl = linkedinProfileUrlFromPostUrl(item.url);

    return derivedUrl !== null &&
      personNamesMatch(derivedUrl.split('/in/')[1].replace(/-/g, ' '), name)
      ? [
          {
            linkedinUrl: derivedUrl,
            title: '',
            companyName: '',
            evidence,
            via: 'google',
            sameNameProfileCount: null,
            companyRelation: 'unknown',
            derivedFromPost: true,
          },
        ]
      : [];
  }
}
