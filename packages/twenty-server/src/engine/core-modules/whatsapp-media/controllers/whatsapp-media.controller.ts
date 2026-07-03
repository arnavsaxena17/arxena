import {
    Controller,
    Get,
    HttpException,
    HttpStatus,
    Param,
    Res,
} from '@nestjs/common';

import { Response } from 'express';

import { WhatsappMediaStorageService } from '../services/whatsapp-media-storage.service';
import {
    WHATSAPP_MEDIA_FILENAME_PATTERN,
    WHATSAPP_MEDIA_TYPE_PATTERN,
} from '../whatsapp-media.constants';

@Controller('whatsapp-media')
export class WhatsappMediaController {
  constructor(
    private readonly whatsappMediaStorageService: WhatsappMediaStorageService,
  ) {}

  @Get(':workspaceId/:candidateId/:mediaType/:fileName')
  async getMedia(
    @Param('workspaceId') workspaceId: string,
    @Param('candidateId') candidateId: string,
    @Param('mediaType') mediaType: string,
    @Param('fileName') fileName: string,
    @Res() res: Response,
  ) {
    if (!workspaceId || !candidateId) {
      throw new HttpException('Invalid media path', HttpStatus.BAD_REQUEST);
    }

    if (!WHATSAPP_MEDIA_TYPE_PATTERN.test(mediaType)) {
      throw new HttpException('Invalid media type', HttpStatus.BAD_REQUEST);
    }

    const decodedFileName = decodeURIComponent(fileName);
    const safeFileName =
      this.whatsappMediaStorageService.sanitizeFileName(decodedFileName);

    if (!WHATSAPP_MEDIA_FILENAME_PATTERN.test(safeFileName)) {
      throw new HttpException('Invalid file name', HttpStatus.BAD_REQUEST);
    }

    const exists = await this.whatsappMediaStorageService.mediaExists(
      workspaceId,
      candidateId,
      mediaType as 'images' | 'videos' | 'docs' | 'audio',
      safeFileName,
    );

    if (!exists) {
      throw new HttpException('Media not found', HttpStatus.NOT_FOUND);
    }

    const stream = await this.whatsappMediaStorageService.readMediaStream(
      workspaceId,
      candidateId,
      mediaType as 'images' | 'videos' | 'docs' | 'audio',
      safeFileName,
    );

    res.setHeader(
      'Content-Type',
      this.whatsappMediaStorageService.resolveMimeType(safeFileName),
    );
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    stream.pipe(res);
  }
}
