import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import type {
    DeletedMessageContentCacheEntry,
    SaveDeletedMessagePayload,
} from '../types/deleted-message.types';
import {
    buildDeletedMessageContentCacheEntry,
    buildDeletedMessageEntry,
    normalizeDeletedMessagesStore,
} from './unipile-deleted-message.util';

const DELETED_MESSAGE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class UnipileAttachmentStorageUtil {
  private readonly logger = new Logger(UnipileAttachmentStorageUtil.name);
  private readonly baseAttachmentsDir: string;
  private readonly deletedMessagesFile: string;
  private readonly deletedMessageContentCacheFile: string;

  constructor(baseDir?: string) {
    // Use provided directory or default to a 'unipile-attachments' folder in the project root
    this.baseAttachmentsDir = baseDir || path.join(process.cwd(), 'unipile-attachments');
    this.deletedMessagesFile = path.join(this.baseAttachmentsDir, 'deleted-messages.json');
    this.deletedMessageContentCacheFile = path.join(
      this.baseAttachmentsDir,
      'deleted-message-content-cache.json',
    );
    
    // Ensure base directory exists
    this.ensureDirectoryExists(this.baseAttachmentsDir);
  }
  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      this.logger.log(`Created directory: ${dirPath}`);
    }
  }

  private readDeletedMessageContentCache(): Record<
    string,
    DeletedMessageContentCacheEntry
  > {
    if (!fs.existsSync(this.deletedMessageContentCacheFile)) {
      return {};
    }

    try {
      const fileContent = fs.readFileSync(
        this.deletedMessageContentCacheFile,
        'utf-8',
      );
      const parsed = JSON.parse(fileContent) as Record<
        string,
        DeletedMessageContentCacheEntry
      >;

      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      this.logger.warn(
        'Error reading deleted message content cache, creating new one:',
        error,
      );

      return {};
    }
  }

  private writeDeletedMessageContentCache(
    cache: Record<string, DeletedMessageContentCacheEntry>,
  ): void {
    const cutoff = Date.now() - DELETED_MESSAGE_CACHE_TTL_MS;
    const prunedCache = Object.fromEntries(
      Object.entries(cache).filter(([, entry]) => {
        const cachedAt = Date.parse(entry.cached_at);

        return Number.isFinite(cachedAt) && cachedAt >= cutoff;
      }),
    );

    fs.writeFileSync(
      this.deletedMessageContentCacheFile,
      JSON.stringify(prunedCache, null, 2),
    );
  }

  /**
   * Cache message content so delete webhooks with empty bodies can still be recovered.
   */
  async cacheMessageContentForDeletionTracking(
    payload: SaveDeletedMessagePayload,
  ): Promise<void> {
    try {
      if (!payload.message?.trim()) {
        return;
      }

      const cache = this.readDeletedMessageContentCache();
      cache[payload.message_id] = buildDeletedMessageContentCacheEntry(payload);
      this.writeDeletedMessageContentCache(cache);
    } catch (error) {
      this.logger.error(
        `Error caching message content for deletion tracking ${payload.message_id}:`,
        error,
      );
    }
  }

  /**
   * Save deleted message details to deleted-messages.json, split by individual and group chats.
   */
  async saveDeletedMessage(payload: SaveDeletedMessagePayload): Promise<void> {
    try {
      const deletedAt = new Date().toISOString();
      const cache = this.readDeletedMessageContentCache();
      const cachedEntry = cache[payload.message_id] ?? null;
      const deletedMessageEntry = buildDeletedMessageEntry(
        payload,
        deletedAt,
        cachedEntry,
      );

      let deletedMessagesStore = normalizeDeletedMessagesStore(null);
      if (fs.existsSync(this.deletedMessagesFile)) {
        try {
          const fileContent = fs.readFileSync(this.deletedMessagesFile, 'utf-8');
          deletedMessagesStore = normalizeDeletedMessagesStore(
            JSON.parse(fileContent),
          );
        } catch (error) {
          this.logger.warn('Error reading deleted messages file, creating new one:', error);
        }
      }

      const targetBucket =
        deletedMessageEntry.conversation_type === 'group'
          ? 'groups'
          : 'individual';
      deletedMessagesStore[targetBucket].push(deletedMessageEntry);

      fs.writeFileSync(
        this.deletedMessagesFile,
        JSON.stringify(deletedMessagesStore, null, 2),
      );

      delete cache[payload.message_id];
      this.writeDeletedMessageContentCache(cache);

      this.logger.log(
        `Saved deleted ${deletedMessageEntry.conversation_type} message entry: ${payload.message_id}`,
      );
    } catch (error) {
      this.logger.error('Error saving deleted message:', error);
    }
  }
}
