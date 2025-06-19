import { Body, Controller, Post } from '@nestjs/common';
import { getCurrentUser } from '../arx-chat/services/recruiter-profile';
import { WorkspaceQueryService } from '../workspace-modifications/workspace-modifications.service';
import { EventsGateway } from './events-gateway-module/events-gateway';
import { MessageDto } from './types/baileys-types';
import { WhatsappService } from './whiskeysocket-baileys.service';

@Controller('whatsapp')
export class WhatsappController {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly eventsGateway: EventsGateway,
    private readonly whatsappService: WhatsappService,
  ) {}

  @Post('token')
  async token(@Body() body: { recruiterId: string }) {
    // Create a new instance with the provided recruiterId
    const service = new WhatsappService(
      this.workspaceQueryService,
    );
    return { status: 'ok' };
  }

  @Post('fetch-chats')
  async fetchChats(@Body() body: { phoneNumber: string }) {
    this.eventsGateway
    return { status: 'ok' };
  }

  @Post('send')
  async sendMessage(@Body() body: { message: string; jid: string; recruiterId: string }) {
    try {
      const recruiterId = body?.recruiterId;
      console.log("Received recruiterId from send API in baileyscontroller", recruiterId);
      if (!recruiterId) {
        console.log("Recruiter ID IS NULL SO WHATSAPP MESSAGE NOT SENT");
      }

      const messageId = await this.eventsGateway.sendWhatsappMessage(body?.message, body?.jid, recruiterId);
      if (messageId === 'failed') {
        return { status: 'failed' };
      } 
      else {
        return { status: 'ok' };
      }
    }
    catch (error) {
      console.log('Error sending message', error);
      return { status: 'failed' };
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
      const messageId = await this.eventsGateway.sendWhatsappFile({
        ...payload,
        recruiterId: payload.recruiterId
      });
      if (messageId === 'failed') {
        return { status: 'failed' };
      } 
      else {
        return { status: 'ok' };
      }
    } catch {
      console.log('Error sending file');
      return { status: 'failed' };
    }
  }

  @Post('logout')
  async logoutWhatsapp(@Body() body: { sessionId: string }, @Body('origin') origin: string) {
    try {
      if (!body.sessionId) {
        return { status: 'error', message: 'sessionId is required' };
      }

      // Get the current user and extract recruiterId
      const currentUser = await getCurrentUser(body.sessionId, origin);
      const recruiterId = currentUser?.workspaceMember?.id;

      if (!recruiterId) {
        return { status: 'error', message: 'Could not determine recruiter ID from session' };
      }

      // Create a new instance with the provided ID
      const service = new WhatsappService(
        this.workspaceQueryService,
      );
      
      // Initialize the session with the provided ID
      service.initializeSession(recruiterId, this.eventsGateway);
      
      // Clear auth and restart
      await service.clearAuthAndRestart(true);
      
      return { status: 'ok', message: 'Successfully logged out and cleared auth info' };
    } catch (error) {
      console.error('Error during logout:', error);
      return { status: 'error', message: error.message || 'Failed to logout' };
    }
  }
}
