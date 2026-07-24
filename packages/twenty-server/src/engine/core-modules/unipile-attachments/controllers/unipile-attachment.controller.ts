import {
    Controller,
    Get,
    HttpException,
    HttpStatus,
    Param,
    Res,
} from '@nestjs/common';

import { Response } from 'express';

import { UnipileAttachmentStorageService } from '../services/unipile-attachment-storage.service';
import {
    UNIPILE_ATTACHMENT_FILENAME_PATTERN,
    UNIPILE_ATTACHMENT_SENDER_PATTERN,
} from '../unipile-attachment.constants';

@Controller('unipile-attachments')
export class UnipileAttachmentController {
  constructor(
    private readonly unipileAttachmentStorageService: UnipileAttachmentStorageService,
  ) {}

  @Get(':workspaceId/:senderIdentifier/:fileName')
  async getAttachment(
    @Param('workspaceId') workspaceId: string,
    @Param('senderIdentifier') senderIdentifier: string,
    @Param('fileName') fileName: string,
    @Res() res: Response,
  ) {
    if (!workspaceId || !senderIdentifier) {
      throw new HttpException('Invalid attachment path', HttpStatus.BAD_REQUEST);
    }

    if (!UNIPILE_ATTACHMENT_SENDER_PATTERN.test(senderIdentifier)) {
      throw new HttpException('Invalid sender identifier', HttpStatus.BAD_REQUEST);
    }

    const decodedFileName = decodeURIComponent(fileName);
    const safeFileName = decodedFileName.replace(/[^a-zA-Z0-9._-]/g, '_');

    if (!UNIPILE_ATTACHMENT_FILENAME_PATTERN.test(safeFileName)) {
      throw new HttpException('Invalid file name', HttpStatus.BAD_REQUEST);
    }

    const exists = await this.unipileAttachmentStorageService.attachmentExists(
      workspaceId,
      senderIdentifier,
      safeFileName,
    );

    if (!exists) {
      throw new HttpException('Attachment not found', HttpStatus.NOT_FOUND);
    }

    const stream = await this.unipileAttachmentStorageService.readAttachmentStream(
      workspaceId,
      senderIdentifier,
      safeFileName,
    );

    res.setHeader(
      'Content-Type',
      this.unipileAttachmentStorageService.resolveMimeType(safeFileName),
    );
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    stream.pipe(res);
  }
}
