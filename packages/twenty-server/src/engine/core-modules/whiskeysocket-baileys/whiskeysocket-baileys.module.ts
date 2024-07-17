import { Module } from '@nestjs/common';
import { WhatsappService } from './whiskeysocket-baileys.service';
import { WhatsappController } from './whiskeysocket-baileys.controller';
import { EventsGateway } from './events-gateway-module/events-gateway';

@Module({
  providers: [EventsGateway],
  controllers: [WhatsappController],
})
export class WhatsappModule {}
