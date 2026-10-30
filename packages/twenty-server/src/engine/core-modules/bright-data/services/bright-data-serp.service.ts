import { appendFileSync } from 'fs';
import { lookup } from 'dns/promises';
import { connect } from 'net';

import { Injectable, Logger, Optional } from '@nestjs/common';

import { ProviderQueryCacheService } from 'src/engine/core-modules/cache-storage/services/provider-query-cache.service';
import { RawFetchArchiveService } from 'src/engine/core-modules/raw-fetch-archive/raw-fetch-archive.service';

import { Agent, ProxyAgent } from 'undici';

const BRIGHT_DATA_SERP_CACHE_PREFIX = 'bright-data-serp:v1';

import type {
  BrightDataDatasetSnapshotItem,
  BrightDataDatasetSnapshotListEntry,
  BrightDataDatasetSnapshotProgress,
  BrightDataSerpGoogleJson,
} from 'src/engine/core-modules/bright-data/types/bright-data-serp.types';

const BRIGHT_DATA_REQUEST_URL = 'https://api.brightdata.com/request';
const BRIGHT_DATA_SERP_ASYNC_SUBMIT_URL = 'https://api.brightdata.com/serp/req';
const BRIGHT_DATA_SERP_ASYNC_RESULT_URL =
  'https://api.brightdata.com/serp/get_result';
const BRIGHT_DATA_DATASET_TRIGGER_URL =
  'https://api.brightdata.com/datasets/v3/trigger';
const BRIGHT_DATA_DATASET_SNAPSHOT_URL =
  'https://api.brightdata.com/datasets/v3/snapshot';
const BRIGHT_DATA_DATASET_SNAPSHOTS_URL =
  'https://api.brightdata.com/datasets/v3/snapshots';
const BRIGHT_DATA_DATASET_PROGRESS_URL =
  'https://api.brightdata.com/datasets/v3/progress';

export type BrightDataSerpRequestOptions = {
  // Aborts the request when the caller no longer needs it
  signal?: AbortSignal;
  // Replaces the default request timeout for this call
  timeoutMs?: number;
  // parsed_light returns only the top 10 organic results and answers about
  // twice as fast as the full parse
  dataFormat?: 'parsed' | 'parsed_light';
  // Prefer image URLs over Base64 payloads (Fast SERP news defaults to Base64)
  imgFormat?: 'link';
};

export type BrightDataDatasetScrapeInput = {
  url: string;
  keyword: string;
  language?: string;
  uule?: string;
  brd_mobile?: string;
  tbs?: string;
  nfpr?: string;
  index?: string;
  tbm?: string;
};

// A route that cannot be reached, or whose zone credentials or account are
// refused, is worth another route. An answer from Bright Data itself (a 502 for
// a query Google rejected, a 429 "this query recently failed, wait 15 s") is
// not: the next route would send the same query at once and hit the same lock.
const isRouteFailure = (error: unknown): boolean =>
  error instanceof Error &&
  /HTTP (401|402|403|407)\b|aborted|fetch failed|timed out|ECONN|ENOTFOUND|ETIMEDOUT|socket/i.test(
    error.message,
  );

// The zone refused who we are (bad credentials, no balance, or this machine's
// IP missing from the zone's allowlist). Every query on that route fails the
// same way until the zone settings change, so no retry can help.
const isRouteRefusal = (error: unknown): boolean =>
  error instanceof Error &&
  /HTTP (401|402|403|407)\b|Proxy response \((401|402|403|407)\)|ip_forbidden|client_10030|not whitelisted/i.test(
    error.message,
  );

// A failure that often clears on its own: Google not rendering in time (502
// expect_element), Bright Data throttling (429), or a dropped connection
const isTransientFailure = (error: unknown): boolean =>
  error instanceof Error &&
  !isRouteRefusal(error) &&
  /HTTP (429|5\d\d)\b|ECONNRESET|EPIPE|UND_ERR_SOCKET|UND_ERR_CONNECT_TIMEOUT|other side closed|non-JSON reply/i.test(
    error.message,
  );

// Bright Data: wait at least 15 seconds before sending a failed query again
const QUERY_COOLDOWN_MS = 16_000;

// A refused route is tried last, not first, for this long
const ROUTE_REFUSAL_PENALTY_MS = 5 * 60_000;

// Stop waiting for a shared request when this caller is aborted; the request
// itself carries on for the other callers
const waitForOrAbort = <TValue>(
  promise: Promise<TValue>,
  signal?: AbortSignal,
): Promise<TValue> => {
  if (signal === undefined) {
    return promise;
  }

  return new Promise<TValue>((resolve, reject) => {
    const onAbort = () =>
      reject(new Error('Bright Data SERP request aborted by the caller'));

    if (signal.aborted) {
      onAbort();

      return;
    }

    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
};

@Injectable()
export class BrightDataSerpService {
  private readonly logger = new Logger(BrightDataSerpService.name);

  constructor(
    @Optional()
    private readonly rawFetchArchiveService?: RawFetchArchiveService,
    @Optional()
    private readonly providerQueryCache?: ProviderQueryCacheService,
  ) {}

  private get apiKey(): string | undefined {
    return process.env.BRIGHT_DATA_API_KEY?.trim() || undefined;
  }

  private get zone(): string {
    return process.env.BRIGHT_DATA_SERP_ZONE?.trim() || 'serp_api';
  }

  // Async SERP (POST /serp/req, then poll /serp/get_result): no connection is
  // held open while Google is scraped, which suits hundreds of queries at once
  private get serpAsyncEnabled(): boolean {
    return process.env.BRIGHT_DATA_SERP_ASYNC === 'true';
  }

  // Native proxy access (brd.superproxy.io) to the SERP zone: Google is
  // requested through the proxy with zone credentials, no REST API key. It is
  // used whenever a username and password are configured.
  private get serpProxy():
    | { host: string; port: number; username: string; password: string }
    | undefined {
    const username = process.env.BRIGHT_DATA_SERP_PROXY_USERNAME?.trim();
    const password = process.env.BRIGHT_DATA_SERP_PROXY_PASSWORD?.trim();

    if (!username || !password) {
      return undefined;
    }

    return {
      host:
        process.env.BRIGHT_DATA_SERP_PROXY_HOST?.trim() || 'brd.superproxy.io',
      port: Number(process.env.BRIGHT_DATA_SERP_PROXY_PORT ?? 33335),
      username,
      password,
    };
  }

  // Second superproxy zone (the "serp_api_full_json" zone), tried when the
  // primary route cannot connect or fails. Same host, different credentials.
  private get serpFallbackProxy():
    | { host: string; port: number; username: string; password: string }
    | undefined {
    const username =
      process.env.BRIGHT_DATA_SERP_FALLBACK_PROXY_USERNAME?.trim();
    const password =
      process.env.BRIGHT_DATA_SERP_FALLBACK_PROXY_PASSWORD?.trim();

    if (!username || !password) {
      return undefined;
    }

    return {
      host:
        process.env.BRIGHT_DATA_SERP_FALLBACK_PROXY_HOST?.trim() ||
        process.env.BRIGHT_DATA_SERP_PROXY_HOST?.trim() ||
        'brd.superproxy.io',
      port: Number(
        process.env.BRIGHT_DATA_SERP_FALLBACK_PROXY_PORT ??
          process.env.BRIGHT_DATA_SERP_PROXY_PORT ??
          33335,
      ),
      username,
      password,
    };
  }

  // Fast SERP news proxy. Reuses SERP proxy credentials/host when dedicated
  // FSERP ones are absent (many zones expose Fast SERP on port 44445).
  private get fastSerpProxy():
    | { host: string; port: number; username: string; password: string }
    | undefined {
    const username =
      process.env.BRIGHT_DATA_FSERP_PROXY_USERNAME?.trim() ||
      process.env.BRIGHT_DATA_SERP_PROXY_USERNAME?.trim();
    const password =
      process.env.BRIGHT_DATA_FSERP_PROXY_PASSWORD?.trim() ||
      process.env.BRIGHT_DATA_SERP_PROXY_PASSWORD?.trim();

    if (!username || !password) {
      return undefined;
    }

    return {
      host:
        process.env.BRIGHT_DATA_FSERP_PROXY_HOST?.trim() ||
        process.env.BRIGHT_DATA_SERP_PROXY_HOST?.trim() ||
        'fserp.brd.superproxy.io',
      port: Number(
        process.env.BRIGHT_DATA_FSERP_PROXY_PORT ??
          process.env.BRIGHT_DATA_SERP_PROXY_PORT ??
          44445,
      ),
      username,
      password,
    };
  }

  // Async calls name the account as well as the zone
  private get accountQuery(): string {
    const accountId = process.env.BRIGHT_DATA_ACCOUNT_ID?.trim();

    return accountId ? `&customer=${encodeURIComponent(accountId)}` : '';
  }

  private get serpAsyncPollIntervalMs(): number {
    return Number(process.env.BRIGHT_DATA_SERP_ASYNC_POLL_INTERVAL_MS ?? 2_000);
  }

  private get requestTimeoutMs(): number {
    return Number(process.env.BRIGHT_DATA_REQUEST_TIMEOUT_MS ?? 90_000);
  }

  // Attempts per query across transient failures, each after the cooldown
  private get serpMaxAttempts(): number {
    return Math.max(
      1,
      Number(process.env.BRIGHT_DATA_SERP_MAX_ATTEMPTS ?? 3) || 1,
    );
  }

  private get datasetScrapeTimeoutMs(): number {
    return Number(process.env.BRIGHT_DATA_DATASET_SCRAPE_TIMEOUT_MS ?? 360_000);
  }

  private get datasetId(): string {
    return (
      process.env.BRIGHT_DATA_SERP_DATASET_ID?.trim() || 'gd_mfz5x93lmsjjjylob'
    );
  }

  private get snapshotPollIntervalMs(): number {
    return Number(process.env.BRIGHT_DATA_SNAPSHOT_POLL_INTERVAL_MS ?? 20_000);
  }

  private get snapshotTimeoutMs(): number {
    return Number(process.env.BRIGHT_DATA_SNAPSHOT_TIMEOUT_MS ?? 480_000);
  }

  private get snapshotDiscoveryTimeoutMs(): number {
    return Number(
      process.env.BRIGHT_DATA_SNAPSHOT_DISCOVERY_TIMEOUT_MS ?? 360_000,
    );
  }

  private get snapshotDownloadRetryIntervalMs(): number {
    return Number(
      process.env.BRIGHT_DATA_SNAPSHOT_DOWNLOAD_RETRY_INTERVAL_MS ?? 5_000,
    );
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey) || this.serpProxy !== undefined;
  }

  /** True when Fast SERP news (FSERP proxy) or regular SERP credentials are set. */
  isGoogleNewsConfigured(): boolean {
    return this.fastSerpProxy !== undefined || this.isConfigured();
  }

  /**
   * Runs a Bright Data SERP zone request for a fully qualified Google search URL.
   * Uses `format: json` so the response includes a structured `organic` array when available.
   */
  async requestSerpGoogleJson(
    searchUrl: string,
    options?: BrightDataSerpRequestOptions,
  ): Promise<BrightDataSerpGoogleJson> {
    return this.requestSerpJson(searchUrl, options);
  }

  /**
   * Fast SERP Google News (`tbm=nws`). Prefers the FSERP native proxy when
   * credentials exist; falls back to the API key path if the proxy fails.
   */
  async requestGoogleNewsJson(
    query: string,
    options: BrightDataSerpRequestOptions = {},
  ): Promise<BrightDataSerpGoogleJson> {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      throw new Error('Google News query must not be empty');
    }

    // `q` must be the first query parameter for Fast SERP news
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(trimmedQuery)}&tbm=nws&brd_json=1&hl=en&gl=us`;
    const newsOptions: BrightDataSerpRequestOptions = {
      ...options,
      dataFormat: options.dataFormat ?? 'parsed_light',
      imgFormat: options.imgFormat ?? 'link',
    };
    const fastProxy = this.fastSerpProxy;
    const key = this.apiKey;

    if (fastProxy !== undefined) {
      try {
        return await this.requestSerpJsonViaProxy(
          searchUrl,
          fastProxy,
          newsOptions,
        );
      } catch (error) {
        if (key === undefined) {
          throw error;
        }

        this.logger.warn(
          `Fast SERP proxy news failed, falling back to API: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (key !== undefined) {
      return this.requestSerpJsonViaApi(searchUrl, key, newsOptions);
    }

    return this.requestSerpJson(searchUrl, newsOptions);
  }

  // Bright Data rejects a query that just failed for at least 15 seconds ("this
  // query recently failed") and asks that identical requests are not sent at the
  // same time. So one request per query is in flight, any caller asking for it
  // meanwhile shares it, and a failed query is not sent again until the cooldown
  // has passed. The shared request does not follow one caller's abort signal;
  // each caller stops waiting for it on its own.
  private readonly inFlightQueries = new Map<
    string,
    Promise<BrightDataSerpGoogleJson>
  >();
  private readonly queryCooldownUntil = new Map<string, number>();
  private readonly routeRefusedUntil = new Map<string, number>();

  async requestSerpJson(
    searchUrl: string,
    options: BrightDataSerpRequestOptions = {},
  ): Promise<BrightDataSerpGoogleJson> {
    const cacheParts = {
      searchUrl,
      dataFormat: options.dataFormat ?? '',
      imgFormat: options.imgFormat ?? '',
    };
    const run = () => this.requestSerpJsonUncached(searchUrl, options);

    if (!this.providerQueryCache) {
      return run();
    }

    return this.providerQueryCache.getOrFetch(
      BRIGHT_DATA_SERP_CACHE_PREFIX,
      cacheParts,
      run,
    );
  }

  private async requestSerpJsonUncached(
    searchUrl: string,
    options: BrightDataSerpRequestOptions = {},
  ): Promise<BrightDataSerpGoogleJson> {
    const queryKey = `${searchUrl}|${options.dataFormat ?? ''}`;
    const shared = this.inFlightQueries.get(queryKey);

    if (shared !== undefined) {
      return waitForOrAbort(shared, options.signal);
    }

    const { signal: _callerSignal, ...sharedOptions } = options;
    const request = (async () => {
      const cooldownMs =
        (this.queryCooldownUntil.get(queryKey) ?? 0) - Date.now();

      if (cooldownMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, cooldownMs));
      }

      try {
        for (let attempt = 1; ; attempt++) {
          try {
            return await this.requestSerpJsonOverRoutes(
              searchUrl,
              sharedOptions,
            );
          } catch (error) {
            if (attempt >= this.serpMaxAttempts || !isTransientFailure(error)) {
              throw error;
            }

            this.logger.warn(
              `Bright Data SERP attempt ${attempt} failed, retrying in ${QUERY_COOLDOWN_MS / 1000}s: ${error instanceof Error ? error.message : String(error)}`,
            );
            await new Promise((resolve) =>
              setTimeout(resolve, QUERY_COOLDOWN_MS),
            );
          }
        }
      } catch (error) {
        this.queryCooldownUntil.set(queryKey, Date.now() + QUERY_COOLDOWN_MS);
        this.pruneQueryCooldowns();

        throw error;
      } finally {
        this.inFlightQueries.delete(queryKey);
      }
    })();

    this.inFlightQueries.set(queryKey, request);

    return waitForOrAbort(request, options.signal);
  }

  private pruneQueryCooldowns(): void {
    if (this.queryCooldownUntil.size < 500) {
      return;
    }

    const now = Date.now();

    for (const [key, until] of this.queryCooldownUntil) {
      if (until <= now) {
        this.queryCooldownUntil.delete(key);
      }
    }
  }

  private async requestSerpJsonOverRoutes(
    searchUrl: string,
    options: BrightDataSerpRequestOptions = {},
  ): Promise<BrightDataSerpGoogleJson> {
    const key = this.apiKey;
    const proxy = this.serpProxy;
    const fallbackProxy = this.serpFallbackProxy;

    if (!key && proxy === undefined && fallbackProxy === undefined) {
      throw new Error('BRIGHT_DATA_API_KEY is not set');
    }

    // Routes in order of preference: the primary superproxy zone, then the
    // REST API, then the fallback zone. A route that cannot connect or answers
    // with a server error hands over to the next; a caller's abort and a
    // 4xx do not.
    const routes: Array<{
      name: string;
      run: () => Promise<BrightDataSerpGoogleJson>;
    }> = [];

    if (proxy !== undefined) {
      routes.push({
        name: 'SERP proxy',
        run: () => this.requestSerpJsonViaProxy(searchUrl, proxy, options),
      });
    }

    if (key) {
      routes.push({
        name: 'SERP API',
        run: () => this.requestSerpJsonViaApi(searchUrl, key, options),
      });
    }

    if (fallbackProxy !== undefined) {
      routes.push({
        name: 'SERP fallback proxy',
        run: () =>
          this.requestSerpJsonViaProxy(searchUrl, fallbackProxy, options),
      });
    }

    // Routes refused recently go last, keeping their relative order
    const now = Date.now();
    const isPenalized = (name: string) =>
      (this.routeRefusedUntil.get(name) ?? 0) > now;

    routes.sort(
      (left, right) =>
        Number(isPenalized(left.name)) - Number(isPenalized(right.name)),
    );

    let lastError: unknown;

    for (const [index, route] of routes.entries()) {
      try {
        const result = await route.run();

        this.routeRefusedUntil.delete(route.name);

        await this.rawFetchArchiveService?.archive({
          provider: 'serp',
          endpoint: 'google-serp',
          request: { searchUrl, options: { dataFormat: options.dataFormat } },
          response: result,
          meta: { route: route.name },
        });

        return result;
      } catch (error) {
        lastError = error;

        if (isRouteRefusal(error)) {
          if (!isPenalized(route.name)) {
            this.logger.error(
              `${route.name} refused by Bright Data, trying it last for the next ${ROUTE_REFUSAL_PENALTY_MS / 60_000} min. Check the zone's credentials and IP allowlist: ${error instanceof Error ? error.message : String(error)}`,
            );
          }

          this.routeRefusedUntil.set(
            route.name,
            Date.now() + ROUTE_REFUSAL_PENALTY_MS,
          );
        }

        if (
          options.signal?.aborted === true ||
          index === routes.length - 1 ||
          !isRouteFailure(error)
        ) {
          throw error;
        }

        this.logger.warn(
          `${route.name} failed, trying ${routes[index + 1].name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    throw lastError;
  }

  private async requestSerpJsonViaProxy(
    searchUrl: string,
    proxy: { host: string; port: number; username: string; password: string },
    options: BrightDataSerpRequestOptions = {},
  ): Promise<BrightDataSerpGoogleJson> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? this.requestTimeoutMs,
    );
    const abortFromCaller = () => controller.abort();

    if (options.signal?.aborted === true) {
      controller.abort();
    }

    options.signal?.addEventListener('abort', abortFromCaller, { once: true });

    try {
      const rawText = await this.fetchSerpViaProxy(
        searchUrl,
        proxy,
        controller.signal,
        options.dataFormat,
        options.imgFormat,
      );

      return this.readSerpBody(rawText);
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abortFromCaller);
    }
  }

  private async requestSerpJsonViaApi(
    searchUrl: string,
    key: string,
    options: BrightDataSerpRequestOptions = {},
  ): Promise<BrightDataSerpGoogleJson> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? this.requestTimeoutMs,
    );
    const abortFromCaller = () => controller.abort();

    if (options.signal?.aborted === true) {
      controller.abort();
    }

    options.signal?.addEventListener('abort', abortFromCaller, { once: true });

    try {
      const rawText = this.serpAsyncEnabled
        ? await this.fetchSerpAsync(searchUrl, key, controller.signal)
        : await this.fetchSerpSync(
            searchUrl,
            key,
            controller.signal,
            options.dataFormat,
          );

      return this.readSerpBody(rawText);
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abortFromCaller);
    }
  }

  // undici reports every network failure as "fetch failed"; the code that
  // says why (ECONNRESET, ENOTFOUND, UND_ERR_CONNECT_TIMEOUT...) is on cause
  // Temporary: when a connection fails, say which addresses the host resolves
  // to and which of them accept a TCP connection from this process
  private lastConnectProbeAt = 0;

  // A few kept-alive sockets shared by every SERP call. Opening a new TLS
  // connection per request (hundreds at once) is what timed out to
  // api.brightdata.com; short async calls reuse these instead.
  private dispatcher?: Agent;

  private getDispatcher(): Agent {
    this.dispatcher ??= new Agent({
      connections: Number(process.env.BRIGHT_DATA_MAX_CONNECTIONS ?? 16),
      keepAliveTimeout: 30_000,
      connect: { timeout: 30_000 },
    });

    return this.dispatcher;
  }

  private async probeConnectivity(url: string): Promise<string> {
    if (Date.now() - this.lastConnectProbeAt < 60_000) {
      return '';
    }

    this.lastConnectProbeAt = Date.now();

    try {
      const host = new URL(url).hostname;
      const addresses = await lookup(host, { all: true });
      const results = await Promise.all(
        addresses.map(
          (entry) =>
            new Promise<string>((resolve) => {
              const startedAt = Date.now();
              const socket = connect({
                host: entry.address,
                port: 443,
                timeout: 4_000,
              });

              socket.once('connect', () => {
                socket.destroy();
                resolve(`${entry.address} ok ${Date.now() - startedAt}ms`);
              });
              socket.once('timeout', () => {
                socket.destroy();
                resolve(`${entry.address} timeout`);
              });
              socket.once('error', (error: NodeJS.ErrnoException) => {
                resolve(`${entry.address} ${error.code ?? error.message}`);
              });
            }),
        ),
      );

      const summary = ` probe[${results.join('; ')}]`;
      const probeLogPath = process.env.FIND_ROLE_OUTCOME_LOG_PATH;

      if (probeLogPath !== undefined && probeLogPath !== '') {
        appendFileSync(
          `${probeLogPath}.probe`,
          `${new Date().toISOString()} ${host}${summary}\n`,
        );
      }

      return summary;
    } catch (error) {
      return ` probe[${(error as Error).message}]`;
    }
  }

  private async fetchWithCause(
    url: string,
    init: RequestInit,
    dispatcher: Agent | ProxyAgent = this.getDispatcher(),
  ): Promise<Response> {
    try {
      return await fetch(url, {
        ...init,
        dispatcher,
      } as RequestInit);
    } catch (error) {
      type FetchCause = {
        code?: string;
        message?: string;
        address?: string;
        port?: number;
        errors?: Array<{ code?: string; address?: string; port?: number }>;
        cause?: unknown;
      };
      // A refused proxy tunnel nests its reason ("Proxy response (407)") one
      // level below a "Request was cancelled" with code 0
      let cause = (error as { cause?: unknown })?.cause as
        | FetchCause
        | undefined;

      while (
        cause?.cause !== undefined &&
        cause.cause !== null &&
        typeof cause.cause === 'object'
      ) {
        cause = cause.cause as FetchCause;
      }

      const attempts = (cause?.errors ?? [])
        .map((attempt) =>
          `${attempt.address ?? '?'}:${attempt.port ?? '?'} ${attempt.code ?? ''}`.trim(),
        )
        .join(', ');
      const detail = [
        [cause?.code, cause?.message]
          .filter((part) => part !== undefined && part !== '')
          .join(': ') ||
          (error as Error)?.name ||
          'unknown',
        attempts !== '' ? attempts : undefined,
        cause?.address !== undefined
          ? `${cause.address}:${cause.port ?? '?'}`
          : undefined,
      ]
        .filter((part) => part !== undefined)
        .join(' | ');

      throw new Error(
        `${(error as Error)?.message ?? 'request failed'} (${detail})${await this.probeConnectivity(url)}`,
      );
    }
  }

  private proxyDispatchers = new Map<string, ProxyAgent>();

  private getProxyDispatcher(proxy: {
    host: string;
    port: number;
    username: string;
    password: string;
  }): ProxyAgent {
    const key = `${proxy.host}:${proxy.port}:${proxy.username}`;
    const existing = this.proxyDispatchers.get(key);

    if (existing !== undefined) {
      return existing;
    }

    // Bright Data re-signs the TLS of the proxied request, like the `-k` of
    // its own curl examples; set BRIGHT_DATA_SERP_PROXY_VERIFY_TLS=true once
    // its CA is installed
    const dispatcher = new ProxyAgent({
      uri: `http://${proxy.host}:${proxy.port}`,
      token: `Basic ${Buffer.from(`${proxy.username}:${proxy.password}`).toString('base64')}`,
      requestTls: {
        rejectUnauthorized:
          process.env.BRIGHT_DATA_SERP_PROXY_VERIFY_TLS === 'true',
      },
      connections: Number(process.env.BRIGHT_DATA_MAX_CONNECTIONS ?? 24),
      keepAliveTimeout: 30_000,
      proxyTls: { timeout: 30_000 },
    });

    this.proxyDispatchers.set(key, dispatcher);

    return dispatcher;
  }

  private async fetchSerpViaProxy(
    searchUrl: string,
    proxy: { host: string; port: number; username: string; password: string },
    signal: AbortSignal,
    dataFormat: 'parsed' | 'parsed_light' = 'parsed',
    imgFormat?: 'link',
  ): Promise<string> {
    const headers: Record<string, string> = {
      'x-unblock-data-format': dataFormat,
    };

    if (imgFormat === 'link') {
      headers['x-unblock-img-format'] = 'link';
    }

    const response = await this.fetchWithCause(
      searchUrl,
      {
        method: 'GET',
        headers,
        signal,
      },
      this.getProxyDispatcher(proxy),
    );
    const rawText = await response.text();

    if (!response.ok) {
      const reason =
        response.headers.get('x-brd-err-msg') ??
        response.headers.get('x-brd-error') ??
        rawText.slice(0, 300);

      throw new Error(
        `Bright Data SERP failed: HTTP ${response.status} ${response.statusText}: ${reason}`,
      );
    }

    return rawText;
  }

  private async fetchSerpSync(
    searchUrl: string,
    key: string,
    signal: AbortSignal,
    dataFormat: 'parsed' | 'parsed_light' = 'parsed',
  ): Promise<string> {
    const response = await this.fetchWithCause(BRIGHT_DATA_REQUEST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        zone: this.zone,
        url: searchUrl,
        format: 'json',
        data_format: dataFormat,
      }),
      signal,
    });
    const rawText = await response.text();

    if (!response.ok) {
      this.logger.warn(
        `Bright Data SERP HTTP ${response.status}: ${rawText.slice(0, 500)}`,
      );
      throw new Error(
        `Bright Data SERP failed: HTTP ${response.status} ${response.statusText}`,
      );
    }

    return rawText;
  }

  // Temporary: how long async jobs really take, next to the probe log
  private logAsyncTurnaround(elapsedMs: number, polls: number): void {
    const logPath = process.env.FIND_ROLE_OUTCOME_LOG_PATH;

    if (logPath !== undefined && logPath !== '') {
      try {
        appendFileSync(
          `${logPath}.probe`,
          `${new Date().toISOString()} async job done in ${elapsedMs}ms after ${polls} polls\n`,
        );
      } catch {
        // best effort
      }
    }
  }

  private async fetchSerpAsync(
    searchUrl: string,
    key: string,
    signal: AbortSignal,
  ): Promise<string> {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    };
    const searchParams = new URL(searchUrl).searchParams;
    const query: Record<string, string> = {};

    searchParams.forEach((value, name) => {
      query[name] = value;
    });

    const submitted = await this.fetchWithCause(
      `${BRIGHT_DATA_SERP_ASYNC_SUBMIT_URL}?zone=${encodeURIComponent(this.zone)}${this.accountQuery}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, brd_json: 'json' }),
        signal,
      },
    );
    const submittedText = await submitted.text();

    if (!submitted.ok) {
      this.logger.warn(
        `Bright Data SERP async submit HTTP ${submitted.status}: ${submittedText.slice(0, 500)}`,
      );
      throw new Error(
        `Bright Data SERP failed: HTTP ${submitted.status} ${submitted.statusText}`,
      );
    }

    let responseId = submitted.headers?.get?.('x-response-id') ?? undefined;

    if (!responseId) {
      try {
        responseId = (JSON.parse(submittedText) as { response_id?: string })
          .response_id;
      } catch {
        // handled below
      }
    }

    if (!responseId) {
      throw new Error(
        `Bright Data SERP returned a non-JSON reply: ${submittedText.slice(0, 160)}`,
      );
    }

    const submittedAt = Date.now();
    let polls = 0;

    // 202 means still being scraped; anything else is the answer
    while (!signal.aborted) {
      polls += 1;
      await new Promise((resolve) =>
        setTimeout(resolve, this.serpAsyncPollIntervalMs),
      );

      const result = await this.fetchWithCause(
        `${BRIGHT_DATA_SERP_ASYNC_RESULT_URL}?response_id=${encodeURIComponent(responseId)}&zone=${encodeURIComponent(this.zone)}${this.accountQuery}`,
        { method: 'GET', headers, signal },
      );

      if (result.status === 202) {
        continue;
      }

      const resultText = await result.text();

      if (!result.ok) {
        this.logger.warn(
          `Bright Data SERP async result HTTP ${result.status}: ${resultText.slice(0, 500)}`,
        );
        throw new Error(
          `Bright Data SERP failed: HTTP ${result.status} ${result.statusText}`,
        );
      }

      this.logAsyncTurnaround(Date.now() - submittedAt, polls);

      return resultText;
    }

    throw new Error('Bright Data SERP request aborted');
  }

  private readSerpBody(rawText: string): BrightDataSerpGoogleJson {
    const trimmedBody = rawText.trim();

    // Bright Data sometimes answers 200 with a plain sentence instead of
    // JSON; parsed as "no results" it silently empties a search
    if (
      trimmedBody !== '' &&
      trimmedBody[0] !== '{' &&
      trimmedBody[0] !== '['
    ) {
      throw new Error(
        `Bright Data SERP returned a non-JSON reply: ${trimmedBody.slice(0, 160)}`,
      );
    }

    const parsed = this.parseSerpJsonBody(rawText);

    // Bright Data answers 200 with {status_code: 502, body: ''} when its own
    // upstream fails; without this it reads as a search with no results
    if (
      typeof parsed.status_code === 'number' &&
      parsed.status_code >= 400 &&
      !Array.isArray(parsed.organic)
    ) {
      const headers = (parsed as { headers?: Record<string, unknown> }).headers;
      const reason = [
        headers?.['x-brd-err-msg'],
        headers?.['x-brd-error'],
        headers?.['proxy-status'],
      ].find(
        (value): value is string => typeof value === 'string' && value !== '',
      );

      throw new Error(
        `Bright Data SERP failed: HTTP ${parsed.status_code} (upstream)${reason !== undefined ? `: ${reason.slice(0, 300)}` : ''}`,
      );
    }

    return parsed;
  }

  async createDatasetSnapshot(input: {
    items: BrightDataDatasetScrapeInput[];
    includePaginatedHtml: boolean;
    onStatus?: (
      update: BrightDataDatasetSnapshotProgress & {
        phase:
          | 'submitting'
          | 'submitted'
          | 'discovering_snapshot'
          | 'snapshot_discovered';
        attempt?: number;
      },
    ) => Promise<void> | void;
  }): Promise<{ snapshotId: string }> {
    const key = this.apiKey;
    if (!key) {
      throw new Error('BRIGHT_DATA_API_KEY is not set');
    }

    const createdAfterMs = Date.now() - 15_000;
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.datasetScrapeTimeoutMs,
    );
    const url = `${BRIGHT_DATA_DATASET_TRIGGER_URL}?dataset_id=${encodeURIComponent(this.datasetId)}&notify=false&include_errors=true`;

    try {
      await input.onStatus?.({
        dataset_id: this.datasetId,
        status: 'running',
        phase: 'submitting',
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          input: input.items,
          include_paginated_html: input.includePaginatedHtml,
        }),
        signal: controller.signal,
      });

      const rawText = await response.text();

      if (!response.ok) {
        this.logger.warn(
          `Bright Data dataset trigger HTTP ${response.status}: ${rawText.slice(0, 500)}`,
        );
        throw new Error(
          `Bright Data dataset trigger failed: HTTP ${response.status} ${response.statusText}`,
        );
      }

      const parsed = JSON.parse(rawText) as { snapshot_id?: string };
      const snapshotId = parsed.snapshot_id?.trim();

      if (!snapshotId) {
        await input.onStatus?.({
          dataset_id: this.datasetId,
          status: 'running',
          phase: 'discovering_snapshot',
        });

        return {
          snapshotId: await this.discoverDatasetSnapshotId({
            createdAfterMs,
            onPoll: input.onStatus,
          }),
        };
      }

      await input.onStatus?.({
        snapshot_id: snapshotId,
        dataset_id: this.datasetId,
        status: 'running',
        phase: 'submitted',
      });

      return { snapshotId };
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === 'AbortError' || /timeout|aborted/i.test(error.message))
      ) {
        this.logger.warn(
          `Bright Data dataset trigger submission exceeded ${this.datasetScrapeTimeoutMs}ms; falling back to snapshots discovery.`,
        );

        await input.onStatus?.({
          dataset_id: this.datasetId,
          status: 'running',
          phase: 'discovering_snapshot',
        });

        return {
          snapshotId: await this.discoverDatasetSnapshotId({
            createdAfterMs,
            onPoll: input.onStatus,
          }),
        };
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async pollDatasetSnapshotUntilReady(input: {
    snapshotId: string;
    onPoll?: (
      update: BrightDataDatasetSnapshotProgress & {
        attempt: number;
      },
    ) => Promise<void> | void;
  }): Promise<BrightDataDatasetSnapshotItem[]> {
    const deadline = Date.now() + this.snapshotTimeoutMs;
    let attempt = 0;

    while (Date.now() < deadline) {
      attempt += 1;

      const progress = await this.getDatasetSnapshotProgress(input.snapshotId);
      const status = progress.status?.toString().trim() || 'running';

      this.logger.log(
        `Bright Data snapshot progress poll snapshotId=${input.snapshotId} attempt=${attempt} status=${status}`,
      );

      await input.onPoll?.({
        ...progress,
        snapshot_id: progress.snapshot_id || input.snapshotId,
        status,
        attempt,
      });

      if (status.toLowerCase() === 'failed') {
        throw new Error(
          `Bright Data snapshot ${input.snapshotId} failed before completion`,
        );
      }

      if (status.toLowerCase() === 'canceled') {
        throw new Error(
          `Bright Data snapshot ${input.snapshotId} was canceled before completion`,
        );
      }

      if (status.toLowerCase() === 'ready') {
        const snapshot = await this.waitForDatasetSnapshotData({
          snapshotId: input.snapshotId,
          deadline,
          onPoll: input.onPoll,
          startAttempt: attempt,
        });

        await input.onPoll?.({
          snapshot_id: input.snapshotId,
          dataset_id: progress.dataset_id,
          status: 'ready',
          attempt,
        });

        return snapshot;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, this.snapshotPollIntervalMs),
      );
    }

    throw new Error(
      `Bright Data snapshot ${input.snapshotId} timed out after ${this.snapshotTimeoutMs}ms`,
    );
  }

  private async waitForDatasetSnapshotData(input: {
    snapshotId: string;
    deadline: number;
    startAttempt: number;
    onPoll?: (
      update: BrightDataDatasetSnapshotProgress & {
        attempt: number;
      },
    ) => Promise<void> | void;
  }): Promise<BrightDataDatasetSnapshotItem[]> {
    let downloadAttempt = 0;

    while (Date.now() < input.deadline) {
      downloadAttempt += 1;

      const snapshot = await this.getDatasetSnapshotData(input.snapshotId);

      if (Array.isArray(snapshot)) {
        this.logger.log(
          `Bright Data snapshot download ready snapshotId=${input.snapshotId} downloadAttempt=${downloadAttempt} itemCount=${snapshot.length}`,
        );

        return snapshot;
      }

      const payloadStatus = snapshot.status?.toString().trim() || 'processing';
      const attempt = input.startAttempt + downloadAttempt;

      this.logger.warn(
        `Bright Data snapshot download not ready yet snapshotId=${input.snapshotId} downloadAttempt=${downloadAttempt} payloadStatus=${payloadStatus} message=${snapshot.message ?? ''}`.trim(),
      );

      await input.onPoll?.({
        ...snapshot,
        snapshot_id: snapshot.snapshot_id || input.snapshotId,
        status: payloadStatus,
        attempt,
      });

      await new Promise((resolve) =>
        setTimeout(resolve, this.snapshotDownloadRetryIntervalMs),
      );
    }

    throw new Error(
      `Bright Data snapshot ${input.snapshotId} became ready in progress but download payload was unavailable before timeout`,
    );
  }

  private async getDatasetSnapshotProgress(
    snapshotId: string,
  ): Promise<BrightDataDatasetSnapshotProgress> {
    const key = this.apiKey;
    if (!key) {
      throw new Error('BRIGHT_DATA_API_KEY is not set');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await fetch(
        `${BRIGHT_DATA_DATASET_PROGRESS_URL}/${encodeURIComponent(snapshotId)}`,
        {
          headers: {
            Authorization: `Bearer ${key}`,
          },
          signal: controller.signal,
        },
      );

      const rawText = await response.text();

      if (!response.ok) {
        this.logger.warn(
          `Bright Data snapshot progress HTTP ${response.status}: ${rawText.slice(0, 500)}`,
        );
        throw new Error(
          `Bright Data snapshot progress failed: HTTP ${response.status} ${response.statusText}`,
        );
      }

      return this.parseDatasetProgressBody(rawText, snapshotId);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async getDatasetSnapshotData(
    snapshotId: string,
  ): Promise<
    BrightDataDatasetSnapshotItem[] | BrightDataDatasetSnapshotProgress
  > {
    const key = this.apiKey;
    if (!key) {
      throw new Error('BRIGHT_DATA_API_KEY is not set');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await fetch(
        `${BRIGHT_DATA_DATASET_SNAPSHOT_URL}/${encodeURIComponent(snapshotId)}`,
        {
          headers: {
            Authorization: `Bearer ${key}`,
          },
          signal: controller.signal,
        },
      );

      const rawText = await response.text();

      if (!response.ok) {
        this.logger.warn(
          `Bright Data snapshot data HTTP ${response.status}: ${rawText.slice(0, 500)}`,
        );
        throw new Error(
          `Bright Data snapshot data fetch failed: HTTP ${response.status} ${response.statusText}`,
        );
      }

      const parsed = this.parseDatasetSnapshotBody(rawText);

      if (Array.isArray(parsed)) {
        await this.rawFetchArchiveService?.archive({
          provider: 'bright-data',
          endpoint: 'dataset-snapshot',
          request: { snapshotId },
          response: parsed,
          meta: { itemCount: parsed.length },
        });

        return parsed;
      }

      this.logger.log(
        `Bright Data snapshot data response snapshotId=${snapshotId} returned non-array payload status=${parsed.status ?? 'unknown'} message=${parsed.message ?? ''}`.trim(),
      );

      return parsed;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async listDatasetSnapshots(): Promise<
    BrightDataDatasetSnapshotListEntry[]
  > {
    const key = this.apiKey;
    if (!key) {
      throw new Error('BRIGHT_DATA_API_KEY is not set');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await fetch(
        `${BRIGHT_DATA_DATASET_SNAPSHOTS_URL}?dataset_id=${encodeURIComponent(this.datasetId)}`,
        {
          headers: {
            Authorization: `Bearer ${key}`,
          },
          signal: controller.signal,
        },
      );

      const rawText = await response.text();

      if (!response.ok) {
        this.logger.warn(
          `Bright Data snapshots list HTTP ${response.status}: ${rawText.slice(0, 500)}`,
        );
        throw new Error(
          `Bright Data snapshots list failed: HTTP ${response.status} ${response.statusText}`,
        );
      }

      return this.parseDatasetSnapshotsListBody(rawText);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async discoverDatasetSnapshotId(input: {
    createdAfterMs: number;
    onPoll?: (
      update: BrightDataDatasetSnapshotProgress & {
        phase: 'discovering_snapshot' | 'snapshot_discovered';
        attempt?: number;
      },
    ) => Promise<void> | void;
  }): Promise<string> {
    const deadline = Date.now() + this.snapshotDiscoveryTimeoutMs;
    let attempt = 0;

    while (Date.now() < deadline) {
      attempt += 1;
      const snapshots = await this.listDatasetSnapshots();
      const candidate = snapshots
        .map((entry) => ({
          id: entry.snapshot_id?.trim() || entry.id?.trim(),
          status: entry.status?.toString().trim() || 'running',
          timestamp:
            Date.parse(entry.timestamp ?? '') ||
            Date.parse(entry.created_at ?? '') ||
            Date.parse(entry.updated_at ?? '') ||
            0,
        }))
        .filter(
          (entry): entry is { id: string; status: string; timestamp: number } =>
            Boolean(entry.id) && entry.timestamp >= input.createdAfterMs,
        )
        .sort((a, b) => b.timestamp - a.timestamp)[0];

      if (candidate?.id) {
        await input.onPoll?.({
          snapshot_id: candidate.id,
          dataset_id: this.datasetId,
          status: candidate.status,
          phase: 'snapshot_discovered',
          attempt,
        });

        return candidate.id;
      }

      await input.onPoll?.({
        dataset_id: this.datasetId,
        status: 'running',
        phase: 'discovering_snapshot',
        attempt,
      });

      await new Promise((resolve) =>
        setTimeout(resolve, this.snapshotPollIntervalMs),
      );
    }

    throw new Error(
      `Bright Data snapshot id discovery timed out after ${this.snapshotDiscoveryTimeoutMs}ms`,
    );
  }

  private parseSerpJsonBody(rawText: string): BrightDataSerpGoogleJson {
    const trimmed = rawText.trim();
    if (!trimmed) {
      return {};
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;

      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, unknown>;
        const organic = obj.organic;
        if (Array.isArray(organic)) {
          return obj as BrightDataSerpGoogleJson;
        }

        const nestedBody = obj.body;
        if (typeof nestedBody === 'string' && nestedBody.trim()) {
          const inner = JSON.parse(nestedBody) as unknown;
          if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
            return inner as BrightDataSerpGoogleJson;
          }
        }

        const data = obj.data;
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          return data as BrightDataSerpGoogleJson;
        }

        return obj as BrightDataSerpGoogleJson;
      }
    } catch (error) {
      this.logger.warn(
        `Bright Data SERP JSON parse failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return {};
  }

  private parseDatasetSnapshotBody(
    rawText: string,
  ): BrightDataDatasetSnapshotProgress | BrightDataDatasetSnapshotItem[] {
    const trimmed = rawText.trim();

    if (!trimmed) {
      return [];
    }

    const parsed = JSON.parse(trimmed) as unknown;

    if (Array.isArray(parsed)) {
      return parsed as BrightDataDatasetSnapshotItem[];
    }

    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>;
      const data = record.data;

      if (Array.isArray(data)) {
        return data as BrightDataDatasetSnapshotItem[];
      }

      // Bright Data may return a single dataset item object instead of an array
      // when the trigger/snapshot was created with one input row.
      const looksLikeDatasetItem =
        'organic' in record ||
        'general' in record ||
        'pagination' in record ||
        ('url' in record && 'keyword' in record);

      if (looksLikeDatasetItem) {
        return [record as BrightDataDatasetSnapshotItem];
      }

      const message = record.message;

      if (typeof message === 'string') {
        const normalizedMessage = message.toLowerCase();

        return {
          snapshot_id:
            typeof record.snapshot_id === 'string'
              ? record.snapshot_id
              : undefined,
          dataset_id:
            typeof record.dataset_id === 'string'
              ? record.dataset_id
              : undefined,
          status: normalizedMessage.includes('still in progress')
            ? 'running'
            : normalizedMessage.includes('cannot be retrieved')
              ? 'running'
              : normalizedMessage.includes('failed')
                ? 'failed'
                : 'processing',
        };
      }

      return record as BrightDataDatasetSnapshotProgress;
    }

    return [];
  }

  private parseDatasetProgressBody(
    rawText: string,
    snapshotId: string,
  ): BrightDataDatasetSnapshotProgress {
    const trimmed = rawText.trim();

    if (!trimmed) {
      return {
        snapshot_id: snapshotId,
        status: 'running',
      };
    }

    try {
      const parsed = JSON.parse(trimmed) as BrightDataDatasetSnapshotProgress;

      return {
        snapshot_id: parsed.snapshot_id || snapshotId,
        dataset_id: parsed.dataset_id,
        status: parsed.status || 'running',
        message: parsed.message,
        created_at: parsed.created_at,
        updated_at: parsed.updated_at,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to parse Bright Data progress payload for snapshot ${snapshotId}: ${error instanceof Error ? error.message : String(error)}`,
      );

      return {
        snapshot_id: snapshotId,
        status: 'running',
      };
    }
  }

  private parseDatasetSnapshotsListBody(
    rawText: string,
  ): BrightDataDatasetSnapshotListEntry[] {
    const trimmed = rawText.trim();

    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed) as
        | BrightDataDatasetSnapshotListEntry[]
        | {
            snapshots?: BrightDataDatasetSnapshotListEntry[];
            items?: BrightDataDatasetSnapshotListEntry[];
          };

      if (Array.isArray(parsed)) {
        return parsed;
      }

      if (Array.isArray(parsed.snapshots)) {
        return parsed.snapshots;
      }

      if (Array.isArray(parsed.items)) {
        return parsed.items;
      }

      return [];
    } catch (error) {
      this.logger.warn(
        `Failed to parse Bright Data snapshots list payload: ${error instanceof Error ? error.message : String(error)}`,
      );

      return [];
    }
  }
}
