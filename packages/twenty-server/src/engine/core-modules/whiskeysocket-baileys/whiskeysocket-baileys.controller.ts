import { Controller, Post, Body, Get } from '@nestjs/common';
import { WhatsappService } from './whiskeysocket-baileys.service';
import { MessageDto } from './types/baileys-types';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Post('send')
  async sendMessage(@Body() body: { message: string; jid: string }) {
    return this.whatsappService.sendMessageWTyping({ text: body.message }, body.jid);
  }

  @Post('/send-wa-message-file')
  sendWAMessageFile(@Body() data: any): any {
    console.log(data);
    this.whatsappService.sendMessageFileToBaileys(data);
  }

  // @Get('/get-wa-login-status')
  // getWaLoginStatus(): Promise<boolean> {
  //   return this.whatsappService.getCurrentWhatsappLoginStatus();
  // }
}
