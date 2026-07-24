import { Injectable, Logger } from '@nestjs/common';

import axios from 'axios';
import https from 'https';

type BrightDataResidentialProxyRequestOptions = {
  headers?: Record<string, string>;
  timeoutMs?: number;
  usernameSuffix?: string;
  validateStatus?: (status: number) => boolean;
};

type BrightDataResidentialProxyTextResponse = {
  status: number;
  headers: Record<string, unknown>;
  data: string;
};

@Injectable()
export class BrightDataResidentialProxyService {
  private readonly logger = new Logger(BrightDataResidentialProxyService.name);

  private get host(): string | undefined {
    return process.env.BRIGHT_DATA_RESIDENTIAL_PROXY_HOST?.trim() || undefined;
  }

  private get port(): number {
    return Number(process.env.BRIGHT_DATA_RESIDENTIAL_PROXY_PORT ?? 33335);
  }

  private get username(): string | undefined {
    return process.env.BRIGHT_DATA_RESIDENTIAL_PROXY_USERNAME?.trim() || undefined;
  }

  private get password(): string | undefined {
    return process.env.BRIGHT_DATA_RESIDENTIAL_PROXY_PASSWORD?.trim() || undefined;
  }

  private get ignoreSslErrors(): boolean {
    return process.env.BRIGHT_DATA_RESIDENTIAL_IGNORE_SSL_ERRORS !== 'false';
  }

  private get requestTimeoutMs(): number {
    return Number(process.env.BRIGHT_DATA_RESIDENTIAL_PROXY_TIMEOUT_MS ?? 90_000);
  }

  isConfigured(): boolean {
    return Boolean(this.host && this.username && this.password);
  }

  private buildUsername(usernameSuffix?: string): string {
    const username = this.username;

    if (!username) {
      throw new Error('BRIGHT_DATA_RESIDENTIAL_PROXY_USERNAME is not set');
    }

    const trimmedSuffix = usernameSuffix?.trim();

    return trimmedSuffix ? `${username}-${trimmedSuffix}` : username;
  }

  async fetchText(
    url: string,
    options: BrightDataResidentialProxyRequestOptions = {},
  ): Promise<BrightDataResidentialProxyTextResponse> {
    if (!this.isConfigured()) {
      throw new Error(
        'Bright Data residential proxy is not configured. Set BRIGHT_DATA_RESIDENTIAL_PROXY_HOST, BRIGHT_DATA_RESIDENTIAL_PROXY_PORT, BRIGHT_DATA_RESIDENTIAL_PROXY_USERNAME and BRIGHT_DATA_RESIDENTIAL_PROXY_PASSWORD.',
      );
    }

    const response = await axios.get<string>(url, {
      headers: options.headers,
      httpsAgent: this.ignoreSslErrors
        ? new https.Agent({ rejectUnauthorized: false })
        : undefined,
      proxy: {
        protocol: 'http',
        host: this.host ?? '',
        port: this.port,
        auth: {
          username: this.buildUsername(options.usernameSuffix),
          password: this.password ?? '',
        },
      },
      responseType: 'text',
      timeout: options.timeoutMs ?? this.requestTimeoutMs,
      transformResponse: [(data) => String(data)],
      validateStatus:
        options.validateStatus ?? ((status) => status >= 200 && status < 300),
    });

    this.logger.debug(
      `Residential proxy fetched ${url} with status ${response.status}`,
    );

    return {
      status: response.status,
      headers: response.headers,
      data: String(response.data),
    };
  }
}
