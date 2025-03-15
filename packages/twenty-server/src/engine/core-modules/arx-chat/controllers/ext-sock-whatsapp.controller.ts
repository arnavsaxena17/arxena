import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { WhatsappMessageData } from 'twenty-shared';

import { ExtSockWhatsappService } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

@Controller('ext-sock-whatsapp')
export class ExtSockWhatsappController {
  constructor(
    private readonly extSockWhatsappService: ExtSockWhatsappService,
  ) {}

  @Post('message')
  @UseGuards(JwtAuthGuard)
  async receiveWhatsappMessage(@Body() messageData: WhatsappMessageData) {
    console.log('Received WhatsApp message:', messageData);

    try {
      await this.extSockWhatsappService.queueMessage(messageData);

      return {
        status: 'success',
        message: 'WhatsApp message queued successfully',
        messageId: messageData.id,
      };
    } catch (error) {
      console.error('Error queueing WhatsApp message:', error);

      return {
        status: 'error',
        error: error.message,
        details: error.stack,
      };
    }
  }
}
