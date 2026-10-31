import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { randomUUID } from 'crypto';

import { Repository } from 'typeorm';

import pricingCatalog from 'src/engine/core-modules/billing/constants/pricing-catalog.json';
import { FileStorageService } from 'src/engine/core-modules/file-storage/services/file-storage.service';
import { ProviderCallEntity } from 'src/engine/core-modules/provider-call-log/provider-call.entity';
import { getProviderCallContext } from 'src/engine/core-modules/provider-call-log/storage/provider-call-context.storage';
import { type ProviderCallCacheStatus } from 'src/engine/core-modules/provider-call-log/types/provider-call-cache-status.type';
import { summarizeProviderResponse } from 'src/engine/core-modules/provider-call-log/utils/summarize-provider-response.util';

export const PROVIDER_CALL_LOG_S3_FOLDER = 'provider-call-log';

// Requests are stored whole so a run can be replayed; only pathological
// payloads (a pasted company list) are cut
const MAX_REQUEST_BYTES = 64 * 1024;

export type ProviderCallRecord = {
  provider: string;
  operation: string;
  request?: unknown;
  cacheKey?: string;
  cacheStatus: ProviderCallCacheStatus;
  errorMessage?: string;
  durationMs?: number;
  response?: unknown;
  responseLocation?: string;
};

export type ProviderCallTrackOptions = {
  provider: string;
  operation: string;
  request?: unknown;
  // Off for responses that already land in durable storage elsewhere
  storeResponse?: boolean;
  // The provider query cache entry this request fills, so the fetch row and the
  // later cache hits share one identity in a trace
  cacheKey?: string;
};

// Every rate lives in the pricing catalog JSON. This file only decides which
// meter an observed call belongs to, so a rate is never written twice.
type PricingMeter = (typeof pricingCatalog.meters)[number];

const METERS_BY_ID = new Map<string, PricingMeter>(
  pricingCatalog.meters.map((meter) => [meter.id, meter]),
);

// Answered without reaching the provider, so they cost nothing
const CACHE_HIT_STATUSES = new Set(['redis_hit', 's3_hit', 'coalesced']);

const toUsd = (microCredits: number): number =>
  Math.round(microCredits) / 1_000_000;

// Provider and operation strings are owned by each source service, so the
// match is deliberately narrow. An unrecognised pair is reported as unrated
// instead of being guessed into a price.
const resolveMeterId = ({
  provider,
  operation,
}: {
  provider: string;
  operation: string;
}): string | null => {
  const lowerProvider = provider.toLowerCase();
  const lowerOperation = operation.toLowerCase();

  if (lowerProvider.includes('serp')) {
    return lowerOperation.includes('ai_overview') ||
      lowerOperation.includes('ai-overview')
      ? 'AI_OVERVIEW_REQUEST'
      : 'SERP_REQUEST';
  }

  if (lowerProvider.includes('harvest')) {
    if (lowerOperation.includes('lead')) {
      return 'HARVEST_LEAD_PAGE';
    }

    if (lowerOperation.includes('profile')) {
      return 'HARVEST_PROFILE_MAIN';
    }

    if (
      lowerOperation.includes('company-search') ||
      lowerOperation.includes('company_search')
    ) {
      return 'HARVEST_COMPANY_SEARCH_PAGE';
    }

    if (lowerOperation.startsWith('company')) {
      return 'HARVEST_COMPANY';
    }

    return null;
  }

  if (lowerProvider.includes('elastic') || lowerProvider === 'es') {
    return 'ES_SEARCH_REQUEST';
  }

  if (lowerProvider.includes('unipile')) {
    return 'UNIPILE_REQUEST';
  }

  if (lowerProvider.includes('bright')) {
    if (lowerOperation.includes('business')) {
      return 'BD_SEARCH_PAGE';
    }

    if (
      lowerOperation.includes('scrape') ||
      lowerOperation.includes('profile')
    ) {
      return 'BD_PROFILE_RECORD';
    }
  }

  return null;
};

export type ProjectCostMeterLine = {
  meterId: string;
  provider: string;
  unit: string;
  requests: number;
  billableRequests: number;
  providerCostUsd: number;
  chargedUsd: number;
};

export type ProjectCostStageLine = {
  stage: string;
  requests: number;
  providerCostUsd: number;
  chargedUsd: number;
};

export type ProjectCostReport = {
  projectId: string;
  sinceDays: number;
  since: string;
  requests: number;
  billableRequests: number;
  cacheHits: number;
  failedRequests: number;
  providerCostUsd: number;
  chargedUsd: number;
  byMeter: ProjectCostMeterLine[];
  byStage: ProjectCostStageLine[];
  // Calls that ran but that no catalog rate covers, so the total is never
  // presented as complete when it is not
  unrated: Array<{ provider: string; operation: string; requests: number }>;
};

@Injectable()
export class ProviderCallLogService {
  private readonly logger = new Logger(ProviderCallLogService.name);
  private readonly enabled =
    process.env.PROVIDER_CALL_LOG_ENABLED?.toLowerCase() !== 'false';

  constructor(
    // Calls are logged outside any workspace too and read back by chat
    // thread, so the workspace guard does not apply
    // eslint-disable-next-line twenty/prefer-workspace-scoped-repository
    @InjectRepository(ProviderCallEntity)
    private readonly providerCallRepository: Repository<ProviderCallEntity>,
    @Optional()
    private readonly fileStorageService?: FileStorageService,
  ) {}

  // Never awaited by callers and never throws: the ledger is for analysis,
  // so a slow or missing table must not slow down or fail a search
  record(entry: ProviderCallRecord): void {
    if (!this.enabled) {
      return;
    }

    const context = getProviderCallContext();
    const { resultCount, responseBytes } = summarizeProviderResponse(
      entry.response,
    );

    void this.providerCallRepository
      .insert({
        workspaceId: context.workspaceId ?? null,
        threadId: context.threadId ?? null,
        turnId: context.turnId ?? null,
        toolCallId: context.toolCallId ?? null,
        toolName: context.toolName ?? null,
        projectId: context.projectId ?? null,
        runId: context.runId ?? null,
        subject: context.subject ?? null,
        stage: context.stage ?? null,
        provider: entry.provider,
        operation: entry.operation,
        request: this.boundRequest(entry.request),
        cacheKey: entry.cacheKey ?? null,
        cacheStatus: entry.cacheStatus,
        success: entry.cacheStatus !== 'error',
        errorMessage: entry.errorMessage ?? null,
        durationMs: entry.durationMs ?? null,
        resultCount,
        responseBytes,
        responseLocation: entry.responseLocation ?? null,
      })
      .catch((error: unknown) => {
        this.logger.warn(
          `Provider call log insert failed provider=${entry.provider}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
  }

  // For sources that skip the provider query cache: times the call, keeps a
  // copy of the answer and records it, then hands the answer back unchanged
  async track<TResult>(
    options: ProviderCallTrackOptions,
    fetcher: () => Promise<TResult>,
  ): Promise<TResult> {
    if (!this.enabled) {
      return fetcher();
    }

    const startedAt = Date.now();

    try {
      const response = await fetcher();
      const responseLocation =
        options.storeResponse === false
          ? undefined
          : await this.storeResponse(options, response);

      this.record({
        provider: options.provider,
        operation: options.operation,
        request: options.request,
        cacheKey: options.cacheKey,
        cacheStatus: 'uncached',
        durationMs: Date.now() - startedAt,
        response,
        responseLocation,
      });

      return response;
    } catch (error) {
      this.record({
        provider: options.provider,
        operation: options.operation,
        request: options.request,
        cacheKey: options.cacheKey,
        cacheStatus: 'error',
        durationMs: Date.now() - startedAt,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  // What a project spent on the requests that fetched its results: the price
  // of every call in the ledger, using the catalog rate for its meter. Cached
  // and failed calls are counted but not priced, because the provider does not
  // bill them.
  async getProjectCost({
    workspaceId,
    projectId,
    sinceDays = 30,
  }: {
    workspaceId: string;
    projectId: string;
    sinceDays?: number;
  }): Promise<ProjectCostReport> {
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

    const rows: Array<{
      provider: string;
      operation: string;
      cacheStatus: string;
      success: boolean;
      stage: string | null;
      count: string;
    }> = await this.providerCallRepository
      .createQueryBuilder('call')
      .select('call.provider', 'provider')
      .addSelect('call.operation', 'operation')
      .addSelect('call.cacheStatus', 'cacheStatus')
      .addSelect('call.success', 'success')
      .addSelect('call.stage', 'stage')
      .addSelect('COUNT(*)', 'count')
      .where('call.workspaceId = :workspaceId', { workspaceId })
      .andWhere('call.projectId = :projectId', { projectId })
      .andWhere('call.createdAt >= :since', { since })
      .groupBy('call.provider')
      .addGroupBy('call.operation')
      .addGroupBy('call.cacheStatus')
      .addGroupBy('call.success')
      .addGroupBy('call.stage')
      .getRawMany();

    type Accrual = {
      requests: number;
      billableRequests: number;
      providerCostMicro: number;
      chargedMicro: number;
    };

    const emptyAccrual = (): Accrual => ({
      requests: 0,
      billableRequests: 0,
      providerCostMicro: 0,
      chargedMicro: 0,
    });

    const meterAccruals = new Map<string, Accrual>();
    const stageAccruals = new Map<string, Accrual>();
    const unrated = new Map<
      string,
      { provider: string; operation: string; requests: number }
    >();

    let requests = 0;
    let billableRequests = 0;
    let cacheHits = 0;
    let failedRequests = 0;
    let providerCostMicro = 0;
    let chargedMicro = 0;

    for (const row of rows) {
      const count = Number(row.count) || 0;

      if (count <= 0) {
        continue;
      }

      const isCacheHit = CACHE_HIT_STATUSES.has(row.cacheStatus);
      const isFailure = row.success === false;
      const billable = isCacheHit || isFailure ? 0 : count;

      requests += count;
      billableRequests += billable;
      cacheHits += isCacheHit ? count : 0;
      failedRequests += isFailure ? count : 0;

      if (billable === 0) {
        continue;
      }

      const meterId = resolveMeterId(row);
      const meter = meterId === null ? undefined : METERS_BY_ID.get(meterId);

      if (meter === undefined) {
        const key = `${row.provider}:${row.operation}`;
        const existing = unrated.get(key) ?? {
          provider: row.provider,
          operation: row.operation,
          requests: 0,
        };

        existing.requests += billable;
        unrated.set(key, existing);
        continue;
      }

      const costMicro = Math.round(meter.usdPerUnit * 1_000_000) * billable;
      const chargeMicro = meter.microCreditsCharged * billable;

      const meterAccrual = meterAccruals.get(meter.id) ?? emptyAccrual();
      meterAccrual.requests += count;
      meterAccrual.billableRequests += billable;
      meterAccrual.providerCostMicro += costMicro;
      meterAccrual.chargedMicro += chargeMicro;
      meterAccruals.set(meter.id, meterAccrual);

      const stage = row.stage ?? 'unspecified';
      const stageAccrual = stageAccruals.get(stage) ?? emptyAccrual();
      stageAccrual.requests += count;
      stageAccrual.billableRequests += billable;
      stageAccrual.providerCostMicro += costMicro;
      stageAccrual.chargedMicro += chargeMicro;
      stageAccruals.set(stage, stageAccrual);

      providerCostMicro += costMicro;
      chargedMicro += chargeMicro;
    }

    return {
      projectId,
      sinceDays,
      since: since.toISOString(),
      requests,
      billableRequests,
      cacheHits,
      failedRequests,
      providerCostUsd: toUsd(providerCostMicro),
      chargedUsd: toUsd(chargedMicro),
      byMeter: [...meterAccruals.entries()]
        .map(([meterId, accrual]) => {
          const meter = METERS_BY_ID.get(meterId);

          return {
            meterId,
            provider: meter?.provider ?? 'unknown',
            unit: meter?.unit ?? 'unit',
            requests: accrual.requests,
            billableRequests: accrual.billableRequests,
            providerCostUsd: toUsd(accrual.providerCostMicro),
            chargedUsd: toUsd(accrual.chargedMicro),
          };
        })
        .sort((left, right) => right.chargedUsd - left.chargedUsd),
      byStage: [...stageAccruals.entries()]
        .map(([stage, accrual]) => ({
          stage,
          requests: accrual.requests,
          providerCostUsd: toUsd(accrual.providerCostMicro),
          chargedUsd: toUsd(accrual.chargedMicro),
        }))
        .sort((left, right) => right.chargedUsd - left.chargedUsd),
      unrated: [...unrated.values()].sort(
        (left, right) => right.requests - left.requests,
      ),
    };
  }

  private async storeResponse(
    options: ProviderCallTrackOptions,
    response: unknown,
  ): Promise<string | undefined> {
    if (!this.fileStorageService) {
      return undefined;
    }

    const day = new Date().toISOString().slice(0, 10);
    const folder = `${PROVIDER_CALL_LOG_S3_FOLDER}/${this.normalizeSegment(
      options.provider,
    )}/${day}`;
    const filename = `${randomUUID()}.json`;

    try {
      await this.fileStorageService.write({
        file: Buffer.from(
          JSON.stringify({
            version: 1,
            fetchedAt: new Date().toISOString(),
            provider: options.provider,
            operation: options.operation,
            request: options.request,
            context: getProviderCallContext(),
            value: response,
          }),
        ),
        name: filename,
        folder,
        mimeType: 'application/json',
      });

      return `${folder}/${filename}`;
    } catch (error) {
      this.logger.warn(
        `Provider call response store failed provider=${options.provider}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return undefined;
    }
  }

  private boundRequest(request: unknown): Record<string, unknown> | null {
    if (request === undefined || request === null) {
      return null;
    }

    try {
      const serialized = JSON.stringify(request);

      if (serialized === undefined) {
        return null;
      }

      if (Buffer.byteLength(serialized) > MAX_REQUEST_BYTES) {
        return {
          truncated: true,
          preview: serialized.slice(0, MAX_REQUEST_BYTES),
        };
      }

      // Cache key parts are usually objects; a bare string or list is
      // wrapped so the column always holds an object
      return typeof request === 'object' && !Array.isArray(request)
        ? (request as Record<string, unknown>)
        : { value: request };
    } catch {
      return { unserializable: true };
    }
  }

  private normalizeSegment(segment: string): string {
    return (
      segment
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'unknown'
    );
  }
}

// For services where the log is optional (tests, scripts): runs the fetcher
// as is when there is no log to record into
export const trackProviderCall = <TResult>(
  providerCallLog: ProviderCallLogService | undefined,
  options: ProviderCallTrackOptions,
  fetcher: () => Promise<TResult>,
): Promise<TResult> =>
  providerCallLog ? providerCallLog.track(options, fetcher) : fetcher();
