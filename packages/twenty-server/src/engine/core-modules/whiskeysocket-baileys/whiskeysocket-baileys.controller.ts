import { Controller, Post, Body } from '@nestjs/common';
import { WhatsappService } from './whiskeysocket-baileys.service';
import { EventsGateway } from './events-gateway-module/events-gateway';
import { MessageDto } from './types/baileys-types';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private eventsGateway: EventsGateway) {}

  @Post('token')
  async sendMessage1(@Body() body: { sessionId: string }) {
    await new WhatsappService(this.eventsGateway, body.sessionId, '');
    return { status: 'ok' };
  }

  @Post('send')
  async sendMessage(@Body() body: { message: string; jid: string; recruiterId: string }) {
    try {
      const sessionId = body?.recruiterId;
      await this.eventsGateway.sendWhatsappMessage(body?.message, body?.jid, sessionId);
      return { status: 'ok' };
    } catch (error) {
      console.log('Error sending message', error);
      return { status: 'error' };
    }
  }

  // @Post('/send-wa-message-file')
  // async sendWAMessageFile(@Body() data: any): any {
  //   console.log(data);

  //   const bodyToSend: MessageDto = {
  //     WANumber: '919876512345',
  //     message: 'Hello',
  //     fileData: {
  //       fileBuffer: 'fileBuffer',
  //       fileName: 'fileName',
  //       mimetype: 'mimetype',
  //       filePath: 'filePath',
  //     },
  //     jid: '919876512345@s.whatsapp.net',

  //   }
  //   await this.eventsGateway.sendWhatsappFile(data?.fileToSendData, data?.recruiterId, data?.jid);
  // }

  @Post('/send-wa-message-file')
  async sendWAMessageFile(@Body() payload: { recruiterId: string; fileToSendData: MessageDto }): Promise<object> {
    console.log(payload);
    try {
      await this.eventsGateway.sendWhatsappFile(payload);
      return { status: 'ok' };
    } catch {
      console.log('Error sending file');
      return { status: 'error' };
    }
  }
}
