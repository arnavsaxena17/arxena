import { Injectable } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import { BRIGHT_DATA_COST_PER_RECORD_USD } from 'src/engine/core-modules/bright-data/ludicrous/constants/bright-data-ludicrous-pricing.const';
import { BrightDataBusinessSearchService } from 'src/engine/core-modules/bright-data/services/bright-data-business-search.service';
import { mapBrightDataPersonToSearchItem } from 'src/engine/core-modules/bright-data/utils/bright-data-business-search.util';
import {
  type GoogleSerpOrganicItem,
  mapGoogleSerpOrganicResults,
} from 'src/engine/core-modules/org-chart/utils/map-google-serp-organic.util';
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
    googleOnlyWhenBrightDataMisses = false,
    skipBrightData = false,
  }: {
    name: string;
    // Every name the person's company goes by or is linked to, best first: the
    // employer their own results state, then the target and its alternates
    companyNames: string[];
    // Ask Google only when the Bright Data name and company query found nobody:
    // slower and flakier than Bright Data, so callers on a budget skip it
    googleOnlyWhenBrightDataMisses?: boolean;
    // Bright Data is known to be unreachable: go straight to Google
    skipBrightData?: boolean;
  }): Promise<{
    profiles: ResolvedLinkedinProfile[];
    spentUsd: number;
    // Why a lookup could not run, so a miss is not mistaken for "no profile"
    errors: string[];
  }> {
    const companies = [
      ...new Set(companyNames.map((company) => company.trim())),
    ]
      .filter(isNonEmptyString)
      .slice(0, MAX_COMPANY_NAMES);
    const errors: string[] = [];
    const lookUpBrightData = () =>
      (skipBrightData
        ? Promise.resolve({
            profiles: [] as ResolvedLinkedinProfile[],
            spentUsd: 0,
          })
        : this.resolveViaBrightData(name, companies)
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
        : await this.resolveViaGoogle(name, companies);
    } else {
      [fromBrightData, fromGoogle] = await Promise.all([
        lookUpBrightData(),
        this.resolveViaGoogle(name, companies),
      ]);
    }

    errors.push(
      ...fromGoogle.errors.map((error) => `${name}: google ${error}`),
    );

    const byUrl = new Map<string, ResolvedLinkedinProfile>();

    // Bright Data profiles that came from a name and company query first, then
    // what Google showed, then the Bright Data profiles found by name alone
    for (const profile of [
      ...fromBrightData.profiles.filter(
        (candidate) => candidate.sameNameProfileCount === null,
      ),
      ...fromGoogle.profiles,
      ...fromBrightData.profiles.filter(
        (candidate) => candidate.sameNameProfileCount !== null,
      ),
    ]) {
      const key = normalizeLinkedinProfileUrl(profile.linkedinUrl);
      const existing = byUrl.get(key);

      if (existing === undefined) {
        byUrl.set(key, profile);
      } else if (
        existing.sameNameProfileCount === null &&
        profile.sameNameProfileCount !== null
      ) {
        // The same person seen by name alone: keep what Bright Data knows
        byUrl.set(key, {
          ...existing,
          sameNameProfileCount: profile.sameNameProfileCount,
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

  // Name and company first, one query per company name. Bright Data matches
  // every word against the record, so a profile with no company filled in is
  // never found that way (Smita Jatia + Westlife returns nothing, her name alone
  // returns her), hence the name-only query when those find nobody.
  private async resolveViaBrightData(
    name: string,
    companies: string[],
  ): Promise<{ profiles: ResolvedLinkedinProfile[]; spentUsd: number }> {
    let spentUsd = 0;
    const profiles: ResolvedLinkedinProfile[] = [];
    const search = async (query: string) => {
      const result = await this.brightDataBusinessSearchService.search({
        entity: 'people',
        mode: 'instant',
        query: query.slice(0, 200),
        limit: BRIGHT_DATA_NAME_LOOKUP_LIMIT,
      });

      spentUsd += result.documents.length * BRIGHT_DATA_COST_PER_RECORD_USD;

      return result;
    };

    const withCompany = await Promise.all(
      companies.map(async (company) => ({
        company,
        result: await search(`${name} ${company}`).catch(() => null),
      })),
    );

    for (const { result } of withCompany) {
      for (const document of result?.documents ?? []) {
        const profile = this.toProfile(document, name, null);

        if (profile !== null) {
          profiles.push(profile);
        }
      }
    }

    if (profiles.length === 0) {
      const byName = await search(name);

      for (const document of byName.documents) {
        const profile = this.toProfile(document, name, byName.matched);

        if (profile !== null) {
          profiles.push(profile);
        }
      }
    }

    return { profiles, spentUsd };
  }

  private toProfile(
    document: Parameters<typeof mapBrightDataPersonToSearchItem>[0],
    name: string,
    sameNameProfileCount: number | null,
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
      derivedFromPost: false,
    };
  }

  // The plain query and the same with "linkedin" run together, not one after
  // the other: a failed query used to cost the second its turn, a minute later.
  // Quoted and site: forms returned the wrong results ("Binita Shah" "99
  // Pancakes" gave eight results and not her). The company is the shortest name
  // it goes by: "Hardcastle Restaurants" finds people the full legal name does not.
  private async resolveViaGoogle(
    name: string,
    companies: string[],
  ): Promise<{ profiles: ResolvedLinkedinProfile[]; errors: string[] }> {
    const company = companies.length > 0 ? shortest(companies) : '';
    const errors: string[] = [];
    const deadline = new AbortController();
    const deadlineTimer = setTimeout(
      () => deadline.abort(),
      NAME_LOOKUP_DEADLINE_MS,
    );
    const answers = await Promise.all(
      [`${name} ${company}`.trim(), `${name} ${company} linkedin`.trim()].map(
        async (query) => {
          try {
            return await this.googleSearchService.request(query, {
              retries: NAME_LOOKUP_SERP_RETRIES,
              signal: deadline.signal,
            });
          } catch (error) {
            errors.push(error instanceof Error ? error.message : String(error));

            return null;
          }
        },
      ),
    ).finally(() => clearTimeout(deadlineTimer));
    const byUrl = new Map<string, ResolvedLinkedinProfile>();

    for (const serp of answers) {
      for (const item of mapGoogleSerpOrganicResults(serp?.organic, 10)) {
        for (const profile of this.googleItemToProfile(item, name)) {
          byUrl.set(
            normalizeLinkedinProfileUrl(profile.linkedinUrl),
            byUrl.get(normalizeLinkedinProfileUrl(profile.linkedinUrl)) ??
              profile,
          );
        }
      }
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
            derivedFromPost: true,
          },
        ]
      : [];
  }
}
