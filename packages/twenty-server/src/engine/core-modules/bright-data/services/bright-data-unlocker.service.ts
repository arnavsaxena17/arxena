import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export type BrightDataActiveZone = {
  name: string;
  type?: string;
};

export type BrightDataUnlockerResponse = {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
};

@Injectable()
export class BrightDataUnlockerService {
  private readonly logger = new Logger(BrightDataUnlockerService.name);

  private get apiKey(): string | undefined {
    return process.env.BRIGHT_DATA_API_KEY?.trim() || undefined;
  }

  private get configuredZone(): string | undefined {
    return process.env.BRIGHT_DATA_UNLOCKER_ZONE?.trim() || undefined;
  }

  private get requestTimeoutMs(): number {
    return Number(process.env.BRIGHT_DATA_UNLOCKER_REQUEST_TIMEOUT_MS ?? 300_000);
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  private async postJson<T>(url: string, payload: Record<string, unknown>): Promise<T> {
    const key = this.apiKey;

    if (!key) {
      throw new Error('BRIGHT_DATA_API_KEY is not set');
    }

    const response = await axios.post<string>(url, payload, {
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      responseType: 'text',
      timeout: this.requestTimeoutMs,
      transformResponse: [(data) => String(data)],
    });
    const text = String(response.data);

    return JSON.parse(text) as T;
  }

  private async postRawText(
    url: string,
    payload: Record<string, unknown>,
  ): Promise<{ status: number; headers: Headers; body: string }> {
    const key = this.apiKey;

    if (!key) {
      throw new Error('BRIGHT_DATA_API_KEY is not set');
    }

    const response = await axios.post<string>(url, payload, {
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      responseType: 'text',
      timeout: this.requestTimeoutMs,
      transformResponse: [(data) => String(data)],
    });
    const body = String(response.data);

    return {
      status: response.status,
      headers: new Headers(
        Object.entries(response.headers).map(
          ([k, v]) => [k, String(v)] as [string, string],
        ),
      ),
      body,
    };
  }

  async listActiveZones(): Promise<BrightDataActiveZone[]> {
    const key = this.apiKey;

    if (!key) {
      return [];
    }

    const response = await axios.get<string>(
      'https://api.brightdata.com/zone/get_active_zones',
      {
        headers: {
          Authorization: `Bearer ${key}`,
        },
        responseType: 'text',
        timeout: this.requestTimeoutMs,
        transformResponse: [(data) => String(data)],
      },
    );
    const text = String(response.data);

    const parsed = JSON.parse(text) as BrightDataActiveZone[];

    return Array.isArray(parsed) ? parsed : [];
  }

  async resolveUnlockerZoneName(): Promise<string | null> {
    if (this.configuredZone) {
      return this.configuredZone;
    }

    const zones = await this.listActiveZones();
    const unlockerZone = zones.find((zone) => {
      const name = zone.name?.toLowerCase() ?? '';
      const type = zone.type?.toLowerCase() ?? '';

      return name.includes('unlocker') || type.includes('unlocker');
    });

    return unlockerZone?.name ?? null;
  }

  async requestRaw(input: {
    url: string;
    country?: string;
  }): Promise<BrightDataUnlockerResponse> {
    const zone = await this.resolveUnlockerZoneName();

    if (!zone) {
      throw new Error(
        'No Bright Data Unlocker zone is configured. Set BRIGHT_DATA_UNLOCKER_ZONE or create an active Unlocker API zone in Bright Data.',
      );
    }

    const response = await this.postRawText('https://api.brightdata.com/request', {
      zone,
      url: input.url,
      format: 'raw',
      ...(input.country ? { country: input.country } : {}),
    });

    return {
      statusCode: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: response.body,
    };
  }
}
