import { Module } from '@nestjs/common';

import { UnipileAttachmentController } from './controllers/unipile-attachment.controller';
import { UnipileAttachmentStorageService } from './services/unipile-attachment-storage.service';

@Module({
  controllers: [UnipileAttachmentController],
  providers: [UnipileAttachmentStorageService],
  exports: [UnipileAttachmentStorageService],
})
export class UnipileAttachmentModule {}
