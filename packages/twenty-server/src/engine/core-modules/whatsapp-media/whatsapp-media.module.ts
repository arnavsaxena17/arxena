import { Module } from '@nestjs/common';

import { WhatsappMediaController } from './controllers/whatsapp-media.controller';
import { WhatsappMediaStorageService } from './services/whatsapp-media-storage.service';

@Module({
  controllers: [WhatsappMediaController],
  providers: [WhatsappMediaStorageService],
  exports: [WhatsappMediaStorageService],
})
export class WhatsappMediaModule {}
