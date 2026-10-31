import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { randomUUID } from 'crypto';

import { Repository } from 'typeorm';

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
        cacheStatus: 'error',
        durationMs: Date.now() - startedAt,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
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
