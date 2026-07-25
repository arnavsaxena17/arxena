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
  async fetchChats(@Req() request: any, @Body() body: { phoneNumber: string; limit?: number }) {
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

      // Try to fetch chat history using WhatsApp API first
      let chatHistory: any[] = [];
      let source = 'database'; // Default to database
      let syncResult = { synced: 0, skipped: 0, errors: 0 };
      
      try {
        chatHistory = await whatsappService.fetchMessageHistory(jid, limit);
        if (chatHistory && chatHistory.length > 0) {
          source = 'whatsapp';
          
          // Try to sync WhatsApp messages with database
          try {
            // Find candidate by phone number
            const cleanPhoneNumber = phoneNumber.replace(/[^0-9]/g, '');
            const candidate = await this.findCandidateByPhoneNumber(cleanPhoneNumber, apiToken);
            
            if (candidate) {
              console.log(`🔄 Syncing ${chatHistory.length} WhatsApp messages with database for candidate: ${candidate.id}`);
              const updateChatService = new (await import('../arx-chat/services/candidate-engagement/update-chat')).UpdateChat(
                this.workspaceQueryService,
                this.staticGraphQLService
              );
              
              syncResult = await updateChatService.syncMessagesForPhoneNumber(
                phoneNumber,
                candidate.id,
                apiToken,
                chatHistory
              );
              
              console.log(`📈 Sync result: ${syncResult.synced} synced, ${syncResult.skipped} skipped, ${syncResult.errors} errors`);
            } else {
              console.log(`⚠️ No candidate found for phone number: ${phoneNumber}`);
            }
          } catch (syncError) {
            console.error('❌ Error syncing WhatsApp messages with database:', syncError);
          }
        }
      } catch (whatsappError) {
        console.log('WhatsApp API fetch failed, falling back to database:', whatsappError.message);
      }
      
      // If WhatsApp API didn't return messages, try database
      if (chatHistory.length === 0) {
        try {
          chatHistory = await whatsappService.fetchChatHistoryFromDatabase(jid, limit);
          source = 'database';
        } catch (dbError) {
          console.error('Database fetch also failed:', dbError.message);
        }
      }
      
      return {
        status: 'ok',
        data: {
          phoneNumber,
          jid,
          messages: chatHistory,
          count: chatHistory.length,
          limit,
          source,
          syncResult
        }
      };

    } catch (error) {
      console.error('Error fetching chat history:', error);
      return { 
        status: 'error', 
        message: error.message || 'Failed to fetch chat history' 
      };
    }
  }

  @Post('fetch-chat-history')
  async fetchChatHistory(@Req() request: any, @Body() body: { phoneNumber: string; limit?: number; fromDate?: string; toDate?: string }) {
    try {
      const apiToken = request.headers.authorization.split(' ')[1];
      const origin = request.headers.origin;
      const { phoneNumber, limit = 50, fromDate, toDate } = body;

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

      // Fetch chat history with date filtering from database
      const chatHistory = await whatsappService.fetchChatHistoryFromDatabaseWithFilters(jid, limit, fromDate, toDate);
      
      return {
        status: 'ok',
        data: {
          phoneNumber,
          jid,
          messages: chatHistory,
          count: chatHistory.length,
          limit,
          fromDate,
          toDate,
          source: 'database'
        }
      };

    } catch (error) {
      console.error('Error fetching chat history with filters:', error);
      return { 
        status: 'error', 
        message: error.message || 'Failed to fetch chat history' 
      };
    }
  }

  @Post('sync-messages')
  async syncMessages(@Req() request: any, @Body() body: { phoneNumber: string; candidateId?: string; limit?: number }) {
    try {
      const apiToken = request.headers.authorization.split(' ')[1];
      const origin = request.headers.origin;
      const { phoneNumber, candidateId, limit = 50 } = body;

      const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(apiToken, origin);
      const recruiterId = currentUser?.workspaceMember?.id;
      console.log("recruiterId in syncMessages:", recruiterId);
      if (!recruiterId) {
        return { 
          status: 'error', 
          message: 'Could not determine recruiter ID' 
        };
      }
      console.log("phoneNumber in syncMessages:", phoneNumber);
      if (!phoneNumber) {
        return { 
          status: 'error', 
          message: 'phoneNumber is required' 
        };
      }
      // Format phone number to WhatsApp JID format
      const jid = `${phoneNumber.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
      console.log("jid in syncMessages:", jid);
      // Get WhatsApp service for this recruiter
      const whatsappService = this.eventsGateway.getWhatsappService(recruiterId);
      if (!whatsappService) {
        return {
          status: 'error',
          message: 'WhatsApp service not found for this recruiter. Please initialize WhatsApp first.'
        };
      }
      // console.log("whatsappService in syncMessages:", whatsappService);
      // Find candidate if not provided
      let targetCandidateId = candidateId;
      if (!targetCandidateId) {
        const cleanPhoneNumber = phoneNumber.replace(/[^0-9]/g, '');
        const candidate = await this.findCandidateByPhoneNumber(cleanPhoneNumber, apiToken);
        if (!candidate) {
          return {
            status: 'error',
            message: 'Candidate not found for this phone number. Please provide candidateId or ensure candidate exists.'
          };
        }
        targetCandidateId = candidate.id;
      }

      // Fetch messages from WhatsApp API
      let baileysMessages: any[] = [];
      try {
        baileysMessages = await whatsappService.fetchMessageHistory(jid, limit);
        console.log("baileysMessages in syncMessages:", baileysMessages);
      } catch (whatsappError) {
        console.log('WhatsApp API fetch failed:', whatsappError.message);
        return {
          status: 'error',
          message: 'Failed to fetch messages from WhatsApp API'
        };
      }
      console.log("baileysMessages in syncMessages:", baileysMessages);
      if (baileysMessages.length === 0) {
        return {
          status: 'ok',
          data: {
            message: 'No messages found to sync',
            synced: 0,
            skipped: 0,
            errors: 0
          }
        };
      }

      // Sync messages with database
      const updateChatService = new (await import('../arx-chat/services/candidate-engagement/update-chat')).UpdateChat(
        this.workspaceQueryService,
        this.staticGraphQLService
      );
      
      const syncResult = await updateChatService.syncMessagesForPhoneNumber(
        phoneNumber,
        targetCandidateId!,
        apiToken,
        baileysMessages
      );

      return {
        status: 'ok',
        data: {
          phoneNumber,
          candidateId: targetCandidateId,
          totalMessages: baileysMessages.length,
          synced: syncResult.synced,
          skipped: syncResult.skipped,
          errors: syncResult.errors,
          message: `Successfully synced ${syncResult.synced} messages, skipped ${syncResult.skipped} duplicates, ${syncResult.errors} errors`
        }
      };

    } catch (error) {
      console.error('Error syncing messages:', error);
      return { 
        status: 'error', 
        message: error.message || 'Failed to sync messages' 
      };
    }
  }

  @Post('send')
  async sendMessage(@Req() request: any, @Body() body: { message: string; jid: string; recruiterId?: string }) {
    try {
      console.log("send message request", request.body);
      const apiToken = request?.headers?.authorization?.split(' ')[1];
      const origin = request?.headers?.origin;
      const { message, jid } = body;
      
      let recruiterId = body.recruiterId;
      let recruiterName = '';
      if (!recruiterId) {
        const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(apiToken, origin);
        console.log("currentUser::", currentUser);
        recruiterId = currentUser?.workspaceMember?.id;
        recruiterName = currentUser?.workspaceMember?.name.firstName + ' ' + currentUser?.workspaceMember?.name.lastName;
        console.log("recruiterName::", recruiterName);
        if (!recruiterId) {
          console.log("Cannot send WhatsApp message: Could not determine recruiter ID");
          return { status: 'error', message: 'Could not determine recruiter ID' };
        }
      }

      console.log("Sending WhatsApp message:", { recruiterId, jid });

      const messageId = await this.eventsGateway.sendWhatsappMessage(message, jid, recruiterId, recruiterName);
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
      console.log("logout whatsapp request::", request);
      const apiToken = request.headers.authorization.split(' ')[1];
      const origin = request.headers.origin;

      const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(apiToken, origin);
      const recruiterId = currentUser?.workspaceMember?.id;
      const recruiterName = currentUser?.workspaceMember?.name.firstName + ' ' + currentUser?.workspaceMember?.name.lastName;

      console.log("Logging out WhatsApp for recruiter:", recruiterId);
      if (!recruiterId) {
        return { status: 'error', message: 'Could not determine recruiter ID' };
      }

      // Use session manager to handle logout properly
      console.log('Logging out WhatsApp session for recruiter:', recruiterId);
      await this.eventsGateway.logoutSession(recruiterId, recruiterName);

      this.eventsGateway.emitEventTo('isWhatsappLoggedIn', false, recruiterId,  recruiterName);
      
      return { status: 'ok', message: 'Successfully logged out of WhatsApp' };
    } catch (error) {
      console.error('Error logging out of WhatsApp:', error);
      return { status: 'error', message: error.message || 'Failed to logout' };
    }
  }

  @Post('validate-auth')
  async validateAuth(@Req() request: any, @Body() body: { recruiterId?: string }) {
    try {
      const apiToken = request.headers.authorization.split(' ')[1];
      const origin = request.headers.origin;
      const { recruiterId: providedRecruiterId } = body;

      let recruiterId = providedRecruiterId;

      // If no recruiterId provided, get from current user
      if (!recruiterId) {
        const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(apiToken, origin);
        recruiterId = currentUser?.workspaceMember?.id;

        if (!recruiterId) {
          return { 
            status: 'error', 
            message: 'Could not determine recruiter ID. Please provide recruiterId in request body.' 
          };
        }
      }

      console.log(`Validating auth state for recruiter: ${recruiterId}`);

      // Get the WhatsApp service instance for this recruiter
      const whatsappService = this.eventsGateway.getWhatsappService(recruiterId);
      if (!whatsappService) {
        return {
          status: 'error',
          message: 'WhatsApp service not found for this recruiter. Please initialize WhatsApp first.'
        };
      }

      // Validate auth state
      const authValidation = await whatsappService.validateAuthState();

      return {
        status: 'ok',
        data: {
          recruiterId,
          authValidation,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('Error validating auth state:', error);
      return { 
        status: 'error', 
        message: error.message || 'Failed to validate auth state' 
      };
    }
  }

  @Post('recover-auth')
  async recoverAuth(@Req() request: any, @Body() body: { recruiterId?: string }) {
    try {
      const apiToken = request.headers.authorization.split(' ')[1];
      const origin = request.headers.origin;
      const { recruiterId: providedRecruiterId } = body;

      let recruiterId = providedRecruiterId;

      // If no recruiterId provided, get from current user
      if (!recruiterId) {
        const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(apiToken, origin);
        recruiterId = currentUser?.workspaceMember?.id;

        if (!recruiterId) {
          return { 
            status: 'error', 
            message: 'Could not determine recruiter ID. Please provide recruiterId in request body.' 
          };
        }
      }

      console.log(`Attempting auth recovery for recruiter: ${recruiterId}`);

      // Get the WhatsApp service instance for this recruiter
      const whatsappService = this.eventsGateway.getWhatsappService(recruiterId);
      if (!whatsappService) {
        return {
          status: 'error',
          message: 'WhatsApp service not found for this recruiter. Please initialize WhatsApp first.'
        };
      }

      // Attempt auth recovery
      const recovered = await whatsappService.recoverFromAuthCorruption();

      return {
        status: recovered ? 'ok' : 'error',
        message: recovered ? 'Auth recovery completed successfully' : 'Auth recovery failed',
        data: {
          recruiterId,
          recovered,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('Error recovering auth:', error);
      return { 
        status: 'error', 
        message: error.message || 'Failed to recover auth state' 
      };
    }
  }

  @Post('restart-connection')
  async restartConnection(@Req() request: any, @Body() body: { recruiterId?: string; forceNewQR?: boolean, recruiterName?: string }) {
    try {
      const apiToken = request.headers.authorization.split(' ')[1];
      const origin = request.headers.origin;
      const { recruiterId: providedRecruiterId, forceNewQR = false, recruiterName: providedRecruiterName } = body;

      let recruiterId = providedRecruiterId;

      let recruiterName = providedRecruiterName;
      // If no recruiterId provided, get from current user
      if (!recruiterId) {
        const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(apiToken, origin);
        recruiterName = currentUser?.workspaceMember?.name.firstName + ' ' + currentUser?.workspaceMember?.name.lastName;
        recruiterId = currentUser?.workspaceMember?.id;

        if (!recruiterId) {
          return { 
            status: 'error', 
            message: 'Could not determine recruiter ID. Please provide recruiterId in request body.' 
          };
        }
      }

      console.log(`Restarting WhatsApp connection for recruiter: ${recruiterId}, forceNewQR: ${forceNewQR}`);

      // Get the WhatsApp service instance for this recruiter
      const whatsappService = this.eventsGateway.getWhatsappService(recruiterId);
      if (!whatsappService) {
        return {
          status: 'error',
          message: 'WhatsApp service not found for this recruiter. Please initialize WhatsApp first.'
        };
      }

      // Handle restart based on forceNewQR flag
      if (forceNewQR) {
        // Clear auth and restart with new QR code
        await whatsappService.clearAuthAndRestart(true);
        console.log(`Cleared auth and restarted with new QR for recruiter: ${recruiterId}`);
      } else {
        // Soft restart - preserve credentials and just restart the connection
        await whatsappService.softRestart();
        console.log(`Soft restarted connection preserving credentials for recruiter: ${recruiterId}`);
      }

      // Notify client about connection status change
      this.eventsGateway.emitEventTo('isWhatsappLoggedIn', false, recruiterId, recruiterName);

      return {
        status: 'ok',
        message: `Successfully restarted WhatsApp connection for recruiter ${recruiterId}. ${forceNewQR ? 'New QR code will be generated.' : 'Reconnecting with existing credentials.'}`,
        data: {
          recruiterId,
          forceNewQR,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('Error restarting WhatsApp connection:', error);
      return { 
        status: 'error', 
        message: error.message || 'Failed to restart WhatsApp connection' 
      };
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
      let recruiterName = currentUser?.workspaceMember?.name.firstName + ' ' + currentUser?.workspaceMember?.name.lastName;
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
      const messageId = await this.eventsGateway.sendWhatsappMessage(message, jid, recruiterId, recruiterName);
      console.log("messageId when message is sent::", messageId, "for the message::", message);
      if (messageId === 'failed') {
        // Additional notification via candidate-sourcing controller's notification system
        await this.notifyFailedWhatsAppMessage(recruiterId, phoneNumber, message, recruiterName);
        
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

  private async notifyFailedWhatsAppMessage(recruiterId: string, phoneNumber: string, message: string, recruiterName?: string) {
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
        }, recruiterId, recruiterName);
      }
      
      console.log('Additional WhatsApp failure notification sent');
    } catch (notificationError) {
      console.error('Error sending additional WhatsApp failure notification:', notificationError);
    }
  }

  /**
   * Find candidate by phone number across all workspaces
   */
  private async findCandidateByPhoneNumber(phoneNumber: string, apiToken: string): Promise<any> {
    try {
      // Get all workspaces and search for candidate with this phone number
      const results = await this.workspaceQueryService.executeQueryAcrossWorkspaces(
        async (workspaceId, dataSourceSchema) => {
          const query = `
            SELECT c.id, c."peopleId", c."phoneNumberPrimaryPhoneNumber", c."name"
            FROM ${dataSourceSchema}.candidate c
            WHERE c."phoneNumberPrimaryPhoneNumber" ILIKE '%${phoneNumber}%'
            LIMIT 1
          `;
          
          const result = await this.workspaceQueryService.executeRawQuery(
            query,
            [],
            workspaceId,
          );
          
          return result.length > 0 ? result[0] : null;
        }
      );

      // Find the first valid result
      const validResults = results.filter(result => result !== null);
      if (validResults.length > 0) {
        console.log(`✅ Found candidate: ${validResults[0].id} for phone number: ${phoneNumber}`);
        return validResults[0];
      }

      console.log(`⚠️ No candidate found for phone number: ${phoneNumber}`);
      return null;

    } catch (error) {
      console.error('Error finding candidate by phone number:', error);
      return null;
    }
  }
}
