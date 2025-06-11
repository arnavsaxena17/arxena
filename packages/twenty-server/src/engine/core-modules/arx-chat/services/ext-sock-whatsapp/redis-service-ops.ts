// src/engine/core-modules/redis/redis.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Redis } from 'ioredis';

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
    console.log(
      `Loading whitelist for user ${userId} with ${phoneNumbers.length} phone numbers`,
    );

    // Check what's already in the whitelist
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
}
