// src/engine/core-modules/redis/redis.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Redis } from 'ioredis';

import { RESERVE_MULTI_WINDOW_SLOT_LUA } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-slot.util';

@Injectable()
export class RedisService implements OnModuleInit {
  private redisClient: Redis;

  constructor(private configService: ConfigService) {
    this.redisClient = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD', ''),
    });
  }

  async onModuleInit() {
    try {
      await this.redisClient.ping();
      console.log('Redis connection established');
    } catch (error) {
      console.error('Redis connection failed:', error);
    }
  }

  private isLinkedInUrl(identifier: string): boolean {
    return identifier.includes('linkedin.com');
  }

  async createIdentifierToUserMapping(
    identifier: string,
    userId: string,
  ): Promise<void> {
    await this.redisClient.set(`identifier_to_user:${identifier}`, userId);
  }

  async getUserIdForIdentifier(identifier: string): Promise<string | null> {
    const userId = await this.redisClient.get(
      `identifier_to_user:${identifier}`,
    );

    return userId;
  }

  async getUserIdForPhoneNumber(phoneNumber: string): Promise<string | null> {
    return this.getUserIdForIdentifier(phoneNumber);
  }

  async createPhoneToUserMapping(
    phoneNumber: string,
    userId: string,
  ): Promise<void> {
    await this.createIdentifierToUserMapping(phoneNumber, userId);
  }

  // Whitelist operations
  async addToWhitelist(userId: string, phoneNumber: string): Promise<void> {
    await this.redisClient.sadd(`whitelist:user:${userId}`, phoneNumber);
  }

  async removeFromWhitelist(userId: string, phoneNumber: string): Promise<void> {
    await this.redisClient.srem(`whitelist:user:${userId}`, phoneNumber);
  }

  async removeIdentifierToUserMapping(identifier: string): Promise<void> {
    await this.redisClient.del(`identifier_to_user:${identifier}`);
  }

  async isWhitelisted(userId: string, identifier: string): Promise<boolean> {
    console.log(
      `Checking whitelist for user: ${userId} with identifier: ${identifier}`,
    );

    // Get all members and check manually first
    const allMembers = await this.redisClient.smembers(
      `whitelist:user:${userId}`,
    );
    const manualCheck = allMembers.includes(identifier);

    // Also try the Redis sismember command
    const redisCheck = await this.redisClient.sismember(
      `whitelist:user:${userId}`,
      identifier,
    );

    console.log(`Manual check: ${identifier} exists in set: ${manualCheck}`);
    console.log(`Redis check result: ${redisCheck} for ${identifier}`);

    return !!redisCheck;
  }

  async loadWhitelist(userId: string, phoneNumbers: string[]): Promise<void> {
    if (phoneNumbers.length === 0) return;
    const existingNumbers = await this.redisClient.smembers(
      `whitelist:user:${userId}`,
    );

    console.log(
      `BEFORE: Redis set for user ${userId} contains ${existingNumbers.length} numbers`,
    );

    // Normalize the phone numbers (remove any quotes, etc.)
    const normalizedNumbers = phoneNumbers.map((num) =>
      num.replace(/['"`]/g, '').trim(),
    );

    // Add to Redis (using pipeline for efficiency)
    const pipeline = this.redisClient.pipeline();

    normalizedNumbers.forEach((number) => {
      pipeline.sadd(`whitelist:user:${userId}`, number);
    });
    await pipeline.exec();

    // Verify addition
    const updatedNumbers = await this.redisClient.smembers(
      `whitelist:user:${userId}`,
    );

    console.log(
      `AFTER: Redis set for user ${userId} now contains ${updatedNumbers.length} numbers`,
    );

    // Check if a specific number is now in the set (the one from logs)
    const testNumber = '918411937769@c.us';
    const isInSet = updatedNumbers.includes(testNumber);

    console.log(`Test: Is ${testNumber} in the updated set? ${isInSet}`);
  }

  async getWhitelist(userId: string): Promise<string[]> {
    const whitelist = await this.redisClient.smembers(
      `whitelist:user:${userId}`,
    );
    return whitelist;
  }

  // Message processing operations
  async markMessageAsProcessed(
    userId: string,
    messageId: string,
  ): Promise<void> {
    console.log("Mrkeing message as processed::", userId, messageId)
    await this.redisClient.sadd(`processed_messages:user:${userId}`, messageId);
  }

  async isMessageProcessed(
    userId: string,
    messageId: string,
  ): Promise<boolean> {
    console.log("Checking if message is processed::", userId, messageId)
    const isProcessed =  !!(await this.redisClient.sismember( `processed_messages:user:${userId}`, messageId, ))
    return isProcessed;
  }

  // Optional - cleanup old processed messages (run periodically)
  async cleanupOldProcessedMessages(
    userId: string,
    maxMessages = 10000,
  ): Promise<void> {
    const count = await this.redisClient.scard(
      `processed_messages:user:${userId}`,
    );

    if (count > maxMessages) {
      const toRemove = count - maxMessages;
      const members = await this.redisClient.smembers(
        `processed_messages:user:${userId}`,
      );

      await this.redisClient.srem(
        `processed_messages:user:${userId}`,
        ...members.slice(0, toRemove),
      );
    }
  }

  /**
   * Atomically try to acquire a slot in a Redis sorted-set sliding window.
   * Returns acquired=true when the caller may proceed; otherwise waitMs until retry.
   */
  async tryAcquireSlidingWindowSlot(
    key: string,
    windowMs: number,
    limit: number,
    member: string,
    now: number,
  ): Promise<{ acquired: boolean; waitMs: number }> {
    const script = `
      local key = KEYS[1]
      local now = tonumber(ARGV[1])
      local window = tonumber(ARGV[2])
      local limit = tonumber(ARGV[3])
      local member = ARGV[4]
      redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
      local count = redis.call('ZCARD', key)
      if count < limit then
        redis.call('ZADD', key, now, member)
        redis.call('EXPIRE', key, math.ceil(window / 1000) * 2)
        return 0
      end
      local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
      if #oldest >= 2 then
        return tonumber(oldest[2]) + window - now
      end
      return window
    `;

    const result = (await this.redisClient.eval(
      script,
      1,
      key,
      String(now),
      String(windowMs),
      String(limit),
      member,
    )) as number;

    if (result === 0) {
      return { acquired: true, waitMs: 0 };
    }

    return { acquired: false, waitMs: Math.max(100, Math.ceil(result)) };
  }

  async tryAcquireMultiWindowSlots(
    windows: Array<{
      key: string;
      windowMs: number;
      limit: number;
      pace?: boolean;
    }>,
    member: string,
    now: number,
  ): Promise<{ acquired: boolean; waitMs: number }> {
    if (windows.length === 0) {
      return { acquired: true, waitMs: 0 };
    }

    const args: string[] = [
      String(now),
      member,
      String(windows.length),
      ...windows.flatMap((window) => [
        String(window.windowMs),
        String(window.limit),
        window.pace === true ? '1' : '0',
      ]),
    ];

    const result = (await this.redisClient.eval(
      RESERVE_MULTI_WINDOW_SLOT_LUA,
      windows.length,
      ...windows.map((window) => window.key),
      ...args,
    )) as number;

    if (result === 0) {
      return { acquired: true, waitMs: 0 };
    }

    return { acquired: false, waitMs: Math.max(100, Math.ceil(result)) };
  }

  async removeMemberFromWindows(
    keys: string[],
    member: string,
  ): Promise<number> {
    if (keys.length === 0 || !member.trim()) {
      return 0;
    }

    const pipeline = this.redisClient.pipeline();
    for (const [index, key] of keys.entries()) {
      pipeline.zrem(key, `${member}:${index + 1}`);
    }

    const results = await pipeline.exec();
    return (results ?? []).reduce((sum, result) => {
      const count = result?.[1];
      return sum + (typeof count === 'number' ? count : 0);
    }, 0);
  }

  async addSetMembers(
    key: string,
    members: string[],
    ttlSeconds: number,
  ): Promise<void> {
    if (members.length === 0) {
      return;
    }

    await this.redisClient.sadd(key, ...members);
    if (ttlSeconds > 0) {
      await this.redisClient.expire(key, ttlSeconds);
    }
  }

  async getSetMembers(key: string): Promise<string[]> {
    return this.redisClient.smembers(key);
  }

  async removeSetMembers(key: string, members: string[]): Promise<void> {
    if (members.length === 0) {
      return;
    }

    await this.redisClient.srem(key, ...members);
  }

  async countSlidingWindowMembers(
    windows: Array<{ key: string; windowMs: number; maxScore?: number | '+inf' }>,
    now: number,
  ): Promise<number[]> {
    if (windows.length === 0) {
      return [];
    }

    const pipeline = this.redisClient.pipeline();
    for (const window of windows) {
      const maxScore = window.maxScore ?? '+inf';
      pipeline.zcount(
        window.key,
        `(${now - window.windowMs}`,
        maxScore === '+inf' ? '+inf' : maxScore,
      );
    }

    const results = await pipeline.exec();
    return windows.map((_, index) => {
      const result = results?.[index];
      if (!result) {
        return 0;
      }

      const [error, count] = result;
      if (error || typeof count !== 'number' || !Number.isFinite(count)) {
        return 0;
      }

      return Math.max(0, Math.floor(count));
    });
  }

  async getString(key: string): Promise<string | null> {
    return this.redisClient.get(key);
  }

  async setString(key: string, value: string): Promise<void> {
    await this.redisClient.set(key, value);
  }

  async deleteKeys(...keys: string[]): Promise<number> {
    if (keys.length === 0) {
      return 0;
    }

    return this.redisClient.del(...keys);
  }

  async deleteByPattern(pattern: string): Promise<number> {
    let cursor = '0';
    let deleted = 0;

    do {
      const [nextCursor, keys] = await this.redisClient.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        deleted += await this.redisClient.del(...keys);
      }
    } while (cursor !== '0');

    return deleted;
  }
}
