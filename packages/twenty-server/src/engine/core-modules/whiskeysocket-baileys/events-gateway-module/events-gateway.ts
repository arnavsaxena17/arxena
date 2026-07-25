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
        const sessionData: Array<{recruiterId: string, recruiterName?: string}> = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        console.log(`Found ${sessionData.length} saved WhatsApp sessions`);
        
        for (const session of sessionData) {
          const recruiterId = session.recruiterId;
          const recruiterName = session.recruiterName || 'Unknown User';
          const authPath = `baileys_auth_info/${recruiterId}`;
          if (fs.existsSync(authPath)) {
            console.log(`Initializing WhatsApp service for recruiter: ${recruiterId} (${recruiterName})`);
            await this.sessionManager.getOrCreateSession(recruiterId, this, recruiterName);
          } else {
            console.log(`Auth files not found for recruiter: ${recruiterId}, skipping initialization`);
          }
        }
      } else {
        console.log('No saved sessions found');
      }


    } catch (error) {
      console.error('Error initializing saved WhatsApp sessions:', error);
    }
  }

  set isWhatsappLoggedIn(value: boolean) {
    this._isWhatsappLoggedIn = value;
  }

  private getRecruiterRoom(recruiterId: string): string {
    return `baileys-recruiter-${recruiterId}`;
  }

  async handleConnection(client: Socket) {
    console.log('Socket client connected in events-gateway:', client.id);
    try {
      const token = client?.handshake?.query?.token;
      const origin = client?.handshake?.headers?.origin;
      const workspaceMemberName = client?.handshake?.query?.workspaceMemberName;
      if (!token || typeof token !== 'string') {
        throw new Error('Invalid token');
      }
      const recruiterId = client?.handshake?.query?.workspaceMemberId;
      
      // Handle workspaceMemberName which might be an object with firstName/lastName or a string
      let recruiterName = '';
      if (typeof workspaceMemberName === 'string') {
        recruiterName = workspaceMemberName;
      } else if (workspaceMemberName && typeof workspaceMemberName === 'object') {
        // Handle object with firstName/lastName properties
        if ((workspaceMemberName as any).firstName && (workspaceMemberName as any).lastName) {
          recruiterName = `${(workspaceMemberName as any).name.firstName} ${(workspaceMemberName as any).name.lastName}`;
        } else if ((workspaceMemberName as any).toString) {
          recruiterName = (workspaceMemberName as any).toString();
        } else {
          recruiterName = 'Unknown User';
        }
      } else {
        recruiterName = 'Unknown User';
      }  
      // Stricter validation for recruiterId
      if (!recruiterId || typeof recruiterId !== 'string' || recruiterId === 'undefined') {
        console.error('Invalid or missing workspaceMemberId in socket connection');
        client.disconnect();
        return;
      }

      console.log("Recruiter connected:", recruiterId, "recruiterName:", recruiterName);

      // Join the recruiter's BAILEYS room
      const recruiterRoom = this.getRecruiterRoom(recruiterId);
      await client.join(recruiterRoom);
      console.log(`BAILEYS-SOCKET client ${client.id} joined room ${recruiterRoom} for recruiter ${recruiterName}`);

      // Always use getOrCreateSession to handle session management properly
      console.log("Getting or creating WhatsApp service instance for recruiter:", recruiterId, "recruiterName:", recruiterName);
      const whatsappService = await this.sessionManager.getOrCreateSession(recruiterId, this, recruiterName);
      this.saveRecruiterId(recruiterId, recruiterName);
      
      // Emit recruiter details to the client after session is ready
      console.log("Emitting recruiter details to client:", client.id, "recruiterName:", recruiterName);
      client.emit('recruiterDetails', {
        id: recruiterId,
        name: recruiterName,
        timestamp: new Date().toISOString()
      });
      
      // Send connection update and QR if available
      whatsappService.sendConnectionUpdate();
      if (whatsappService.whatsappLoginQrString) {
        console.log("Re-emitting existing QR code for recruiter:", recruiterId, "recruiterName:", recruiterName);
        this.emitEventTo('qr', whatsappService.whatsappLoginQrString, recruiterId, recruiterName);
      }
    } catch (error) {
      console.error('Error in handleConnection:', error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    console.log('BAILEYS-SOCKET client disconnected:', client.id);
    
    // Get all rooms this client was in
    const clientRooms = Array.from(client.rooms);
    
    // Find the baileys recruiter room (if any)
    const recruiterRoom = clientRooms.find(room => room.startsWith('baileys-recruiter-'));
    if (recruiterRoom) {
      const recruiterId = recruiterRoom.replace('baileys-recruiter-', '');
      
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

  emitEventTo(event: string, data: any, recruiterId: string, recruiterName?: string) {
    const recruiterRoom = this.getRecruiterRoom(recruiterId);
    this.server.to(recruiterRoom).emit(event, data);
  }

  getServer(): Server {
    return this.server;
  }

  private saveRecruiterId(recruiterId: string, recruiterName?: string) {
    const filePath = './sessionIds.json';
    let sessionData: Array<{recruiterId: string, recruiterName?: string}> = [];
    if (fs.existsSync(filePath)) {
      const existingData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (Array.isArray(existingData) && existingData.length > 0 && typeof existingData[0] === 'string') {
        sessionData = existingData.map(id => ({ recruiterId: id, recruiterName: 'Unknown User' }));
      } else {
        sessionData = existingData;
      }
    }
    
    // Check if recruiterId already exists
    const existingSession = sessionData.find(session => session.recruiterId === recruiterId);
    if (!existingSession) {
      sessionData.push({ recruiterId, recruiterName: recruiterName || 'Unknown User' });
      fs.writeFileSync(filePath, JSON.stringify(sessionData));
    } else if (recruiterName && existingSession.recruiterName !== recruiterName) {
      // Update the name if it's different
      existingSession.recruiterName = recruiterName;
      fs.writeFileSync(filePath, JSON.stringify(sessionData));
    }
  }

  async sendWhatsappMessage(message: string, jid: string, recruiterId: string, recruiterName: string) {
    try {
      console.log('Sending WhatsApp message:', { recruiterId, jid, message, recruiterName });
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
      await this.notifyWhatsAppMessageFailure(recruiterId, jid, message, error.message, recruiterName);
      
      return "failed";
    }
  }

  private async notifyWhatsAppMessageFailure(recruiterId: string, jid: string, message: string, errorMessage: string, recruiterName?: string) {
    try {
      console.log('Sending WhatsApp failure notification for recruiter:', recruiterName);
      const phoneNumber = jid.replace('@s.whatsapp.net', '');
      this.emitEventTo('whatsapp_message_failed', {
        phoneNumber,
        message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
        error: errorMessage,
        timestamp: new Date().toISOString(),
        jid
      }, recruiterId, recruiterName);
      this.emitEventTo('show_notification', {
        title: 'WhatsApp Message Failed',
        body: `Failed to send message to ${phoneNumber}. ${errorMessage}`,
        icon: '/favicon.ico',
        tag: `whatsapp-failed-${phoneNumber}`,
        requireInteraction: true
      }, recruiterId, recruiterName);
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

  public async logoutSession(recruiterId: string, recruiterName?: string): Promise<void> {
    return this.sessionManager.logoutSession(recruiterId);
  }

  public async getSessionMetrics() {
    return await this.sessionManager.getSessionMetrics(this);
  }

  public getRegisteredSessionCount(): number {
    return this.sessionManager.getRegisteredSessionCount();
  }

  public async getOrCreateSession(recruiterId: string, recruiterName?: string): Promise<BaileysWhatsappService> {
    return await this.sessionManager.getOrCreateSession(recruiterId, this, recruiterName);
  }

  async onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Shutdown session manager
    await this.sessionManager.shutdown();
  }
}
