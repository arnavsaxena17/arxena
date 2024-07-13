import { Module } from '@nestjs/common';
import { WhatsappService } from './whiskeysocket-baileys.service';
import { WhatsappController } from './whiskeysocket-baileys.controller';

@Module({
  providers: [WhatsappService],
  controllers: [WhatsappController],
})
export class WhatsappModule {}
