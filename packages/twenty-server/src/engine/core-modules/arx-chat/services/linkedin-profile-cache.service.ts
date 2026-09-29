import { Injectable, Logger } from '@nestjs/common';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';

import {
  LinkedinProfileS3Service,
  type LinkedinProfileS3Envelope,
} from './linkedin-profile-s3.service';

const REDIS_TTL_MS = 24 * 60 * 60 * 1000;

type CachedProfileEnvelope<T> = LinkedinProfileS3Envelope<T>;
type CachedPostsEnvelope<T> = {
  fetchedAt: string;
  posts: T;
};

// Redis (24h) + durable S3 fallback (no age expiry) for LinkedIn profile
// and user-posts payloads keyed by public identifier / provider id.
@Injectable()
export class LinkedinProfileCacheService {
  private readonly logger = new Logger(LinkedinProfileCacheService.name);

  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineOrgChart)
    private readonly cacheStorage: CacheStorageService,
    private readonly linkedinProfileS3Service: LinkedinProfileS3Service,
  ) {}

  private buildUserRedisKey(publicIdentifier: string): string {
    return `linkedin-user:${publicIdentifier.trim().toLowerCase()}`;
  }

  private buildUserPostsRedisKey(publicIdentifier: string): string {
    return `linkedin-user-posts:${publicIdentifier.trim().toLowerCase()}`;
  }

  private buildCompanyRedisKey(publicIdentifier: string): string {
    return `linkedin-company:${publicIdentifier.trim().toLowerCase()}`;
  }

  async getLinkedinUserProfile<T extends Record<string, unknown>>(
    publicIdentifier: string,
  ): Promise<T | null> {
    const slug = publicIdentifier.trim();
    if (!slug) {
      return null;
    }

    const redisKey = this.buildUserRedisKey(slug);
    const cachedRedis =
      await this.cacheStorage.get<CachedProfileEnvelope<T>>(redisKey);
    if (cachedRedis?.profile) {
      this.logger.log(`LinkedIn user profile Redis cache HIT for ${slug}`);
      return cachedRedis.profile;
    }

    const cachedS3 =
      await this.linkedinProfileS3Service.getLinkedinUserProfile<T>(slug);
    if (cachedS3) {
      await this.cacheStorage.set(
        redisKey,
        { fetchedAt: new Date().toISOString(), profile: cachedS3 },
        REDIS_TTL_MS,
      );
      return cachedS3;
    }

    return null;
  }

  async saveLinkedinUserProfile<T extends Record<string, unknown>>(
    publicIdentifier: string,
    profile: T,
  ): Promise<void> {
    const slug = publicIdentifier.trim();
    if (!slug) {
      return;
    }

    const envelope: CachedProfileEnvelope<T> = {
      fetchedAt: new Date().toISOString(),
      profile,
    };

    await Promise.all([
      this.cacheStorage.set(
        this.buildUserRedisKey(slug),
        envelope,
        REDIS_TTL_MS,
      ),
      this.linkedinProfileS3Service.saveLinkedinUserProfile(slug, profile),
    ]);
  }

  async getLinkedinUserPosts<T>(publicIdentifier: string): Promise<T | null> {
    const slug = publicIdentifier.trim();
    if (!slug) {
      return null;
    }

    const redisKey = this.buildUserPostsRedisKey(slug);
    const cachedRedis =
      await this.cacheStorage.get<CachedPostsEnvelope<T>>(redisKey);
    if (cachedRedis?.posts !== undefined && cachedRedis?.posts !== null) {
      this.logger.log(`LinkedIn user posts Redis cache HIT for ${slug}`);
      return cachedRedis.posts;
    }

    const cachedS3 =
      await this.linkedinProfileS3Service.getLinkedinUserPosts<T>(slug);
    if (cachedS3 !== null && cachedS3 !== undefined) {
      await this.cacheStorage.set(
        redisKey,
        { fetchedAt: new Date().toISOString(), posts: cachedS3 },
        REDIS_TTL_MS,
      );
      return cachedS3;
    }

    return null;
  }

  async saveLinkedinUserPosts<T>(
    publicIdentifier: string,
    posts: T,
  ): Promise<void> {
    const slug = publicIdentifier.trim();
    if (!slug) {
      return;
    }

    const envelope: CachedPostsEnvelope<T> = {
      fetchedAt: new Date().toISOString(),
      posts,
    };

    await Promise.all([
      this.cacheStorage.set(
        this.buildUserPostsRedisKey(slug),
        envelope,
        REDIS_TTL_MS,
      ),
      this.linkedinProfileS3Service.saveLinkedinUserPosts(slug, posts),
    ]);
  }

  async getLinkedinCompanyProfile<T extends Record<string, unknown>>(
    publicIdentifier: string,
  ): Promise<T | null> {
    const slug = publicIdentifier.trim();
    if (!slug) {
      return null;
    }

    const redisKey = this.buildCompanyRedisKey(slug);
    const cachedRedis = await this.cacheStorage.get<T>(redisKey);
    if (cachedRedis) {
      this.logger.log(`LinkedIn company profile Redis cache HIT for ${slug}`);
      return cachedRedis;
    }

    const cachedS3 =
      await this.linkedinProfileS3Service.getLinkedinCompanyProfile<T>(slug);
    if (cachedS3) {
      await this.cacheStorage.set(redisKey, cachedS3, REDIS_TTL_MS);
      return cachedS3;
    }

    return null;
  }

  async saveLinkedinCompanyProfile<T extends Record<string, unknown>>(
    publicIdentifier: string,
    profile: T,
  ): Promise<void> {
    const slug = publicIdentifier.trim();
    if (!slug) {
      return;
    }

    await Promise.all([
      this.cacheStorage.set(
        this.buildCompanyRedisKey(slug),
        profile,
        REDIS_TTL_MS,
      ),
      this.linkedinProfileS3Service.saveLinkedinCompanyProfile(slug, profile),
    ]);
  }
}
