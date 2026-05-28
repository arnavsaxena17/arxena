import {
    Controller,
    Get,
    HttpException,
    HttpStatus,
    Param,
    Res,
} from '@nestjs/common';

import { Response } from 'express';

import { AVATAR_KEY_PATTERN } from '../candidate-avatar.constants';
import { CandidateAvatarStorageService } from '../services/candidate-avatar-storage.service';

@Controller('avatars')
export class AvatarController {
  constructor(
    private readonly candidateAvatarStorageService: CandidateAvatarStorageService,
  ) {}

  @Get(':key')
  async getAvatar(@Param('key') key: string, @Res() res: Response) {
    const normalizedKey = key.trim().toLowerCase();
    if (!AVATAR_KEY_PATTERN.test(normalizedKey)) {
      throw new HttpException('Invalid avatar key', HttpStatus.BAD_REQUEST);
    }

    const exists =
      await this.candidateAvatarStorageService.avatarExists(normalizedKey);
    if (!exists) {
      throw new HttpException('Avatar not found', HttpStatus.NOT_FOUND);
    }

    const stream =
      await this.candidateAvatarStorageService.readAvatarStream(normalizedKey);

    res.setHeader('Content-Type', 'image/webp');
    res.setHeader(
      'Cache-Control',
      'public, max-age=31536000, immutable',
    );
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    stream.pipe(res);
  }
}
