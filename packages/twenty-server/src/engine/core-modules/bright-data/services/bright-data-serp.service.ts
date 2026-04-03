import { Injectable, Logger } from '@nestjs/common';

import type { BrightDataSerpGoogleJson } from 'src/engine/core-modules/bright-data/types/bright-data-serp.types';

const BRIGHT_DATA_REQUEST_URL = 'https://api.brightdata.com/request';

@Injectable()
export class BrightDataSerpService {
  private readonly logger = new Logger(BrightDataSerpService.name);

  private get apiKey(): string | undefined {
    return process.env.BRIGHT_DATA_API_KEY?.trim() || undefined;
  }

  private get zone(): string {
    return process.env.BRIGHT_DATA_SERP_ZONE?.trim() || 'serp_api';
  }

  private get requestTimeoutMs(): number {
    return Number(process.env.BRIGHT_DATA_REQUEST_TIMEOUT_MS ?? 90_000);
  }

  /** True when `BRIGHT_DATA_API_KEY` is set (SERP calls will work). */
  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Runs a Bright Data SERP zone request for a fully qualified Google search URL.
   * Uses `format: json` so the response includes a structured `organic` array when available.
   */
  async requestSerpGoogleJson(searchUrl: string): Promise<BrightDataSerpGoogleJson> {
    const key = this.apiKey;
    if (!key) {
      throw new Error('BRIGHT_DATA_API_KEY is not set');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await fetch(BRIGHT_DATA_REQUEST_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          zone: this.zone,
          url: searchUrl,
          format: 'json',
        }),
        signal: controller.signal,
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

      return this.parseSerpJsonBody(rawText);
    } finally {
      clearTimeout(timeout);
    }
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
}
