import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import { extractAiOverviewText } from 'src/engine/core-modules/arx-web-search/utils/extract-serp-evidence.util';
import { type BrightDataSerpGoogleJson } from 'src/engine/core-modules/bright-data/types/bright-data-serp.types';
import { BrightDataSerpService } from 'src/engine/core-modules/bright-data/services/bright-data-serp.service';
import { toSearchTerms } from 'src/engine/core-modules/title-taxonomy/role-mention-split.util';
import { companyBrandKey } from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/company-name-variants.util';
import {
  buildGoogleSerpSearchUrl,
  mapGoogleSerpOrganicResults,
  type GoogleSerpOrganicItem,
} from 'src/engine/core-modules/org-chart/utils/map-google-serp-organic.util';
import {
  isGoogleTitleClauseUsable,
  toGoogleTitleClause,
} from 'src/engine/core-modules/title-taxonomy/title-boolean.util';
import {
  isLinkedinProfileUrl,
  normalizeLinkedinProfileUrl,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/parse-linkedin-serp-result.util';

// Bright Data's SERP did not fail more under load (strictly one at a time it
// failed about as often), so the cap only has to stop a runaway
const DEFAULT_SERP_CONCURRENCY = 100;
const SERP_RESULT_LIMIT = 20;
const SERP_MAX_RETRIES = 2;
// A SERP attempt that works answers in 8s at the median and 35s at the 95th
// percentile; one that fails takes 50-60s. So an attempt is cut off at 40s.
const DEFAULT_ATTEMPT_TIMEOUT_MS = 40_000;
// Past this the company is read with the queries that have answered
const DEFAULT_COMPANY_DEADLINE_MS = 75_000;
// Async jobs are collected, not held open: they take longer than a held request
const ASYNC_ATTEMPT_TIMEOUT_MS = 240_000;
const ASYNC_COMPANY_DEADLINE_MS = 270_000;

const isSerpAsync = (): boolean =>
  process.env.BRIGHT_DATA_SERP_ASYNC === 'true';
// One natural query per role, so a four-role company asks about each role
// instead of dropping the fourth. The whole company is still bounded below.
const MAX_ROLE_QUERIES = 8;
const MAX_SERP_QUERIES_PER_COMPANY = 12;
const MAX_RESULTS = 40;
// The agent is trusted to name a few queries, not to fan out: six a company
const DIRECT_QUERY_LIMIT = 6;

// People type "MD"; the web writes "managing director"
const ROLE_SEARCH_WORDS: Record<string, string> = {
  md: 'managing director',
};

// The Google market for a location the caller named. Without one the egress
// country decides the answer, and Bright Data spreads requests worldwide.
const SERP_COUNTRY_BY_LOCATION: Record<string, string> = {
  india: 'in',
  'united arab emirates': 'ae',
  uae: 'ae',
  dubai: 'ae',
  'united states': 'us',
  'united states of america': 'us',
  usa: 'us',
  'united kingdom': 'gb',
  uk: 'gb',
  singapore: 'sg',
  australia: 'au',
  canada: 'ca',
  germany: 'de',
  france: 'fr',
  netherlands: 'nl',
  brazil: 'br',
};

const isAiOverviewEnabled = (): boolean => {
  const value = process.env.FIND_ROLE_AI_OVERVIEW?.trim().toLowerCase();

  return value === 'true' || value === '1' || value === 'yes';
};

// The market a search runs in when the request names no place Google knows.
// Without gl the proxy's exit country decides, and on 31 Oct about 60% of the
// cached answers came from Vietnam, Brazil and the like. "none" leaves it open.
const DEFAULT_SERP_COUNTRY = 'in';

const defaultSerpCountry = (): string | undefined => {
  const configured =
    process.env.FIND_ROLE_SERP_DEFAULT_COUNTRY?.trim().toLowerCase();

  if (configured === 'none') {
    return undefined;
  }

  return isNonEmptyString(configured) ? configured : DEFAULT_SERP_COUNTRY;
};

// An explicit env wins, so a run can be pinned to one market; otherwise the
// place the request named ("Mumbai, India" counts as India), then the default
export const resolveSerpCountry = (location?: string): string | undefined => {
  const configured = process.env.FIND_ROLE_SERP_COUNTRY?.trim().toLowerCase();

  if (isNonEmptyString(configured)) {
    return configured;
  }

  if (!isNonEmptyString(location)) {
    return defaultSerpCountry();
  }

  const lowered = location.trim().toLowerCase();
  const named =
    SERP_COUNTRY_BY_LOCATION[lowered] ??
    Object.entries(SERP_COUNTRY_BY_LOCATION).find(([place]) =>
      new RegExp(`(^|[^a-z])${place}($|[^a-z])`).test(lowered),
    )?.[1];

  return named ?? defaultSerpCountry();
};

export type GoogleCompanySearchResult = {
  // Every organic result from every query, one per URL, as Google gave them.
  // Reading them (who, which role, which company) is the extractor's job.
  results: GoogleSerpOrganicItem[];
  // Google's own summary text, when a query returned one. Organic results do
  // not carry it, and it often names the role holder before LinkedIn ranks them
  aiOverviewTexts: string[];
  errors: string[];
};

// The AI Overview zone is a separate Bright Data product with its own proxy
// password; the API route is the one that works for it here.
const DEFAULT_AI_OVERVIEW_ZONE = 'serp_ai_overview';
// A miss is an empty page (or a bare "this query recently failed" body), and
// roughly three fetches in five miss, so one attempt is a coin flip
const AI_OVERVIEW_ATTEMPTS = 3;
const AI_OVERVIEW_QUERY_LIMIT = 3;
const AI_OVERVIEW_REQUEST_TIMEOUT_MS = 35_000;
// Bright Data refuses a query that has just missed for at least 15s, so an
// instant second attempt is spent collecting the same refusal and looks like a
// second miss. Waiting the documented cooldown is what turns attempt 2 and 3
// into real chances to get the overview.
const AI_OVERVIEW_RETRY_DELAY_MS = 16_000;
// Past this the company is read with the base results; the overview can land
// late without holding the whole lookup. Three attempts with their waits fit.
const AI_OVERVIEW_DEADLINE_MS = 85_000;
// The overview is an enrichment, not the search: the organic results are
// already in when it starts. A miss costs the zone's retries and cooldowns, so
// it gets a budget of its own and is then left behind instead of holding the
// company for the whole 85s deadline.
const AI_OVERVIEW_BLOCKING_BUDGET_MS = 20_000;

// The cooldown is read per call so a test can shorten it; production keeps the
// documented 15s
const getAiOverviewRetryDelayMs = (): number =>
  readMilliseconds(
    'FIND_ROLE_AI_OVERVIEW_RETRY_MS',
    AI_OVERVIEW_RETRY_DELAY_MS,
  );

const getSerpConcurrency = (): number => {
  const configured = Number(process.env.FIND_ROLE_SERP_CONCURRENCY);

  return Number.isInteger(configured) && configured > 0
    ? configured
    : DEFAULT_SERP_CONCURRENCY;
};

const readMilliseconds = (name: string, fallback: number): number => {
  const configured = Number(process.env[name]);

  return Number.isFinite(configured) && configured >= 0 ? configured : fallback;
};

// Many companies hit the SERP at once, so a rate limit or a server blip is
// retried with a short backoff instead of turning into a false no_match
const isRetryableSerpError = (error: unknown): boolean =>
  error instanceof Error &&
  /HTTP (429|5\d\d)\b|non-JSON reply|aborted|fetch failed|timed out/i.test(
    error.message,
  );

// Bright Data throttles by request rate ("decrease your request rate to
// 174/min") and says to wait 15 s before retrying a recently failed query. One
// limit for the whole process, so parallel tool calls share it.
// The documented limit is 1,000/min unfunded (higher when funded); stay at
// 600 and let a 429 slow every caller down, not just the one that got it
const DEFAULT_REQUESTS_PER_MINUTE = 600;
const RATE_LIMIT_BACKOFF_MS = 16_000;
let nextRequestSlotAt = 0;

const acquireRequestSlot = async (): Promise<void> => {
  const perMinute = readMilliseconds(
    'FIND_ROLE_SERP_REQUESTS_PER_MINUTE',
    DEFAULT_REQUESTS_PER_MINUTE,
  );

  if (perMinute <= 0) {
    return;
  }

  const now = Date.now();
  const slotAt = Math.max(now, nextRequestSlotAt);

  nextRequestSlotAt = slotAt + 60_000 / perMinute;

  if (slotAt > now) {
    await new Promise((resolve) => setTimeout(resolve, slotAt - now));
  }
};

const pauseRequestSlots = (milliseconds: number): void => {
  nextRequestSlotAt = Math.max(nextRequestSlotAt, Date.now() + milliseconds);
};

// Waits out a provider cooldown, but gives up as soon as the caller's deadline
// aborts instead of sleeping through it. True means the wait completed.
const waitUnlessAborted = (
  milliseconds: number,
  signal: AbortSignal,
): Promise<boolean> =>
  new Promise((resolve) => {
    if (signal.aborted) {
      resolve(false);

      return;
    }

    const onAbort = () => {
      clearTimeout(timer);
      resolve(false);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve(true);
    }, milliseconds);

    signal.addEventListener('abort', onAbort, { once: true });
  });

@Injectable()
export class FindPeopleGoogleSearchService {
  private readonly logger = new Logger(FindPeopleGoogleSearchService.name);
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(private readonly brightDataSerpService: BrightDataSerpService) {}

  isConfigured(): boolean {
    return this.brightDataSerpService.isConfigured();
  }

  // One Google query, held back when too many are in flight. A failed attempt
  // is replaced after the provider's cooldown, the first good answer wins, and
  // at most retries + 1 attempts are started. No backup is started beside a
  // slow attempt: `BrightDataSerpService` sends one request per query and makes
  // every concurrent caller share it, so a second attempt here would only wait
  // on the first one's promise while paying for a second request.
  async request(
    query: string,
    options: {
      retries?: number;
      signal?: AbortSignal;
      country?: string;
    } = {},
  ): Promise<BrightDataSerpGoogleJson> {
    return this.withinConcurrencyLimit(() =>
      this.requestWithRetries(query, options),
    );
  }

  private requestWithRetries(
    query: string,
    {
      retries = SERP_MAX_RETRIES,
      signal,
      country,
    }: {
      retries?: number;
      signal?: AbortSignal;
      country?: string;
    },
  ): Promise<BrightDataSerpGoogleJson> {
    // A caller that names no market (the name lookups) still gets one
    const searchUrl = buildGoogleSerpSearchUrl(query, SERP_RESULT_LIMIT, {
      country: country ?? resolveSerpCountry(),
    });
    const maxAttempts = retries + 1;
    const attemptTimeoutMs = readMilliseconds(
      'FIND_ROLE_SERP_ATTEMPT_TIMEOUT_MS',
      isSerpAsync() ? ASYNC_ATTEMPT_TIMEOUT_MS : DEFAULT_ATTEMPT_TIMEOUT_MS,
    );

    return new Promise((resolve, reject) => {
      const controllers: AbortController[] = [];
      let started = 0;
      let failed = 0;
      let settled = false;
      let lastError: unknown;
      let retryTimer: ReturnType<typeof setTimeout> | undefined;

      const settle = (outcome: () => void) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(retryTimer);
        signal?.removeEventListener('abort', onCallerAbort);
        controllers.forEach((controller) => controller.abort());
        outcome();
      };
      const onCallerAbort = () =>
        settle(() => reject(new Error('Google search aborted')));
      const startAttempt = () => {
        if (settled || started >= maxAttempts) {
          return;
        }

        started += 1;
        clearTimeout(retryTimer);

        const controller = new AbortController();

        controllers.push(controller);
        acquireRequestSlot()
          .then(() => {
            if (settled || controller.signal.aborted) {
              throw new Error('Google search aborted');
            }

            return this.brightDataSerpService.requestSerpGoogleJson(searchUrl, {
              signal: controller.signal,
              timeoutMs: attemptTimeoutMs,
              dataFormat: 'parsed_light',
            });
          })
          .then(
            (serp) => settle(() => resolve(serp)),
            (error) => {
              if (settled) {
                return;
              }

              lastError = error;
              failed += 1;

              if (!isRetryableSerpError(error)) {
                settle(() => reject(error));
              } else if (started < maxAttempts) {
                if (/HTTP 429\b/.test(String((error as Error).message))) {
                  pauseRequestSlots(RATE_LIMIT_BACKOFF_MS);
                  retryTimer = setTimeout(startAttempt, RATE_LIMIT_BACKOFF_MS);
                } else {
                  startAttempt();
                }
              } else if (failed >= started) {
                settle(() => reject(lastError));
              }
            },
          );
      };

      if (signal?.aborted === true) {
        onCallerAbort();

        return;
      }

      signal?.addEventListener('abort', onCallerAbort, { once: true });
      startAttempt();
    });
  }

  // One phrasing is fragile (Google answers some title lists with nothing), so
  // each company gets several: the plain "<company> <role>" a person would
  // type, LinkedIn-only queries with the taxonomy titles and with the roles
  // as typed, and the taxonomy titles for the second company name
  buildCompanyQueries({
    variants,
    titles,
    roles,
    titleExpressions,
    location,
    domain,
    families,
  }: {
    variants: string[];
    titles: string[];
    roles: string[];
    // Curated function x grade boolean queries from the title taxonomy, one
    // per role class. Google gets them with AND removed, so "VP
    // Manufacturing" is found for "Head of Manufacturing".
    titleExpressions?: string[];
    location?: string;
    // The company's own site: its leadership page often names the role
    // holder before LinkedIn does
    domain?: string;
    // Per role family queries built by the caller, one plain and one boolean
    // each. When present they replace the company-wide groups, so a second
    // role gets its own query instead of sharing one blended query set.
    families?: Array<{ key: string; plain: string; boolean: string }>;
  }): string[] {
    const orGroup = (terms: string[]) =>
      `(${terms.map((term) => `"${term}"`).join(' OR ')})`;
    // Never the user's text as typed: a slash or quote inside a quoted OR term
    // makes Google return nothing
    const roleTerms = toSearchTerms(roles);
    const titleTerms = toSearchTerms(titles);
    const locationTerm = isNonEmptyString(location) ? location : null;
    const build = (parts: Array<string | null>) =>
      parts.filter((part): part is string => part !== null).join(' ');
    const linkedin = 'site:linkedin.com/in';
    const familyQueries = (families ?? []).flatMap((family) => [
      family.plain,
      family.boolean,
    ]);
    const naturalQueries = roleTerms
      .slice(0, MAX_ROLE_QUERIES)
      .map((role) =>
        build([
          variants[0],
          ROLE_SEARCH_WORDS[role.trim().toLowerCase()] ?? role,
        ]),
      );
    const booleanQueries = (titleExpressions ?? [])
      .slice(0, MAX_ROLE_QUERIES)
      .map((expression) => toGoogleTitleClause(expression))
      .filter(isGoogleTitleClauseUsable)
      .map((clause) =>
        build([linkedin, `"${variants[0]}"`, `(${clause})`, locationTerm]),
      );
    // Each query has its own job. The roles-as-typed group only runs when the
    // title list left a role out, and a second company name only when it is a
    // different brand, not the same one with "Ltd." dropped.
    const titleKeys = new Set(titleTerms.map((term) => term.toLowerCase()));
    const rolesCovered = roleTerms.every((term) =>
      titleKeys.has(term.toLowerCase()),
    );
    // Family queries already carry the company, the clause and the place, so
    // the company-wide groups would only duplicate them
    const queries =
      familyQueries.length > 0
        ? familyQueries
        : [
            ...naturalQueries,
            ...booleanQueries,
            build([linkedin, `"${variants[0]}"`, orGroup(titleTerms), locationTerm]),
            rolesCovered
              ? null
              : build([linkedin, `"${variants[0]}"`, orGroup(roleTerms)]),
          ].filter((query): query is string => query !== null);

    if (
      variants.length > 1 &&
      companyBrandKey(variants[1]) !== companyBrandKey(variants[0])
    ) {
      queries.push(
        build([
          linkedin,
          `"${variants[1]}"`,
          orGroup(titleTerms),
          locationTerm,
        ]),
      );
    }

    const host = isNonEmptyString(domain)
      ? domain
          .trim()
          .replace(/^https?:\/\//i, '')
          .replace(/^www\./i, '')
          .split('/')[0]
      : '';

    if (host.length > 0) {
      queries.push(
        build([`site:${host}`, '(leadership OR team OR management)']),
      );
    }

    // A company's SERP spend is bounded even when it names many roles
    return [...new Set(queries)].slice(0, MAX_SERP_QUERIES_PER_COMPANY);
  }

  // Google only writes an overview for a question, not for the keyword form
  // the base search uses: "Head of Procurement Acme" returned no overview in
  // live probes (Oct 2026) while "Who is Acme's Head of Procurement" named the
  // holder. So the pass asks a question.
  private buildAiOverviewQueries({
    company,
    roles,
  }: {
    company: string;
    roles: string[];
  }): string[] {
    const designationFor = (role: string): string => {
      if (/procurement/i.test(role)) {
        return 'Head of Procurement';
      }

      if (/purchase|purchasing/i.test(role)) {
        return 'Purchase Head';
      }

      if (/supply chain|logistics|scm/i.test(role)) {
        return 'Supply Chain Head';
      }

      return role.trim();
    };
    const designations = [
      ...new Set(roles.map((role) => designationFor(role).trim())),
    ].filter((designation) => designation !== '');
    const possessive = designations.map(
      (designation) => `Who is ${company}'s ${designation}`,
    );
    // One question per designation: the second "at <company>" phrasing came
    // back with no overview in most runs (26 of 36 on 31 Oct) and doubled the
    // cost of every miss
    return [...new Set(possessive)].slice(0, AI_OVERVIEW_QUERY_LIMIT);
  }

  private async requestAiOverview(
    query: string,
    {
      country,
      signal,
    }: {
      country?: string;
      signal: AbortSignal;
    },
  ): Promise<BrightDataSerpGoogleJson | null> {
    const zone =
      process.env.BRIGHT_DATA_SERP_AI_OVERVIEW_ZONE?.trim() ||
      DEFAULT_AI_OVERVIEW_ZONE;
    const searchUrl = buildGoogleSerpSearchUrl(query, SERP_RESULT_LIMIT, {
      aiOverview: true,
      brdJson: true,
      country,
    });
    let fallback: BrightDataSerpGoogleJson | null = null;

    for (let attempt = 1; attempt <= AI_OVERVIEW_ATTEMPTS; attempt++) {
      try {
        const serp =
          await this.brightDataSerpService.requestSerpGoogleJsonInZone(
            searchUrl,
            zone,
            { signal, timeoutMs: AI_OVERVIEW_REQUEST_TIMEOUT_MS },
          );

        if (extractAiOverviewText(serp) !== null) {
          return serp;
        }

        fallback = fallback ?? serp;
      } catch {
        if (signal.aborted) {
          return fallback;
        }
      }

      // The next attempt is only worth making once Bright Data's cooldown for
      // this query has passed; the deadline still cuts the wait short
      if (
        attempt < AI_OVERVIEW_ATTEMPTS &&
        !(await waitUnlessAborted(getAiOverviewRetryDelayMs(), signal))
      ) {
        break;
      }
    }

    return fallback;
  }

  // The overview is a supplementary pass: it runs beside the normal queries and
  // never fails the company. A miss (empty page) is retried once.
  private async fetchAiOverview({
    variants,
    roles,
    location,
  }: {
    variants: string[];
    roles: string[];
    location?: string;
  }): Promise<{
    texts: string[];
    results: GoogleSerpOrganicItem[];
  }> {
    if (!isAiOverviewEnabled()) {
      return { texts: [], results: [] };
    }

    const deadline = new AbortController();
    const timer = setTimeout(() => deadline.abort(), AI_OVERVIEW_DEADLINE_MS);
    const queries = this.buildAiOverviewQueries({
      company: variants[0],
      roles,
    });
    const responses = await Promise.all(
      queries.map((query) =>
        this.requestAiOverview(query, {
          country: resolveSerpCountry(location),
          signal: deadline.signal,
        }),
      ),
    ).finally(() => clearTimeout(timer));
    const texts: string[] = [];
    const results: GoogleSerpOrganicItem[] = [];

    for (const serp of responses) {
      if (serp === null) {
        continue;
      }

      const text = extractAiOverviewText(serp);

      if (text !== null && !texts.includes(text)) {
        texts.push(text);
      }

      results.push(
        ...mapGoogleSerpOrganicResults(serp.organic, SERP_RESULT_LIMIT),
      );
    }

    if (texts.length === 0) {
      this.logger.warn(
        `AI Overview zone returned none for "${variants[0]}" after ${queries.length} queries x ${AI_OVERVIEW_ATTEMPTS} attempts`,
      );
    } else {
      // The overview names people the organic list does not, so a hit is worth
      // seeing in the run log next to the miss
      this.logger.log(
        `AI Overview for "${variants[0]}": ${texts.length} overview(s), ${results.length} extra result(s)`,
      );
    }

    return { texts, results };
  }

  // Queries the agent wrote, sent as written. They skip the generator because
  // the agent knows something it does not (a site restriction, a boolean, a
  // name it already holds); the market and the deadline still apply, so a
  // direct query costs the same as a generated one.
  async searchDirectQueries(
    queries: string[],
    location?: string,
  ): Promise<{ results: GoogleSerpOrganicItem[]; errors: string[] }> {
    const errors: string[] = [];
    const results: GoogleSerpOrganicItem[] = [];
    const country = resolveSerpCountry(location);
    const bounded = [
      ...new Set(
        queries.map((query) => query.trim()).filter((query) => query !== ''),
      ),
    ].slice(0, DIRECT_QUERY_LIMIT);

    const responses = await Promise.all(
      bounded.map((query) =>
        this.request(query, { country })
          .then((serp) =>
            mapGoogleSerpOrganicResults(serp?.organic, SERP_RESULT_LIMIT),
          )
          .catch((error) => {
            errors.push(
              `${query.slice(0, 60)}: ${error instanceof Error ? error.message : String(error)}`,
            );

            return [] as GoogleSerpOrganicItem[];
          }),
      ),
    );

    for (const items of responses) {
      results.push(...items);
    }

    return { results, errors };
  }

  async searchCompany(input: {
    variants: string[];
    titles: string[];
    roles: string[];
    titleExpressions?: string[];
    location?: string;
    domain?: string;
    // One plain and one boolean query per role family
    families?: Array<{ key: string; plain: string; boolean: string }>;
  }): Promise<GoogleCompanySearchResult> {
    if (!this.isConfigured()) {
      throw new Error('BRIGHT_DATA_API_KEY is not set');
    }

    const errors: string[] = [];
    const queries = this.buildCompanyQueries(input);
    const country = resolveSerpCountry(input.location);
    // One stuck query must not hold the company: past the deadline it is read
    // with the queries that have answered, and the rest are cut off
    const deadline = new AbortController();
    const deadlineTimer = setTimeout(
      () => deadline.abort(),
      readMilliseconds(
        'FIND_ROLE_COMPANY_DEADLINE_MS',
        isSerpAsync() ? ASYNC_COMPANY_DEADLINE_MS : DEFAULT_COMPANY_DEADLINE_MS,
      ),
    );
    let unanswered = 0;
    // Enrichment, not the search: bounded so a missing overview cannot hold
    // the company that the organic queries have already answered
    const overview = Promise.race([
      this.fetchAiOverview(input),
      new Promise<{ texts: string[]; results: GoogleSerpOrganicItem[] }>(
        (resolve) => {
          const timer = setTimeout(
            () => resolve({ texts: [], results: [] }),
            readMilliseconds(
              'FIND_ROLE_AI_OVERVIEW_BUDGET_MS',
              AI_OVERVIEW_BLOCKING_BUDGET_MS,
            ),
          );

          timer.unref?.();
        },
      ),
    ]);
    const [responses, overviewResult] = await Promise.all([
      Promise.all(
        queries.map((query) =>
          this.request(query, {
            signal: deadline.signal,
            country,
          }).catch((error) => {
            if (deadline.signal.aborted) {
              unanswered += 1;
            } else {
              errors.push(
                error instanceof Error ? error.message : String(error),
              );
            }

            return null;
          }),
        ),
      ).finally(() => clearTimeout(deadlineTimer)),
      overview,
    ]);

    if (unanswered > 0) {
      errors.push(
        `${unanswered} of ${queries.length} Google queries had not answered when the deadline passed`,
      );
    }
    const byUrl = new Map<string, GoogleSerpOrganicItem>();

    for (const item of [
      ...responses.flatMap((serp) =>
        mapGoogleSerpOrganicResults(serp?.organic, SERP_RESULT_LIMIT),
      ),
      ...overviewResult.results,
    ]) {
      // The same profile comes back in different forms of its URL
      const key = isLinkedinProfileUrl(item.url)
        ? normalizeLinkedinProfileUrl(item.url)
        : item.url;

      if (!byUrl.has(key)) {
        byUrl.set(key, item);
      }
    }

    return {
      results: [...byUrl.values()].slice(0, MAX_RESULTS),
      aiOverviewTexts: overviewResult.texts,
      errors: [...new Set(errors)],
    };
  }

  private async withinConcurrencyLimit<TResult>(
    task: () => Promise<TResult>,
  ): Promise<TResult> {
    if (this.active >= getSerpConcurrency()) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }

    this.active += 1;

    try {
      return await task();
    } finally {
      this.active -= 1;
      this.waiting.shift()?.();
    }
  }
}
