import { Module } from '@nestjs/common';

import { UnipileClientModule } from 'src/engine/core-modules/unipile-client/unipile-client.module';

import { UnipileAttachmentController } from './controllers/unipile-attachment.controller';
import { UnipileAttachmentStorageService } from './services/unipile-attachment-storage.service';

@Module({
  imports: [UnipileClientModule],
  controllers: [UnipileAttachmentController],
  providers: [UnipileAttachmentStorageService],
  exports: [UnipileAttachmentStorageService],
})
export class UnipileAttachmentModule {}
