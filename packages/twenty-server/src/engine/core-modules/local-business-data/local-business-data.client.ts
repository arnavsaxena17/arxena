import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { type LocalBusinessApiResponse } from 'src/engine/core-modules/local-business-data/types/local-business-data.types';

const DEFAULT_HOST = 'local-business-data.p.rapidapi.com';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;

type QueryParamValue = string | number | boolean | undefined | null;

@Injectable()
export class LocalBusinessDataClient {
  private readonly logger = new Logger(LocalBusinessDataClient.name);

  constructor(private readonly twentyConfigService: TwentyConfigService) {}

  async get<TData>(
    path: string,
    queryParams: Record<string, QueryParamValue>,
  ): Promise<TData> {
    const apiKey = this.twentyConfigService.get('RAPIDAPI_KEY');
    if (!apiKey) {
      throw new HttpException(
        'RAPIDAPI_KEY is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const host =
      this.twentyConfigService.get('RAPIDAPI_LOCAL_BUSINESS_DATA_HOST') ??
      DEFAULT_HOST;

    const url = this.buildUrl(host, path, queryParams);
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.fetchOnce<TData>(url, host, apiKey);
      } catch (error) {
        lastError = error;
        const shouldRetry =
          attempt < MAX_RETRIES && this.isRetryableError(error);

        if (!shouldRetry) {
          throw error;
        }

        const delayMs = RETRY_BASE_DELAY_MS * 2 ** attempt;
        this.logger.warn(
          `Local Business Data retry ${attempt + 1}/${MAX_RETRIES} after ${delayMs}ms for ${path}`,
        );
        await this.sleep(delayMs);
      }
    }

    throw lastError;
  }

  private async fetchOnce<TData>(
    url: string,
    host: string,
    apiKey: string,
  ): Promise<TData> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': host,
        },
        signal: controller.signal,
      });

      const bodyText = await response.text();
      let body: unknown;

      try {
        body = bodyText ? JSON.parse(bodyText) : {};
      } catch {
        body = { message: bodyText };
      }

      if (!response.ok) {
        throw this.mapHttpError(response.status, body);
      }

      return this.unwrapApiBody<TData>(body);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new HttpException(
          'Local Business Data request timed out',
          HttpStatus.GATEWAY_TIMEOUT,
        );
      }

      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Local Business Data request failed',
        HttpStatus.BAD_GATEWAY,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private unwrapApiBody<TData>(body: unknown): TData {
    if (!this.isRecord(body)) {
      throw new HttpException(
        'Unexpected Local Business Data response',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const apiResponse = body as LocalBusinessApiResponse<TData>;

    if (apiResponse.status === 'ERROR') {
      const message =
        apiResponse.error?.message ?? 'Local Business Data API error';
      const code = apiResponse.error?.code ?? HttpStatus.BAD_REQUEST;

      throw new HttpException(message, this.normalizeStatusCode(code));
    }

    if (apiResponse.status === 'OK' && 'data' in apiResponse) {
      return apiResponse.data;
    }

    // Gateway-shaped errors sometimes lack status/data
    if ('message' in body && typeof body.message === 'string') {
      throw new HttpException(body.message, HttpStatus.BAD_GATEWAY);
    }

    throw new HttpException(
      'Unexpected Local Business Data response',
      HttpStatus.BAD_GATEWAY,
    );
  }

  private mapHttpError(status: number, body: unknown): HttpException {
    const message = this.extractErrorMessage(body) ?? `HTTP ${status}`;

    if (status === 429) {
      return new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
    }

    if (status === 403) {
      return new HttpException(message, HttpStatus.FORBIDDEN);
    }

    if (status === 404) {
      return new HttpException(message, HttpStatus.NOT_FOUND);
    }

    if (status >= 500) {
      return new HttpException(message, HttpStatus.BAD_GATEWAY);
    }

    return new HttpException(message, this.normalizeStatusCode(status));
  }

  private extractErrorMessage(body: unknown): string | undefined {
    if (!this.isRecord(body)) {
      return undefined;
    }

    if (typeof body.message === 'string') {
      return body.message;
    }

    const error = body.error;
    if (this.isRecord(error) && typeof error.message === 'string') {
      return error.message;
    }

    return undefined;
  }

  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof HttpException)) {
      return false;
    }

    const status = error.getStatus();

    return (
      status === HttpStatus.TOO_MANY_REQUESTS ||
      status === HttpStatus.BAD_GATEWAY ||
      status === HttpStatus.GATEWAY_TIMEOUT ||
      status === HttpStatus.SERVICE_UNAVAILABLE
    );
  }

  private buildUrl(
    host: string,
    path: string,
    queryParams: Record<string, QueryParamValue>,
  ): string {
    const url = new URL(`https://${host}${path}`);

    for (const [key, value] of Object.entries(queryParams)) {
      if (value === undefined || value === null || value === '') {
        continue;
      }

      url.searchParams.set(key, String(value));
    }

    return url.toString();
  }

  private normalizeStatusCode(code: number): number {
    if (code >= 400 && code < 600) {
      return code;
    }

    return HttpStatus.BAD_REQUEST;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
