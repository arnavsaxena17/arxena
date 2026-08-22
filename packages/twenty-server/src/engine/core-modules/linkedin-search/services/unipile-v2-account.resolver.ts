import { Injectable, Logger } from '@nestjs/common';

import {
  findUnipileV2AccountId,
  isUnipileV2AccountId,
  type UnipileV2AccountListItem,
} from '../utils/unipile-v2-account-id.util';

const LIST_PAGE_SIZE = 100;

@Injectable()
export class UnipileV2AccountResolver {
  private readonly logger = new Logger(UnipileV2AccountResolver.name);
  private readonly v1ToV2 = new Map<string, string>();

  getCredentials(): { baseUrl: string; apiKey: string } {
    const baseUrl = process.env.UNIPILE_API_URL_V2?.trim();
    const apiKey = process.env.UNIPILE_ACCESS_TOKEN_V2?.trim();
    if (!baseUrl || !apiKey) {
      throw new Error(
        'Unipile v2 is not configured (UNIPILE_API_URL_V2 / UNIPILE_ACCESS_TOKEN_V2)',
      );
    }

    return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey };
  }

  async resolveAccountId(accountId: string): Promise<string> {
    const trimmed = accountId.trim();
    if (!trimmed) {
      throw new Error('Unipile account id is required for v2 browse');
    }

    if (isUnipileV2AccountId(trimmed)) {
      return trimmed;
    }

    const cached = this.v1ToV2.get(trimmed);
    if (cached) {
      return cached;
    }

    const { baseUrl, apiKey } = this.getCredentials();
    const mapped = await this.findMappedAccountId(baseUrl, apiKey, trimmed);
    if (!mapped) {
      throw new Error(
        `No Unipile v2 account maps to v1 account ${trimmed} (metadata.v1_account_id)`,
      );
    }

    this.logger.log(`Mapped Unipile v1 account ${trimmed} to v2 ${mapped}`);
    this.v1ToV2.set(trimmed, mapped);

    return mapped;
  }

  private async findMappedAccountId(
    baseUrl: string,
    apiKey: string,
    v1AccountId: string,
  ): Promise<string | null> {
    let offset = 0;

    for (;;) {
      const url = `${baseUrl}/v2/accounts?provider=linkedin&limit=${LIST_PAGE_SIZE}&offset=${offset}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-API-KEY': apiKey,
        },
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(
          `Unipile v2 list accounts failed: ${response.status} ${body}`.trim(),
        );
      }

      const payload = (await response.json()) as {
        data?: UnipileV2AccountListItem[];
        has_more?: boolean;
      };
      const mapped = findUnipileV2AccountId(payload.data ?? [], v1AccountId);
      if (mapped) {
        return mapped;
      }

      if (!payload.has_more) {
        return null;
      }

      offset += LIST_PAGE_SIZE;
    }
  }
}
