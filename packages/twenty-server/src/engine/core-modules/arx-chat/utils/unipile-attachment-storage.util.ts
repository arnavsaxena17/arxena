import { Logger } from '@nestjs/common';
import axios from 'axios';
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

  /**
   * Get a sanitized folder name from phone number or name
   */
  private sanitizeFolderName(nameOrPhone: string): string {
    // Remove special characters and replace spaces with underscores
    return nameOrPhone
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[+]/g, '')
      .substring(0, 100); // Limit length
  }

  /**
   * Get the sender identifier (name or phone number) for folder organization
   */
  private getSenderIdentifier(sender: any, accountType: string): string {
    if (accountType === 'WHATSAPP') {
      // For WhatsApp, prefer phone number
      const phoneNumber = 
        sender?.attendee_specifics?.phone_number ||
        sender?.attendee_public_identifier?.split('@')[0] ||
        sender?.attendee_provider_id ||
        sender?.attendee_name ||
        'unknown';
      return this.sanitizeFolderName(phoneNumber);
    } else {
      // For LinkedIn, use name
      return this.sanitizeFolderName(sender?.attendee_name || 'unknown');
    }
  }

  /**
   * Download attachment from Unipile API
   * Uses the correct endpoint: /api/v1/messages/{message_id}/attachments/{attachment_id}
   */
  private async downloadAttachmentFromUnipile(
    attachmentId: string,
    messageId: string,
    baseUrl: string,
    accessToken: string,
  ): Promise<Buffer | null> {
    try {
      const url = `${baseUrl}/api/v1/messages/${messageId}/attachments/${attachmentId}`;
      const response = await axios.get(url, {
        headers: {
          'X-API-KEY': accessToken,
          'Accept': 'application/json',
        },
        responseType: 'arraybuffer',
      });
      
      return Buffer.from(response.data);
    } catch (error) {
      this.logger.error(`Failed to download attachment ${attachmentId} from message ${messageId} via Unipile API:`, error);
      return null;
    }
  }

  /**
   * Save an attachment to the file system
   */
  async saveAttachment(
    attachment: {
      attachment_id?: string;
      attachment_type?: string;
      attachment_url?: string | null;
      attachment_size?: number | null;
      id?: string;
      type?: string;
      url?: string;
      mimetype?: string;
    },
    sender: any,
    accountType: string,
    messageId: string,
    timestamp: string,
    accountId?: string,
    baseUrl?: string,
    accessToken?: string,
  ): Promise<string | null> {
    try {
      const senderIdentifier = this.getSenderIdentifier(sender, accountType);
      const senderDir = path.join(this.baseAttachmentsDir, senderIdentifier);
      this.ensureDirectoryExists(senderDir);

      // Determine attachment ID and type
      const attachmentId = attachment.attachment_id || attachment.id || messageId;
      const attachmentType = attachment.attachment_type || attachment.type || 'unknown';
      const attachmentUrl = attachment.attachment_url || attachment.url;

      // Determine file extension from type or mimetype
      let fileExtension = '';
      if (attachment.mimetype) {
        const mimeParts = attachment.mimetype.split('/');
        if (mimeParts.length > 1) {
          fileExtension = mimeParts[1].split(';')[0];
        }
      }
      
      // Fallback to attachment type
      if (!fileExtension) {
        const typeMap: Record<string, string> = {
          'img': 'jpg',
          'image': 'jpg',
          'video': 'mp4',
          'audio': 'ogg',
          'document': 'pdf',
          'file': 'bin',
        };
        fileExtension = typeMap[attachmentType.toLowerCase()] || 'bin';
      }

      // Create filename with timestamp and message ID
      const timestampStr = new Date(timestamp).toISOString().replace(/[:.]/g, '-');
      const filename = `${timestampStr}_${attachmentId}.${fileExtension}`;
      const filePath = path.join(senderDir, filename);

      // Download attachment if URL is provided or fetch from Unipile API
      let fileBuffer: Buffer | null = null;

      if (attachmentUrl) {
        try {
          const response = await axios.get(attachmentUrl, {
            responseType: 'arraybuffer',
            timeout: 30000, // 30 second timeout
          });
          fileBuffer = Buffer.from(response.data);
        } catch (error) {
          this.logger.warn(`Failed to download attachment from URL ${attachmentUrl}, trying Unipile API:`, error);
        }
      }

      // If URL download failed or URL is null, try Unipile API
      if (!fileBuffer && attachmentId && messageId && baseUrl && accessToken) {
        fileBuffer = await this.downloadAttachmentFromUnipile(
          attachmentId,
          messageId,
          baseUrl,
          accessToken,
        );
      }

      if (!fileBuffer) {
        this.logger.warn(`Could not download attachment ${attachmentId}, saving metadata only`);
        // Save metadata file instead
        const metadata = {
          attachment_id: attachmentId,
          attachment_type: attachmentType,
          message_id: messageId,
          timestamp,
          sender: senderIdentifier,
          error: 'Could not download attachment',
        };
        const metadataPath = filePath.replace(`.${fileExtension}`, '_metadata.json');
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
        return metadataPath;
      }

      // Save the file
      const uint8Array = new Uint8Array(fileBuffer);
      await fs.promises.writeFile(filePath, uint8Array);
      this.logger.log(`Saved attachment to: ${filePath}`);

      return filePath;
    } catch (error) {
      this.logger.error('Error saving attachment:', error);
      return null;
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
