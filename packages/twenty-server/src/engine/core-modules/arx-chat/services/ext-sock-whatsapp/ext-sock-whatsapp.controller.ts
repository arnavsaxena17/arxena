import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import axios from 'axios';
import { ExtSockWhatsappService } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whatsapp.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { whatappUpdateMessageObjType, WhatsappMessageData } from 'twenty-shared';
import { ExtSockWhatsappWhitelistProcessingService } from './ext-sock-whitelist-processing';
import { RedisService } from './redis-service-ops';

@Controller('ext-sock-whatsapp')
export class ExtSockWhatsappController {
  constructor(
    private readonly whitelistProcessingService: ExtSockWhatsappWhitelistProcessingService,
    private readonly extSockWhatsappService: ExtSockWhatsappService,
    private readonly redisService: RedisService,
  ) {}

  @Post('update-whitelist')
  @UseGuards(JwtAuthGuard)
  async updateWhitelist(
    @Body() body: { oldPhoneNumber: string; newPhoneNumber: string; userId: string },
  ) {
    try {
      console.log('updateWhitelist called with body:', body);
      const { oldPhoneNumber, newPhoneNumber, userId } = body;
      const formatPhoneNumber = (number: string) => {
        const normalized = number.replace(/\D/g, '');
        return normalized.length === 10 ? `91${normalized}@c.us` : `${normalized}@c.us`;
      };
      const oldFormattedNumber = formatPhoneNumber(oldPhoneNumber);
      const newFormattedNumber = formatPhoneNumber(newPhoneNumber);
      await this.redisService.removeFromWhitelist(userId, oldFormattedNumber);
      await this.redisService.removeIdentifierToUserMapping(oldFormattedNumber);
      await this.redisService.addToWhitelist(userId, newFormattedNumber);
      await this.redisService.createIdentifierToUserMapping(newFormattedNumber, userId);
      return { success: true };
    } catch (error) {
      console.error('Failed to update whitelist in ext-sock-whatsapp controller:', error);
      throw error;
    }
  }

  @Post('incoming-sock-message')
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

  @Post('send-sock-message')
  @UseGuards(JwtAuthGuard)
  async sendWhatsappMessage(@Body() messageData: whatappUpdateMessageObjType, @Req() request: any) {
    console.log('Sending WhatsApp message via ext-sock:', messageData);

    try {
      const apiToken = request.headers.authorization.split(' ')[1];

      console.log('API Token:', apiToken);
      const arxenaSiteBaseUrl =
        process.env.ARXENA_SITE_BASE_URL || 'http://localhost:5050';

      console.log('Arxena Site Base URL:', arxenaSiteBaseUrl);
      const response = await axios.post(
        `${arxenaSiteBaseUrl}/send_sock_message`,
        {
          phoneNumber: messageData.phoneNumberTo,
          message: messageData.messages[0]?.content || messageData.messages,
          candidateFirstName: messageData.candidateFirstName,
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

  @Get('whitelist/:userId')
  @UseGuards(JwtAuthGuard)
  async getWhitelistedNumbers(@Param('userId') userId: string) {
    try {
      console.log('Fetching whitelisted numbers for user:', userId);
      const whitelistedNumbers = await this.redisService.getWhitelist(userId);
      
      return {
        status: 'success',
        data: {
          userId,
          whitelistedNumbers,
        },
      };
    } catch (error) {
      console.error('Error fetching whitelisted numbers:', error);
      return {
        status: 'error',
        error: error.message,
        details: error.stack,
      };
    }
  }
}


