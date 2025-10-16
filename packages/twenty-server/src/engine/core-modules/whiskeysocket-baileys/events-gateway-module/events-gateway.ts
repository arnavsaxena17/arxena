import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import * as fs from 'fs';
import { Server, Socket } from 'socket.io';
import { EmailService } from 'src/engine/core-modules/email/email.service';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { WhatsAppSessionManager } from '../session-manager';
import { MessageDto } from '../types/baileys-types';
import { BaileysWhatsappService } from '../whiskeysocket-baileys.service';

const apiToken = process.env.TWENTY_JWT_SECRET || '';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: [/localhost:\d+$/, /\.arxena\.com$/],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  path: '/baileys-socket'
})
export class EventsGateway implements OnGatewayConnection<Socket>, OnGatewayDisconnect<Socket>, OnModuleInit, OnModuleDestroy {
  @WebSocketServer() server: Server;

  private _isWhatsappLoggedIn: boolean;
  private sessionManager: WhatsAppSessionManager;
  private cleanupInterval: NodeJS.Timeout;
  private static readonly CLEANUP_INTERVAL_MS = 300000; // Run cleanup every 5 minutes
  private static readonly CLEANUP_DELAY_MS = 60000; // Wait 1 minute before cleanup

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly emailService: EmailService,
    private readonly environmentService: EnvironmentService,
    @InjectMessageQueue(MessageQueue.engagedCandidateProcessingQueue) private readonly messageQueueService?: MessageQueueService,
  ) {
    console.log('EventsGateway constructor called with queue service:', !!this.messageQueueService);
    this.sessionManager = new WhatsAppSessionManager(
      this.workspaceQueryService,
      this.staticGraphQLService,
      this.messageQueueService!,
      50, // max sessions
      300000, // session timeout (5 minutes)
      3 // max connections per session
    );
  }

  async onModuleInit() {
    console.log('Initializing WhatsApp sessions from saved credentials...');
    try {
      const filePath = './sessionIds.json';
      if (fs.existsSync(filePath)) {
        const recruiterIds: string[] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        console.log(`Found ${recruiterIds.length} saved WhatsApp sessions`);
        
        for (const recruiterId of recruiterIds) {
          const authPath = `baileys_auth_info/${recruiterId}`;
          if (fs.existsSync(authPath)) {
            console.log(`Initializing WhatsApp service for recruiter: ${recruiterId}`);
            await this.sessionManager.getOrCreateSession(recruiterId, this);
          } else {
            console.log(`Auth files not found for recruiter: ${recruiterId}, skipping initialization`);
          }
        }
      } else {
        console.log('No saved sessions found');
      }

      this.cleanupInterval = setInterval(() => {
        console.log('Running periodic cleanup of inactive WhatsApp sessions');
        // Cleanup is now handled by session manager
      }, EventsGateway.CLEANUP_INTERVAL_MS);

    } catch (error) {
      console.error('Error initializing saved WhatsApp sessions:', error);
    }
  }

  set isWhatsappLoggedIn(value: boolean) {
    this._isWhatsappLoggedIn = value;
  }

  private getRecruiterRoom(recruiterId: string): string {
    return `recruiter-${recruiterId}`;
  }

  async handleConnection(client: Socket) {
    console.log('Socket client connected in events-gateway:', client.id);
    try {
      const token = client?.handshake?.query?.token;
      const origin = client?.handshake?.headers?.origin;
      console.log("token in handleConnection:", token);
      if (!token || typeof token !== 'string') {
        throw new Error('Invalid token');
      }
      console.log("token in handleConnection:", token);
      const recruiterId = client?.handshake?.query?.workspaceMemberId;

      // Stricter validation for recruiterId
      if (!recruiterId || typeof recruiterId !== 'string' || recruiterId === 'undefined') {
        console.error('Invalid or missing workspaceMemberId in socket connection');
        client.disconnect();
        return;
      }

      console.log("Recruiter connected:", { recruiterId });

      // Join the recruiter's room
      const recruiterRoom = this.getRecruiterRoom(recruiterId);
      await client.join(recruiterRoom);
      console.log(`Client ${client.id} joined room ${recruiterRoom}`);

      // Always use getOrCreateSession to handle session management properly
      console.log("Getting or creating WhatsApp service instance for recruiter:", recruiterId);
      const whatsappService = await this.sessionManager.getOrCreateSession(recruiterId, this);
      this.saveRecruiterId(recruiterId);
      
      // Emit recruiter details to the client after session is ready
      console.log("Emitting recruiter details to client:", client.id);
      client.emit('recruiterDetails', {
        id: recruiterId,
        name: `Recruiter ${recruiterId.slice(0, 8)}`, // Add a name for debugging
        timestamp: new Date().toISOString()
      });
      
      // Send connection update and QR if available
      whatsappService.sendConnectionUpdate();
      if (whatsappService.whatsappLoginQrString) {
        console.log("Re-emitting existing QR code for recruiter:", recruiterId);
        this.emitEventTo('qr', whatsappService.whatsappLoginQrString, recruiterId);
      }
    } catch (error) {
      console.error('Error in handleConnection:', error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    console.log('Socket client disconnected:', client.id);
    
    // Get all rooms this client was in
    const clientRooms = Array.from(client.rooms);
    
    // Find the recruiter room (if any)
    const recruiterRoom = clientRooms.find(room => room.startsWith('recruiter-'));
    if (recruiterRoom) {
      const recruiterId = recruiterRoom.replace('recruiter-', '');
      
      // Check if there are any other clients in this room
      const room = await this.server.in(recruiterRoom).allSockets();
      const remainingClients = room.size;

      if (remainingClients === 0) {
        console.log('No other clients connected for recruiter, scheduling cleanup');
        // Schedule cleanup after a delay if no reconnection occurs
        setTimeout(async () => {
          const currentRoom = await this.server.in(recruiterRoom).allSockets();
          if (currentRoom.size === 0) {
            console.log('Cleaning up inactive WhatsApp service for recruiter:', recruiterId);
            await this.sessionManager.removeSession(recruiterId);
          }
        }, EventsGateway.CLEANUP_DELAY_MS);
      } else {
        console.log(`${remainingClients - 1} other clients still connected for recruiter`);
      }
    }
  }

  emitEventTo(event: string, data: any, recruiterId: string) {
    const recruiterRoom = this.getRecruiterRoom(recruiterId);
    this.server.to(recruiterRoom).emit(event, data);
    console.log('Emitting event:', event, 'to recruiter in events-gateway:', recruiterId, 'data:', typeof data === 'boolean' ? data : 'object');
  }

  getServer(): Server {
    return this.server;
  }

  private saveRecruiterId(recruiterId: string) {
    const filePath = './sessionIds.json';
    let recruiterIds: string[] = [];
    if (fs.existsSync(filePath)) {
      recruiterIds = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    if (!recruiterIds.includes(recruiterId)) {
      recruiterIds.push(recruiterId);
      fs.writeFileSync(filePath, JSON.stringify(recruiterIds));
    }
  }

  async sendWhatsappMessage(message: string, jid: string, recruiterId: string) {
    try {
      console.log('Sending WhatsApp message:', { recruiterId, jid, message });
      const whatsappService = this.sessionManager.getSession(recruiterId);
      if (!whatsappService) {
        throw new Error('WhatsApp service not found for recruiter: ' + recruiterId);
      }
      const messageId: string = await whatsappService.sendMessageWTyping(message, jid);
      console.log("messageId when message is sent::", messageId, "for the message::", message);
      return messageId;
    } catch (error) {
      console.error('Error sending WhatsApp in events-gateway:', error);
      
      // Send notification about failed WhatsApp message
      await this.notifyWhatsAppMessageFailure(recruiterId, jid, message, error.message);
      
      return "failed";
    }
  }

  private async notifyWhatsAppMessageFailure(recruiterId: string, jid: string, message: string, errorMessage: string) {
    try {
      console.log('Sending WhatsApp failure notification for recruiter:', recruiterId);
      
      // Extract phone number from JID
      const phoneNumber = jid.replace('@s.whatsapp.net', '');
      
      // Send WebSocket notification
      this.emitEventTo('whatsapp_message_failed', {
        phoneNumber,
        message: message.substring(0, 100) + (message.length > 100 ? '...' : ''), // Truncate long messages
        error: errorMessage,
        timestamp: new Date().toISOString(),
        jid
      }, recruiterId);

      // Send browser notification event
      this.emitEventTo('show_notification', {
        title: 'WhatsApp Message Failed',
        body: `Failed to send message to ${phoneNumber}. ${errorMessage}`,
        icon: '/favicon.ico',
        tag: `whatsapp-failed-${phoneNumber}`,
        requireInteraction: true
      }, recruiterId);

      // Send email notification
      // await this.sendWhatsAppFailureEmail(recruiterId, phoneNumber, message, errorMessage);

      console.log('WhatsApp failure notifications sent successfully');
    } catch (notificationError) {
      console.error('Error sending WhatsApp failure notifications:', notificationError);
    }
  }

  private async sendWhatsAppFailureEmail(recruiterId: string, phoneNumber: string, message: string, errorMessage: string) {
    try {
      // Get recruiter information for email
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      if (!workspaceId) {
        console.error('Could not get workspace ID for email notification');
        return;
      }

      // Get recruiter email (you might need to implement this based on your user service)
      // For now, we'll use a generic approach
      const recruiterEmail = process.env.ADMIN_EMAIL || 'admin@arxena.com';
      
      const emailSubject = 'WhatsApp Message Delivery Failed';
      const emailBody = `
        <h2>WhatsApp Message Delivery Failed</h2>
        <p><strong>Recruiter ID:</strong> ${recruiterId}</p>
        <p><strong>Phone Number:</strong> ${phoneNumber}</p>
        <p><strong>Error:</strong> ${errorMessage}</p>
        <p><strong>Message:</strong> ${message.substring(0, 200)}${message.length > 200 ? '...' : ''}</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <br>
        <p>Please check your WhatsApp connection and try sending the message again.</p>
        <p>If this issue persists, please contact support.</p>
      `;

      await this.emailService.send({
        from: `${this.environmentService.get('EMAIL_FROM_NAME')} <${this.environmentService.get('EMAIL_FROM_ADDRESS')}>`,
        to: recruiterEmail,
        bcc: this.environmentService.get('EMAIL_SYSTEM_ADDRESS'),
        subject: emailSubject,
        html: emailBody,
        text: emailBody.replace(/<[^>]*>/g, ''), // Strip HTML for text version
      });

      console.log('WhatsApp failure email sent successfully');
    } catch (emailError) {
      console.error('Error sending WhatsApp failure email:', emailError);
    }
  }

  async sendWhatsappFile(payload: { recruiterId: string; fileToSendData: MessageDto }) {
    const whatsappService = this.sessionManager.getSession(payload.recruiterId);
    if (!whatsappService) {
      throw new Error('WhatsApp service not found for recruiter: ' + payload.recruiterId);
    }
    const messageId: string = await whatsappService.sendMessageFileToBaileys(payload.fileToSendData);
    return messageId;
  }
  
  async receiveMessages(payload: { recruiterId: string; fileToSendData: MessageDto }) {
    const whatsappService = this.sessionManager.getSession(payload.recruiterId);
    if (!whatsappService) {
      throw new Error('WhatsApp service not found for recruiter: ' + payload.recruiterId);
    }
    const messageId: string = await whatsappService.sendMessageFileToBaileys(payload.fileToSendData);
    return messageId;
  }

  public getWhatsappService(recruiterId: string): BaileysWhatsappService | undefined {
    return this.sessionManager.getSession(recruiterId);
  }

  public deleteWhatsappService(recruiterId: string): void {
    this.sessionManager.removeSession(recruiterId);
  }

  public setWhatsappService(recruiterId: string, service: BaileysWhatsappService): void {
    // This method is no longer needed with session manager
    console.warn('setWhatsappService is deprecated, use sessionManager instead');
  }

  public hasWhatsappService(recruiterId: string): boolean {
    return this.sessionManager.hasSession(recruiterId);
  }

  // Add methods to expose session manager functionality
  public getSessionCount(): number {
    return this.sessionManager.getSessionCount();
  }

  public getActiveSessionCount(): number {
    return this.sessionManager.getActiveSessionCount();
  }

  public async logoutSession(recruiterId: string): Promise<void> {
    return this.sessionManager.logoutSession(recruiterId);
  }

  public async getSessionMetrics() {
    return await this.sessionManager.getSessionMetrics(this);
  }

  public getRegisteredSessionCount(): number {
    return this.sessionManager.getRegisteredSessionCount();
  }

  public async getOrCreateSession(recruiterId: string): Promise<BaileysWhatsappService> {
    return await this.sessionManager.getOrCreateSession(recruiterId, this);
  }

  async onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Shutdown session manager
    await this.sessionManager.shutdown();
  }
}
