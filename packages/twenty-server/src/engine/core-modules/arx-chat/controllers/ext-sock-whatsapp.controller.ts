import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';

import axios from 'axios';
import { WhatsappMessageData } from 'twenty-shared';

import { ExtSockWhatsappService } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whatsapp.service';
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

  @Post('send-message')
  @UseGuards(JwtAuthGuard)
  async sendWhatsappMessage(@Body() messageData: any, @Req() request: any) {
    console.log('Sending WhatsApp message via ext-sock:', messageData);

    try {
      const apiToken = request.headers.authorization.split(' ')[1];
      const arxenaSiteBaseUrl =
        process.env.ARXENA_SITE_BASE_URL || 'http://127.0.0.1:5050';

      const response = await axios.post(
        `${arxenaSiteBaseUrl}/send_whatsapp_message`,
        {
          phoneNumber: messageData.phoneNumberTo,
          message: messageData.messages[0]?.content || messageData.messages,
        },
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
          },
        },
      );

      return {
        status: 'success',
        message: 'WhatsApp message sent successfully',
        data: response.data,
      };
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);

      return {
        status: 'error',
        error: error.message,
        details: error.stack,
      };
    }
  }
}
