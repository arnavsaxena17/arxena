import { Controller, Post, Body } from '@nestjs/common';
import { WhatsappService } from './whiskeysocket-baileys.service';
import { EventsGateway } from './events-gateway-module/events-gateway';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private eventsGateway: EventsGateway) {}

  @Post('token')
  async sendMessage(@Body() body: { sessionId: string }) {
    await new WhatsappService(this.eventsGateway, body.sessionId, '');
    return { status: 'ok' };
  }
}
