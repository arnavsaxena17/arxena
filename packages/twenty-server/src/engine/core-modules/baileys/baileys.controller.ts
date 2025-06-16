import { Controller, Delete, Get, Logger, Post } from '@nestjs/common';
import { BaileysService } from './baileys.service';

@Controller('whatsapp')
export class BaileysController {
  private readonly logger = new Logger(BaileysController.name);

  constructor(private readonly baileysService: BaileysService) {}

  @Post('connect')
  async connect() {
    this.logger.log('Initiating WhatsApp connection');
    await this.baileysService.connect();
    return this.baileysService.getConnectionState();
  }

  @Delete('disconnect')
  async disconnect() {
    await this.baileysService.disconnect();
    return { success: true };
  }

  @Get('status')
  getStatus() {
    return this.baileysService.getConnectionState();
  }
}
