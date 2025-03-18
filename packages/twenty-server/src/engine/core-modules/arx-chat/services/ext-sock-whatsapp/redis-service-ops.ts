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

  async createPhoneToUserMapping(
    phoneNumber: string,
    userId: string,
  ): Promise<void> {
    await this.redisClient.set(`phone_to_user:${phoneNumber}`, userId);
  }

  async getUserIdForPhoneNumber(phoneNumber: string): Promise<string | null> {
    const userId = await this.redisClient.get(`phone_to_user:${phoneNumber}`);

    return userId;
  }

  // Whitelist operations
  async addToWhitelist(userId: string, phoneNumber: string): Promise<void> {
    await this.redisClient.sadd(`whitelist:user:${userId}`, phoneNumber);
  }

  async isWhitelisted(userId: string, phoneNumber: string): Promise<boolean> {
    console.log(
      `Checking whitelist for user: ${userId} with phone: ${phoneNumber}`,
    );

    // Get all members and check manually first
    const allMembers = await this.redisClient.smembers(
      `whitelist:user:${userId}`,
    );
    const manualCheck = allMembers.includes(phoneNumber);

    // Also try the Redis sismember command
    const redisCheck = await this.redisClient.sismember(
      `whitelist:user:${userId}`,
      phoneNumber,
    );

    console.log(`Manual check: ${phoneNumber} exists in set: ${manualCheck}`);
    console.log(`Redis check result: ${redisCheck} for ${phoneNumber}`);

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

    console.log(' This is the whitelist', whitelist);

    return whitelist;
  }

  // Message processing operations
  async markMessageAsProcessed(
    userId: string,
    messageId: string,
  ): Promise<void> {
    await this.redisClient.sadd(`processed_messages:user:${userId}`, messageId);
  }

  async isMessageProcessed(
    userId: string,
    messageId: string,
  ): Promise<boolean> {
    return !!(await this.redisClient.sismember(
      `processed_messages:user:${userId}`,
      messageId,
    ));
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
