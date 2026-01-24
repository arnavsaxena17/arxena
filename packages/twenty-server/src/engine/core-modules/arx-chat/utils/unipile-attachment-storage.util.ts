import { Logger } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

export class UnipileAttachmentStorageUtil {
  private readonly logger = new Logger(UnipileAttachmentStorageUtil.name);
  private readonly baseAttachmentsDir: string;
  private readonly deletedMessagesFile: string;

  constructor(baseDir?: string) {
    // Use provided directory or default to a 'unipile-attachments' folder in the project root
    this.baseAttachmentsDir = baseDir || path.join(process.cwd(), 'unipile-attachments');
    this.deletedMessagesFile = path.join(this.baseAttachmentsDir, 'deleted-messages.json');
    
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

  /**
   * Save deleted message details to deleted-messages.json
   */
  async saveDeletedMessage(
    payload: {
      message_id: string;
      message?: string | null;
      sender: any;
      timestamp: string;
      account_type: string;
      chat_id?: string;
      account_id?: string;
      attachments?: any[] | any;
    },
  ): Promise<void> {
    try {
      const deletedAt = new Date().toISOString();
      
      // Normalize attachments to array
      const attachmentsArray = payload.attachments 
        ? (Array.isArray(payload.attachments) ? payload.attachments : [payload.attachments])
        : [];
      
      const deletedMessageEntry = {
        deleted_at: deletedAt,
        message_id: payload.message_id,
        original_message: payload.message || '',
        sender_name: payload.sender?.attendee_name || 'Unknown',
        sender_phone: payload.sender?.attendee_specifics?.phone_number || 
                     payload.sender?.attendee_public_identifier?.split('@')[0] || 
                     payload.sender?.attendee_provider_id || 
                     'Unknown',
        sent_at: payload.timestamp,
        account_type: payload.account_type,
        chat_id: payload.chat_id,
        account_id: payload.account_id,
        had_attachments: attachmentsArray.length > 0,
        attachments: attachmentsArray.map(att => ({
          attachment_id: att.attachment_id || att.id,
          attachment_type: att.attachment_type || att.type || 'unknown',
          attachment_url: att.attachment_url || att.url || null,
          attachment_size: att.attachment_size || att.size || null,
        })),
      };

      // Read existing deleted messages
      let deletedMessages: any[] = [];
      if (fs.existsSync(this.deletedMessagesFile)) {
        try {
          const fileContent = fs.readFileSync(this.deletedMessagesFile, 'utf-8');
          deletedMessages = JSON.parse(fileContent);
        } catch (error) {
          this.logger.warn('Error reading deleted messages file, creating new one:', error);
          deletedMessages = [];
        }
      }

      // Add new deleted message entry
      deletedMessages.push(deletedMessageEntry);

      // Write back to file
      fs.writeFileSync(
        this.deletedMessagesFile,
        JSON.stringify(deletedMessages, null, 2),
      );

      this.logger.log(`Saved deleted message entry: ${payload.message_id}`);
    } catch (error) {
      this.logger.error('Error saving deleted message:', error);
    }
  }
}
