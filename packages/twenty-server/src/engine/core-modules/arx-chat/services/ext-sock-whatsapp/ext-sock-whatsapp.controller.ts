import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { ExtSockWhatsappWhitelistProcessingService } from './ext-sock-whitelist-processing';
import { RedisService } from './redis-service-ops';

@Controller('ext-sock-whatsapp')
export class ExtSockWhatsappController {
  constructor(
    private readonly whitelistProcessingService: ExtSockWhatsappWhitelistProcessingService,
    private readonly redisService: RedisService,
  ) {}

  @Post('update-whitelist')
  @UseGuards(JwtAuthGuard)
  async updateWhitelist(
    @Body() body: { oldPhoneNumber: string; newPhoneNumber: string; userId: string },
  ) {
    try {
      const { oldPhoneNumber, newPhoneNumber, userId } = body;

      // Format phone numbers for WhatsApp
      const formatPhoneNumber = (number: string) => {
        const normalized = number.replace(/\D/g, '');
        return normalized.length === 10 ? `91${normalized}@c.us` : `${normalized}@c.us`;
      };

      const oldFormattedNumber = formatPhoneNumber(oldPhoneNumber);
      const newFormattedNumber = formatPhoneNumber(newPhoneNumber);

      // Remove old phone number from whitelist and its mapping
      await this.redisService.removeFromWhitelist(userId, oldFormattedNumber);
      await this.redisService.removeIdentifierToUserMapping(oldFormattedNumber);

      // Add new phone number to whitelist and create its mapping
      await this.redisService.addToWhitelist(userId, newFormattedNumber);
      await this.redisService.createIdentifierToUserMapping(newFormattedNumber, userId);

      return { success: true };
    } catch (error) {
      console.error('Failed to update whitelist:', error);
      throw error;
    }
  }
} 