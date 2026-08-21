import { Injectable } from '@nestjs/common';

import {
  LINKEDIN_ACCOUNT_RATE_LIMITS_KEY,
  WHATSAPP_ACCOUNT_RATE_LIMITS_KEY,
  parseLinkedinAccountRateLimitsMap,
  parseWhatsappAccountRateLimitsMap,
  sanitizeLinkedinAccountRateLimits,
  sanitizeWhatsappAccountRateLimits,
  type LinkedinAccountRateLimits,
  type WhatsappAccountRateLimits,
} from 'twenty-shared/arx';

import { RedisService } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/redis-service-ops';
import { KeyValuePairType } from 'src/engine/core-modules/key-value-pair/key-value-pair.entity';
import { KeyValuePairService } from 'src/engine/core-modules/key-value-pair/key-value-pair.service';

const CONFIG_CACHE_PREFIX = 'account-rate-limits-config:';

@Injectable()
export class AccountRateLimitConfigService {
  constructor(
    private readonly keyValuePairService: KeyValuePairService,
    private readonly redisService: RedisService,
  ) {}

  async getLinkedinLimits(
    workspaceId: string,
    accountId: string,
  ): Promise<LinkedinAccountRateLimits> {
    const map = await this.getLinkedinMap(workspaceId);
    const limits = sanitizeLinkedinAccountRateLimits(map[accountId]);
    await this.cacheLimits('linkedin', accountId, limits);
    return limits;
  }

  async getWhatsappLimits(
    workspaceId: string,
    accountId: string,
  ): Promise<WhatsappAccountRateLimits> {
    const map = await this.getWhatsappMap(workspaceId);
    const limits = sanitizeWhatsappAccountRateLimits(map[accountId]);
    await this.cacheLimits('whatsapp', accountId, limits);
    return limits;
  }

  async saveLinkedinLimits(
    workspaceId: string,
    accountId: string,
    limits: Partial<LinkedinAccountRateLimits>,
  ): Promise<LinkedinAccountRateLimits> {
    const sanitized = sanitizeLinkedinAccountRateLimits(limits);
    const map = await this.getLinkedinMap(workspaceId);
    map[accountId] = sanitized;
    await this.setWorkspaceValue(
      workspaceId,
      LINKEDIN_ACCOUNT_RATE_LIMITS_KEY,
      map,
    );
    await this.cacheLimits('linkedin', accountId, sanitized);
    return sanitized;
  }

  async saveWhatsappLimits(
    workspaceId: string,
    accountId: string,
    limits: Partial<WhatsappAccountRateLimits>,
  ): Promise<WhatsappAccountRateLimits> {
    const sanitized = sanitizeWhatsappAccountRateLimits(limits);
    const map = await this.getWhatsappMap(workspaceId);
    map[accountId] = sanitized;
    await this.setWorkspaceValue(
      workspaceId,
      WHATSAPP_ACCOUNT_RATE_LIMITS_KEY,
      map,
    );
    await this.cacheLimits('whatsapp', accountId, sanitized);
    return sanitized;
  }

  async readCachedLinkedinLimits(
    accountId: string,
  ): Promise<LinkedinAccountRateLimits | null> {
    return this.readCachedLimits<LinkedinAccountRateLimits>(
      'linkedin',
      accountId,
    );
  }

  async readCachedWhatsappLimits(
    accountId: string,
  ): Promise<WhatsappAccountRateLimits | null> {
    return this.readCachedLimits<WhatsappAccountRateLimits>(
      'whatsapp',
      accountId,
    );
  }

  private async getLinkedinMap(workspaceId: string) {
    const raw = await this.getWorkspaceValue(
      workspaceId,
      LINKEDIN_ACCOUNT_RATE_LIMITS_KEY,
    );
    return parseLinkedinAccountRateLimitsMap(raw);
  }

  private async getWhatsappMap(workspaceId: string) {
    const raw = await this.getWorkspaceValue(
      workspaceId,
      WHATSAPP_ACCOUNT_RATE_LIMITS_KEY,
    );
    return parseWhatsappAccountRateLimitsMap(raw);
  }

  private async getWorkspaceValue(workspaceId: string, key: string) {
    const rows = await this.keyValuePairService.get({
      userId: null,
      workspaceId,
      type: KeyValuePairType.USER_VARIABLE,
      key,
    });
    return rows[0]?.value;
  }

  private async setWorkspaceValue(
    workspaceId: string,
    key: string,
    value: unknown,
  ) {
    await this.keyValuePairService.set({
      userId: null,
      workspaceId,
      key,
      value: value as JSON,
      type: KeyValuePairType.USER_VARIABLE,
    });
  }

  private configCacheKey(provider: 'linkedin' | 'whatsapp', accountId: string) {
    return `${CONFIG_CACHE_PREFIX}${provider}:${accountId}`;
  }

  private async cacheLimits(
    provider: 'linkedin' | 'whatsapp',
    accountId: string,
    limits: LinkedinAccountRateLimits | WhatsappAccountRateLimits,
  ) {
    await this.redisService.setString(
      this.configCacheKey(provider, accountId),
      JSON.stringify(limits),
    );
  }

  private async readCachedLimits<T>(
    provider: 'linkedin' | 'whatsapp',
    accountId: string,
  ): Promise<T | null> {
    const raw = await this.redisService.getString(
      this.configCacheKey(provider, accountId),
    );
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
}
