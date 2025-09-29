import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
// import { getCurrentUser } from '../arx-chat/services/recruiter-profile';
import { RecruiterProfileService } from '../arx-chat/services/recruiter-profile';
import { WorkspaceQueryService } from '../workspace-modifications/workspace-modifications.service';
import { EventsGateway } from './events-gateway-module/events-gateway';
import { MessageDto } from './types/baileys-types';
import { BaileysWhatsappService } from './whiskeysocket-baileys.service';
  
@Controller('baileys-whatsapp')
@UseGuards(JwtAuthGuard)
export class BaileysWhatsappController {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly eventsGateway: EventsGateway,
    private readonly baileysWhatsappService: BaileysWhatsappService,
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {}

  @Post('token')
  async token(@Req() request: any) {
    try {
      const apiToken = request.headers.authorization.split(' ')[1];
      const origin = request.headers.origin;

      const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(apiToken, origin);
      const recruiterId = currentUser?.workspaceMember?.id;
      if (!recruiterId) {
        return { status: 'error', message: 'Could not determine recruiter ID' };
      }
      console.log("Initializing WhatsApp service for recruiter:", recruiterId);      
      await this.eventsGateway.getOrCreateSession(recruiterId);
   
      return { status: 'ok' };
    } catch (error) {
      console.error('Error initializing WhatsApp service:', error);
      return { status: 'error', message: error.message || 'Failed to initialize WhatsApp service' };
    }
  }

  @Post('fetch-chats')
  async fetchChats(@Req() request: any, @Body() body: { phoneNumber: string }) {
    this.eventsGateway
    return { status: 'ok' };
  }

  @Post('send')
  async sendMessage(@Req() request: any, @Body() body: { message: string; jid: string; recruiterId?: string }) {
    try {
      console.log("send message request", request.body);
      const apiToken = request?.headers?.authorization?.split(' ')[1];
      const origin = request?.headers?.origin;
      const { message, jid } = body;
      
      let recruiterId = body.recruiterId;

      if (!recruiterId) {
        const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(apiToken, origin);
        console.log("currentUser::", currentUser);
        recruiterId = currentUser?.workspaceMember?.id;

        if (!recruiterId) {
          console.log("Cannot send WhatsApp message: Could not determine recruiter ID");
          return { status: 'error', message: 'Could not determine recruiter ID' };
        }
      }

      console.log("Sending WhatsApp message:", { recruiterId, jid });

      const messageId = await this.eventsGateway.sendWhatsappMessage(message, jid, recruiterId);
      if (messageId === 'failed') {
        console.log("Failed to send WhatsApp message");
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
  async sendWAMessageFile(@Req() request: any, @Body() payload: { fileToSendData: MessageDto; recruiterId?: string }): Promise<object> {
    try {
      console.log("send wa message file request");
      const apiToken = request?.headers?.authorization?.split(' ')[1];
      const origin = request?.headers?.origin;

      let recruiterId = payload.recruiterId;

      if (!recruiterId) {
        const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(apiToken, origin);
        recruiterId = currentUser?.workspaceMember?.id;
        
        if (!recruiterId) {
          return { status: 'error', message: 'Could not determine recruiter ID' };
        }
      }

      console.log('Sending WhatsApp file for recruiter:', recruiterId);
      const messageId = await this.eventsGateway.sendWhatsappFile({ recruiterId, fileToSendData: payload.fileToSendData });
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
  async logoutWhatsapp(@Req() request: any) {
    try {
      const apiToken = request.headers.authorization.split(' ')[1];
      const origin = request.headers.origin;

      const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(apiToken, origin);
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
        const baileysWhatsappService = new BaileysWhatsappService(this.workspaceQueryService, this.staticGraphQLService);
        baileysWhatsappService.initializeSession(recruiterId, this.eventsGateway);
        await baileysWhatsappService.clearAuthAndRestart(true);
      }

      this.eventsGateway.emitEventTo('isWhatsappLoggedIn', false, recruiterId);
      
      return { status: 'ok', message: 'Successfully logged out of WhatsApp' };
    } catch (error) {
      console.error('Error logging out of WhatsApp:', error);
      return { status: 'error', message: error.message || 'Failed to logout' };
    }
  }

  @Post('fetch-recent-messages')
  async fetchRecentMessages(@Req() request: any, @Body() body: { phoneNumber: string; limit?: number }) {
    try {
      const apiToken = request.headers.authorization.split(' ')[1];
      const origin = request.headers.origin;
      const { phoneNumber, limit = 50 } = body;

      const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(apiToken, origin);
      const recruiterId = currentUser?.workspaceMember?.id;

      if (!recruiterId) {
        return { 
          status: 'error', 
          message: 'Could not determine recruiter ID' 
        };
      }

      if (!phoneNumber) {
        return { 
          status: 'error', 
          message: 'phoneNumber is required' 
        };
      }

      // Format phone number to WhatsApp JID format
      const jid = `${phoneNumber.replace(/[^0-9]/g, '')}@s.whatsapp.net`;

      // Get WhatsApp service for this recruiter
      const whatsappService = this.eventsGateway.getWhatsappService(recruiterId);
      if (!whatsappService) {
        return {
          status: 'error',
          message: 'WhatsApp service not found for this recruiter. Please initialize WhatsApp first.'
        };
      }

      // Fetch messages using the service's public method
      const messages = await whatsappService.fetchMessageHistory(jid, limit);
      if (!messages) {
        return {
          status: 'ok',
          data: {
            messages: [],
            count: 0
          }
        };
      }

      // Return formatted messages
      return {
        status: 'ok',
        data: {
          messages,
          count: messages.length
        }
      };

    } catch (error) {
      console.error('Error fetching recent messages:', error);
      return { 
        status: 'error', 
        message: error.message || 'Failed to fetch recent messages' 
      };
    }
  }

  @Post('send-message')
  async sendMessageToNumber(@Req() request: any, @Body() body: { phoneNumber: string; message: string }) {
    try {
      const apiToken = request.headers.authorization.split(' ')[1];
      const origin = request.headers.origin;
      const { phoneNumber, message } = body;

      const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(apiToken, origin);
      const recruiterId = currentUser?.workspaceMember?.id;

      if (!recruiterId) {
        return { 
          status: 'error', 
          message: 'Could not determine recruiter ID' 
        };
      }

      if (!phoneNumber || !message) {
        return { 
          status: 'error', 
          message: 'phoneNumber and message are required' 
        };
      }

      // Format phone number to WhatsApp JID format
      const jid = `${phoneNumber.replace(/[^0-9]/g, '')}@s.whatsapp.net`;

      // Get WhatsApp service for this recruiter
      const whatsappService = this.eventsGateway.getWhatsappService(recruiterId);
      if (!whatsappService) {
        return {
          status: 'error',
          message: 'WhatsApp service not found for this recruiter. Please initialize WhatsApp first.'
        };
      }

      // Send the message
      const messageId = await this.eventsGateway.sendWhatsappMessage(message, jid, recruiterId);
      
      if (messageId === 'failed') {
        // Additional notification via candidate-sourcing controller's notification system
        await this.notifyFailedWhatsAppMessage(recruiterId, phoneNumber, message);
        
        return { 
          status: 'error',
          message: 'Failed to send message'
        };
      }

      return {
        status: 'ok',
        data: {
          messageId
        }
      };

    } catch (error) {
      console.error('Error sending message:', error);
      return { 
        status: 'error', 
        message: error.message || 'Failed to send message' 
      };
    }
  }

  private async notifyFailedWhatsAppMessage(recruiterId: string, phoneNumber: string, message: string) {
    try {
      console.log('Sending additional notification for failed WhatsApp message');
      
      // Use the existing notification system from candidate-sourcing controller
      const notificationMessage = `WhatsApp message failed to ${phoneNumber}. Please check your WhatsApp connection and try again.`;
      
      // Send notification via WebSocket (similar to send-notification-to-recruiter endpoint)
      // We'll use the existing WebSocket service if available
      if (this.eventsGateway && typeof this.eventsGateway.emitEventTo === 'function') {
        this.eventsGateway.emitEventTo('send_notification_to_recruiter', {
          message: notificationMessage,
          timestamp: new Date().toISOString(),
          type: 'whatsapp_failure'
        }, recruiterId);
      }
      
      console.log('Additional WhatsApp failure notification sent');
    } catch (notificationError) {
      console.error('Error sending additional WhatsApp failure notification:', notificationError);
    }
  }
}
