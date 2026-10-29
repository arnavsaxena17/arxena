import { Injectable } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import { type BrightDataSerpGoogleJson } from 'src/engine/core-modules/bright-data/types/bright-data-serp.types';
import { BrightDataSerpService } from 'src/engine/core-modules/bright-data/services/bright-data-serp.service';
import {
  buildGoogleSerpSearchUrl,
  mapGoogleSerpOrganicResults,
  type GoogleSerpOrganicItem,
} from 'src/engine/core-modules/org-chart/utils/map-google-serp-organic.util';
import {
  isLinkedinProfileUrl,
  normalizeLinkedinProfileUrl,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/parse-linkedin-serp-result.util';

// Bright Data's SERP did not fail more under load (strictly one at a time it
// failed about as often), so the cap only has to stop a runaway
const DEFAULT_SERP_CONCURRENCY = 100;
const SERP_RESULT_LIMIT = 10;
const SERP_MAX_RETRIES = 2;
// A SERP attempt that works answers in 8s at the median and 35s at the 95th
// percentile; one that fails takes 50-60s. So an attempt is cut off at 40s, and
// when one is slow a second is started beside it instead of waiting it out.
const DEFAULT_ATTEMPT_TIMEOUT_MS = 40_000;
const DEFAULT_HEDGE_DELAY_MS = 15_000;
// Past this the company is read with the queries that have answered
const DEFAULT_COMPANY_DEADLINE_MS = 75_000;
// Async jobs are collected, not held open: they take longer, and a backup
// attempt would be a second billable job, so none is started
const ASYNC_ATTEMPT_TIMEOUT_MS = 240_000;
const ASYNC_COMPANY_DEADLINE_MS = 270_000;

const isSerpAsync = (): boolean =>
  process.env.BRIGHT_DATA_SERP_ASYNC === 'true';
const MAX_NATURAL_ROLE_QUERIES = 3;
const MAX_RESULTS = 40;

// People type "MD"; the web writes "managing director"
const ROLE_SEARCH_WORDS: Record<string, string> = {
  md: 'managing director',
};

export type GoogleCompanySearchResult = {
  // Every organic result from every query, one per URL, as Google gave them.
  // Reading them (who, which role, which company) is the extractor's job.
  results: GoogleSerpOrganicItem[];
  errors: string[];
};

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

@Injectable()
export class FindPeopleGoogleSearchService {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(private readonly brightDataSerpService: BrightDataSerpService) {}

  isConfigured(): boolean {
    return this.brightDataSerpService.isConfigured();
  }

  // One Google query, held back when too many are in flight. A slow attempt is
  // not waited out: after a pause a second one starts beside it, a failed one
  // is replaced at once, the first good answer wins and the rest are aborted.
  // At most retries + 1 attempts are started.
  async request(
    query: string,
    options: { retries?: number; signal?: AbortSignal } = {},
  ): Promise<BrightDataSerpGoogleJson> {
    return this.withinConcurrencyLimit(() =>
      this.requestHedged(query, options),
    );
  }

  private requestHedged(
    query: string,
    {
      retries = SERP_MAX_RETRIES,
      signal,
    }: { retries?: number; signal?: AbortSignal },
  ): Promise<BrightDataSerpGoogleJson> {
    const searchUrl = buildGoogleSerpSearchUrl(query, SERP_RESULT_LIMIT);
    const maxAttempts = retries + 1;
    const attemptTimeoutMs = readMilliseconds(
      'FIND_ROLE_SERP_ATTEMPT_TIMEOUT_MS',
      isSerpAsync() ? ASYNC_ATTEMPT_TIMEOUT_MS : DEFAULT_ATTEMPT_TIMEOUT_MS,
    );
    const hedgeDelayMs = readMilliseconds(
      'FIND_ROLE_SERP_HEDGE_DELAY_MS',
      isSerpAsync() ? 0 : DEFAULT_HEDGE_DELAY_MS,
    );

    return new Promise((resolve, reject) => {
      const controllers: AbortController[] = [];
      let started = 0;
      let failed = 0;
      let settled = false;
      let lastError: unknown;
      let hedgeTimer: ReturnType<typeof setTimeout> | undefined;

      const settle = (outcome: () => void) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(hedgeTimer);
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
        clearTimeout(hedgeTimer);

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
                  hedgeTimer = setTimeout(startAttempt, RATE_LIMIT_BACKOFF_MS);
                } else {
                  startAttempt();
                }
              } else if (failed >= started) {
                settle(() => reject(lastError));
              }
            },
          );

        // Nothing back yet: start a backup beside this attempt
        if (started < maxAttempts && hedgeDelayMs > 0) {
          hedgeTimer = setTimeout(startAttempt, hedgeDelayMs);
        }
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
    location,
    domain,
  }: {
    variants: string[];
    titles: string[];
    roles: string[];
    location?: string;
    // The company's own site: its leadership page often names the role
    // holder before LinkedIn does
    domain?: string;
  }): string[] {
    const orGroup = (terms: string[]) =>
      `(${terms.map((term) => `"${term}"`).join(' OR ')})`;
    const locationTerm = isNonEmptyString(location) ? location : null;
    const build = (parts: Array<string | null>) =>
      parts.filter((part): part is string => part !== null).join(' ');
    const linkedin = 'site:linkedin.com/in';
    const naturalQueries = roles
      .slice(0, MAX_NATURAL_ROLE_QUERIES)
      .map((role) =>
        build([
          variants[0],
          ROLE_SEARCH_WORDS[role.trim().toLowerCase()] ?? role,
        ]),
      );
    const queries = [
      ...naturalQueries,
      build([linkedin, `"${variants[0]}"`, orGroup(titles), locationTerm]),
      build([linkedin, `"${variants[0]}"`, orGroup(roles)]),
    ];

    if (variants.length > 1) {
      queries.push(
        build([linkedin, `"${variants[1]}"`, orGroup(titles), locationTerm]),
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

    return [...new Set(queries)];
  }

  async searchCompany(input: {
    variants: string[];
    titles: string[];
    roles: string[];
    location?: string;
    domain?: string;
  }): Promise<GoogleCompanySearchResult> {
    if (!this.isConfigured()) {
      throw new Error('BRIGHT_DATA_API_KEY is not set');
    }

    const errors: string[] = [];
    const queries = this.buildCompanyQueries(input);
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
    const responses = await Promise.all(
      queries.map((query) =>
        this.request(query, { signal: deadline.signal }).catch((error) => {
          if (deadline.signal.aborted) {
            unanswered += 1;
          } else {
            errors.push(error instanceof Error ? error.message : String(error));
          }

          return null;
        }),
      ),
    ).finally(() => clearTimeout(deadlineTimer));

    if (unanswered > 0) {
      errors.push(
        `${unanswered} of ${queries.length} Google queries had not answered when the deadline passed`,
      );
    }
    const byUrl = new Map<string, GoogleSerpOrganicItem>();

    for (const serp of responses) {
      for (const item of mapGoogleSerpOrganicResults(
        serp?.organic,
        SERP_RESULT_LIMIT,
      )) {
        // The same profile comes back in different forms of its URL
        const key = isLinkedinProfileUrl(item.url)
          ? normalizeLinkedinProfileUrl(item.url)
          : item.url;

        if (!byUrl.has(key)) {
          byUrl.set(key, item);
        }
      }
    }

    return {
      results: [...byUrl.values()].slice(0, MAX_RESULTS),
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
