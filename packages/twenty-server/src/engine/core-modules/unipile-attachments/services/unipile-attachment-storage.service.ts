import * as path from 'path';

import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { lookup as mimeLookup } from 'mime-types';

import { FileStorageService } from 'src/engine/core-modules/file-storage/file-storage.service';
import {
    FileStorageException,
    FileStorageExceptionCode,
} from 'src/engine/core-modules/file-storage/interfaces/file-storage-exception';

import {
    UNIPILE_ATTACHMENT_PUBLIC_PATH_PREFIX,
    UNIPILE_ATTACHMENT_S3_FOLDER,
} from '../unipile-attachment.constants';

export type SaveUnipileAttachmentParams = {
  workspaceId: string;
  attachment: {
    attachment_id?: string;
    attachment_type?: string;
    attachment_url?: string | null;
    attachment_size?: number | null;
    id?: string;
    type?: string;
    url?: string;
    mimetype?: string;
  };
  sender: Record<string, unknown>;
  accountType: string;
  messageId: string;
  timestamp: string;
  accountId?: string;
  baseUrl?: string;
  accessToken?: string;
};

@Injectable()
export class UnipileAttachmentStorageService {
  private readonly logger = new Logger(UnipileAttachmentStorageService.name);

  constructor(private readonly fileStorageService: FileStorageService) {}

  sanitizeSenderIdentifier(nameOrPhone: string): string {
    return nameOrPhone
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[+]/g, '')
      .substring(0, 100);
  }

  getSenderIdentifier(sender: Record<string, unknown>, accountType: string): string {
    if (accountType === 'WHATSAPP') {
      const attendeeSpecifics = sender?.attendee_specifics as
        | { phone_number?: string }
        | undefined;
      const attendeePublicIdentifier = sender?.attendee_public_identifier as
        | string
        | undefined;

      const phoneNumber =
        attendeeSpecifics?.phone_number ||
        attendeePublicIdentifier?.split('@')[0] ||
        (sender?.attendee_provider_id as string | undefined) ||
        (sender?.attendee_name as string | undefined) ||
        'unknown';

      return this.sanitizeSenderIdentifier(phoneNumber);
    }

    return this.sanitizeSenderIdentifier(
      (sender?.attendee_name as string | undefined) || 'unknown',
    );
  }

  buildStorageFolder(workspaceId: string, senderIdentifier: string): string {
    return `workspace-${workspaceId}/${UNIPILE_ATTACHMENT_S3_FOLDER}/${senderIdentifier}`;
  }

  buildPublicUrl(
    workspaceId: string,
    senderIdentifier: string,
    fileName: string,
  ): string {
    return `${UNIPILE_ATTACHMENT_PUBLIC_PATH_PREFIX}${workspaceId}/${senderIdentifier}/${encodeURIComponent(fileName)}`;
  }

  resolveMimeType(fileName: string): string {
    const mimeType = mimeLookup(fileName);

    return typeof mimeType === 'string' ? mimeType : 'application/octet-stream';
  }

  private resolveFileExtension(
    attachment: SaveUnipileAttachmentParams['attachment'],
    attachmentType: string,
  ): string {
    if (attachment.mimetype) {
      const mimeParts = attachment.mimetype.split('/');

      if (mimeParts.length > 1) {
        return mimeParts[1].split(';')[0];
      }
    }

    const typeMap: Record<string, string> = {
      img: 'jpg',
      image: 'jpg',
      video: 'mp4',
      audio: 'ogg',
      document: 'pdf',
      file: 'bin',
    };

    return typeMap[attachmentType.toLowerCase()] || 'bin';
  }

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
          Accept: 'application/json',
        },
        responseType: 'arraybuffer',
      });

      return Buffer.from(response.data);
    } catch (error) {
      this.logger.error(
        `Failed to download attachment ${attachmentId} from message ${messageId} via Unipile API:`,
        error,
      );

      return null;
    }
  }

  async saveAttachment(
    params: SaveUnipileAttachmentParams,
  ): Promise<string | null> {
    try {
      const {
        workspaceId,
        attachment,
        sender,
        accountType,
        messageId,
        timestamp,
        baseUrl,
        accessToken,
      } = params;

      const senderIdentifier = this.getSenderIdentifier(sender, accountType);
      const storageFolder = this.buildStorageFolder(workspaceId, senderIdentifier);

      const attachmentId =
        attachment.attachment_id || attachment.id || messageId;
      const attachmentType =
        attachment.attachment_type || attachment.type || 'unknown';
      const attachmentUrl = attachment.attachment_url || attachment.url;
      const fileExtension = this.resolveFileExtension(attachment, attachmentType);

      const timestampStr = new Date(timestamp)
        .toISOString()
        .replace(/[:.]/g, '-');
      const fileName = `${timestampStr}_${attachmentId}.${fileExtension}`;

      let fileBuffer: Buffer | null = null;

      if (attachmentUrl) {
        try {
          const response = await axios.get(attachmentUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
          });
          fileBuffer = Buffer.from(response.data);
        } catch (error) {
          this.logger.warn(
            `Failed to download attachment from URL ${attachmentUrl}, trying Unipile API:`,
            error,
          );
        }
      }

      if (!fileBuffer && attachmentId && messageId && baseUrl && accessToken) {
        fileBuffer = await this.downloadAttachmentFromUnipile(
          attachmentId,
          messageId,
          baseUrl,
          accessToken,
        );
      }

      if (!fileBuffer) {
        this.logger.warn(
          `Could not download attachment ${attachmentId}, saving metadata only`,
        );

        const metadata = {
          attachment_id: attachmentId,
          attachment_type: attachmentType,
          message_id: messageId,
          timestamp,
          sender: senderIdentifier,
          error: 'Could not download attachment',
        };
        const metadataFileName = fileName.replace(
          `.${fileExtension}`,
          '_metadata.json',
        );

        await this.fileStorageService.write({
          file: Buffer.from(JSON.stringify(metadata, null, 2)),
          name: metadataFileName,
          folder: storageFolder,
          mimeType: 'application/json',
        });

        return this.buildPublicUrl(workspaceId, senderIdentifier, metadataFileName);
      }

      const mimeType =
        attachment.mimetype ||
        mimeLookup(fileName) ||
        'application/octet-stream';

      await this.fileStorageService.write({
        file: fileBuffer,
        name: fileName,
        folder: storageFolder,
        mimeType:
          typeof mimeType === 'string' ? mimeType : 'application/octet-stream',
      });

      const publicUrl = this.buildPublicUrl(
        workspaceId,
        senderIdentifier,
        fileName,
      );

      this.logger.log(
        `Saved Unipile attachment to storage: ${storageFolder}/${fileName}`,
      );

      return publicUrl;
    } catch (error) {
      this.logger.error('Error saving Unipile attachment:', error);

      return null;
    }
  }

  async attachmentExists(
    workspaceId: string,
    senderIdentifier: string,
    fileName: string,
  ): Promise<boolean> {
    try {
      await this.fileStorageService.read({
        folderPath: this.buildStorageFolder(workspaceId, senderIdentifier),
        filename: path.basename(fileName),
      });

      return true;
    } catch (error) {
      if (
        error instanceof FileStorageException &&
        error.code === FileStorageExceptionCode.FILE_NOT_FOUND
      ) {
        return false;
      }

      return false;
    }
  }

  async readAttachmentStream(
    workspaceId: string,
    senderIdentifier: string,
    fileName: string,
  ) {
    return this.fileStorageService.read({
      folderPath: this.buildStorageFolder(workspaceId, senderIdentifier),
      filename: path.basename(fileName),
    });
  }
}
