import { createHash } from 'crypto';
import * as path from 'path';

import { Injectable, Logger } from '@nestjs/common';
import { lookup as mimeLookup } from 'mime-types';

import { FileStorageService } from 'src/engine/core-modules/file-storage/file-storage.service';
import {
    FileStorageException,
    FileStorageExceptionCode,
} from 'src/engine/core-modules/file-storage/interfaces/file-storage-exception';

import {
    WHATSAPP_MEDIA_PUBLIC_PATH_PREFIX,
    WHATSAPP_MEDIA_S3_FOLDER,
    WhatsappMediaType,
} from '../whatsapp-media.constants';

export type SaveWhatsappMediaParams = {
  workspaceId: string;
  candidateId: string;
  mediaType: WhatsappMediaType;
  fileName: string;
  file: Buffer | Uint8Array;
  mimeType?: string;
};

@Injectable()
export class WhatsappMediaStorageService {
  private readonly logger = new Logger(WhatsappMediaStorageService.name);

  constructor(private readonly fileStorageService: FileStorageService) {}

  sanitizeFileName(fileName: string): string {
    const baseName = path.basename(fileName);
    const sanitized = baseName.replace(/[^a-zA-Z0-9._-]/g, '_');

    return sanitized || `media_${Date.now()}`;
  }

  parseMediaTypeFromDirectory(userDirectory: string): WhatsappMediaType {
    if (userDirectory.includes('/images')) {
      return 'images';
    }
    if (userDirectory.includes('/videos')) {
      return 'videos';
    }
    if (
      userDirectory.includes('/voice-messages') ||
      userDirectory.includes('/audio')
    ) {
      return 'audio';
    }

    return 'docs';
  }

  buildStorageFolder(
    workspaceId: string,
    candidateId: string,
    mediaType: WhatsappMediaType,
  ): string {
    return `workspace-${workspaceId}/${WHATSAPP_MEDIA_S3_FOLDER}/${candidateId}/${mediaType}`;
  }

  buildPublicUrl(
    workspaceId: string,
    candidateId: string,
    mediaType: WhatsappMediaType,
    fileName: string,
  ): string {
    const safeName = this.sanitizeFileName(fileName);

    return `${WHATSAPP_MEDIA_PUBLIC_PATH_PREFIX}${workspaceId}/${candidateId}/${mediaType}/${encodeURIComponent(safeName)}`;
  }

  async saveMedia(params: SaveWhatsappMediaParams): Promise<{
    storageFolder: string;
    fileName: string;
    publicUrl: string;
  }> {
    const fileName = this.sanitizeFileName(params.fileName);
    const storageFolder = this.buildStorageFolder(
      params.workspaceId,
      params.candidateId,
      params.mediaType,
    );
    const mimeType =
      params.mimeType ||
      mimeLookup(fileName) ||
      'application/octet-stream';

    await this.fileStorageService.write({
      file: params.file,
      name: fileName,
      folder: storageFolder,
      mimeType: typeof mimeType === 'string' ? mimeType : 'application/octet-stream',
    });

    const publicUrl = this.buildPublicUrl(
      params.workspaceId,
      params.candidateId,
      params.mediaType,
      fileName,
    );

    this.logger.log(
      `Saved WhatsApp ${params.mediaType} to storage: ${storageFolder}/${fileName}`,
    );

    return { storageFolder, fileName, publicUrl };
  }

  async mediaExists(
    workspaceId: string,
    candidateId: string,
    mediaType: WhatsappMediaType,
    fileName: string,
  ): Promise<boolean> {
    try {
      await this.fileStorageService.read({
        folderPath: this.buildStorageFolder(workspaceId, candidateId, mediaType),
        filename: this.sanitizeFileName(fileName),
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

  async readMediaStream(
    workspaceId: string,
    candidateId: string,
    mediaType: WhatsappMediaType,
    fileName: string,
  ) {
    return this.fileStorageService.read({
      folderPath: this.buildStorageFolder(workspaceId, candidateId, mediaType),
      filename: this.sanitizeFileName(fileName),
    });
  }

  resolveMimeType(fileName: string): string {
    const mimeType = mimeLookup(fileName);

    return typeof mimeType === 'string' ? mimeType : 'application/octet-stream';
  }

  stableKeyForBuffer(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }
}
