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
    try {
      if (!body.recruiterId) {
        return { status: 'error', message: 'recruiterId is required' };
      }

      console.log("Initializing WhatsApp service for recruiter:", body.recruiterId);
      
      const whatsappService = new WhatsappService(this.workspaceQueryService);
      whatsappService.initializeSession(body.recruiterId, this.eventsGateway);
      
      return { status: 'ok' };
    } catch (error) {
      console.error('Error initializing WhatsApp service:', error);
      return { status: 'error', message: error.message || 'Failed to initialize WhatsApp service' };
    }
  }

  @Post('fetch-chats')
  async fetchChats(@Body() body: { phoneNumber: string }) {
    this.eventsGateway
    return { status: 'ok' };
  }

  @Post('send')
  async sendMessage(@Body() body: { message: string; jid: string; recruiterId: string }) {
    try {
      const { recruiterId, message, jid } = body;
      console.log("Sending WhatsApp message:", { recruiterId, jid });

      if (!recruiterId) {
        console.log("Cannot send WhatsApp message: recruiterId is required");
        return { status: 'error', message: 'recruiterId is required' };
      }

      const messageId = await this.eventsGateway.sendWhatsappMessage(message, jid, recruiterId);
      if (messageId === 'failed') {
        return { status: 'failed' };
      } 
      return { status: 'ok' };
    }
    catch (error) {
      console.error('Error sending WhatsApp message:', error);
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
    try {
      console.log('Sending WhatsApp file for recruiter:', payload.recruiterId);
      const messageId = await this.eventsGateway.sendWhatsappFile(payload);
      if (messageId === 'failed') {
        return { status: 'failed' };
      } 
      return { status: 'ok' };
    } catch (error) {
      console.error('Error sending WhatsApp file:', error);
      return { status: 'failed' };
    }
  }

  @Post('logout')
  async logoutWhatsapp(@Body() body: { sessionId: string }, @Body('origin') origin: string) {
    try {
      if (!body.sessionId) {
        return { status: 'error', message: 'sessionId is required' };
      }

      const currentUser = await getCurrentUser(body.sessionId, origin);
      const recruiterId = currentUser?.workspaceMember?.id;

      console.log("Logging out WhatsApp for recruiter:", recruiterId);
      if (!recruiterId) {
        return { status: 'error', message: 'Could not determine recruiter ID' };
      }

      // Get existing WhatsApp service if it exists
      const existingService = this.eventsGateway.getWhatsappService(recruiterId);
      if (existingService) {
        console.log('Found existing WhatsApp service, cleaning up');
        await existingService.clearAuthAndRestart(true);
        this.eventsGateway.deleteWhatsappService(recruiterId);
      } else {
        console.log('No existing WhatsApp service found, creating new one for cleanup');
        const whatsappService = new WhatsappService(this.workspaceQueryService);
        whatsappService.initializeSession(recruiterId, this.eventsGateway);
        await whatsappService.clearAuthAndRestart(true);
      }

      this.eventsGateway.emitEventTo('isWhatsappLoggedIn', false, recruiterId);
      
      return { status: 'ok', message: 'Successfully logged out of WhatsApp' };
    } catch (error) {
      console.error('Error logging out of WhatsApp:', error);
      return { status: 'error', message: error.message || 'Failed to logout' };
    }
  }
}
