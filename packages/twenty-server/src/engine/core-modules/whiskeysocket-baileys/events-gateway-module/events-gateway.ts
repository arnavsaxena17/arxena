import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import * as fs from 'fs';
import { Server, Socket } from 'socket.io';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { MessageDto } from '../types/baileys-types';
import { BaileysWhatsappService } from '../whiskeysocket-baileys.service';

const apiToken = process.env.TWENTY_JWT_SECRET || '';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: [/\.localhost:3001$/, process.env.FRONTEND_URL],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  path: '/baileys-socket',
  transports: ['websocket', 'polling'],
})
export class EventsGateway implements OnGatewayConnection<Socket>, OnGatewayDisconnect<Socket>, OnModuleInit, OnModuleDestroy {
  @WebSocketServer() server: Server;

  private _isWhatsappLoggedIn: boolean;
  protected whatsappServices: Map<string, BaileysWhatsappService> = new Map();
  private cleanupInterval: NodeJS.Timeout;
  private static readonly CLEANUP_INTERVAL_MS = 300000; // Run cleanup every 5 minutes
  private static readonly CLEANUP_DELAY_MS = 60000; // Wait 1 minute before cleanup

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService
  ) {}

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
            const whatsappService = BaileysWhatsappService.getInstance(
              recruiterId,
              this.workspaceQueryService,
              this.staticGraphQLService
            );
            await whatsappService.initializeSession(recruiterId, this);
            this.whatsappServices.set(recruiterId, whatsappService);
          } else {
            console.log(`Auth files not found for recruiter: ${recruiterId}, skipping initialization`);
          }
        }
      } else {
        console.log('No saved sessions found');
      }

      this.cleanupInterval = setInterval(() => {
        console.log('Running periodic cleanup of inactive WhatsApp sessions');
        BaileysWhatsappService.cleanupInactiveSessions();
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
      if (!token || typeof token !== 'string') {
        throw new Error('Invalid token');
      }
      
      // const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(token as string, origin as string);
      // const recruiterId = currentUser?.workspaceMember?.id;
      const recruiterId:string = client?.handshake?.query?.workspaceMemberId as string;

      // const recruiterName = typeof currentUser?.workspaceMember?.name === 'string' 
      //   ? currentUser.workspaceMember.name 
      //   : typeof currentUser?.workspaceMember?.name === 'object' && currentUser?.workspaceMember?.name?.firstName
      //   ? `${currentUser.workspaceMember.name.firstName} ${currentUser.workspaceMember.name.lastName || ''}`
      //   : 'Unknown Recruiter';

      console.log("Recruiter connected:", { recruiterId });

      if (!recruiterId) {
        throw new Error('Could not determine recruiter ID');
      }

      // Join the recruiter's room
      const recruiterRoom = this.getRecruiterRoom(recruiterId);
      await client.join(recruiterRoom);
      console.log(`Client ${client.id} joined room ${recruiterRoom}`);

      // Emit recruiter details to the client
      client.emit('recruiterDetails', {
        id: recruiterId as string,
        // name: recruiterId
      });

      if (!this.whatsappServices.has(recruiterId)) {
        console.log("Creating new WhatsApp service instance for recruiter:", recruiterId);
        const whatsappService = BaileysWhatsappService.getInstance(
          recruiterId,
          this.workspaceQueryService,
          this.staticGraphQLService
        );
        await whatsappService.initializeSession(recruiterId, this);
        this.whatsappServices.set(recruiterId, whatsappService);
        this.saveRecruiterId(recruiterId);
      } else {
        console.log("Found existing WhatsApp service for recruiter:", recruiterId);
        const service = this.whatsappServices.get(recruiterId);
        if (service) {
          console.log("Sending connection update for existing service");
          service.sendConnectionUpdate();
          if (service.whatsappLoginQrString) {
            console.log("Re-emitting existing QR code for recruiter:", recruiterId);
            this.emitEventTo('qr', service.whatsappLoginQrString as string, recruiterId);
          }
        }
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
            const whatsappService = this.whatsappServices.get(recruiterId);
            if (whatsappService) {
              await whatsappService.clearAuthAndRestart(true).catch(err => {
                console.error('Error cleaning up WhatsApp service:', err);
              });
              this.whatsappServices.delete(recruiterId);
            }
          }
        }, EventsGateway.CLEANUP_DELAY_MS);
      } else {
        console.log(`${remainingClients - 1} other clients still connected for recruiter`);
      }
    }
  }

  emitEventTo(event: string, data: any, recruiterId: string) {
    console.log('Emitting event:', event, 'to recruiter:', recruiterId);
    
    const recruiterRoom = this.getRecruiterRoom(recruiterId);
    this.server.to(recruiterRoom).emit(event, data);
    console.log('Event emitted to room:', recruiterRoom);
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
      const whatsappService = this.whatsappServices.get(recruiterId);
      if (!whatsappService) {
        throw new Error('WhatsApp service not found for recruiter: ' + recruiterId);
      }
      const messageId: string = await whatsappService.sendMessageWTyping(message, jid);
      console.log("messageId when message is sent::", messageId, "for the message::", message);
      return messageId;
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      return "failed";
    }
  }

  async sendWhatsappFile(payload: { recruiterId: string; fileToSendData: MessageDto }) {
    const whatsappService = this.whatsappServices.get(payload.recruiterId);
    if (!whatsappService) {
      throw new Error('WhatsApp service not found for recruiter: ' + payload.recruiterId);
    }
    const messageId: string = await whatsappService.sendMessageFileToBaileys(payload.fileToSendData);
    return messageId;
  }
  
  async receiveMessages(payload: { recruiterId: string; fileToSendData: MessageDto }) {
    const whatsappService = this.whatsappServices.get(payload.recruiterId);
    if (!whatsappService) {
      throw new Error('WhatsApp service not found for recruiter: ' + payload.recruiterId);
    }
    const messageId: string = await whatsappService.sendMessageFileToBaileys(payload.fileToSendData);
    return messageId;
  }

  public getWhatsappService(recruiterId: string): BaileysWhatsappService | undefined {
    return this.whatsappServices.get(recruiterId);
  }

  public deleteWhatsappService(recruiterId: string): void {
    this.whatsappServices.delete(recruiterId);
  }

  public setWhatsappService(recruiterId: string, service: BaileysWhatsappService): void {
    this.whatsappServices.set(recruiterId, service);
  }

  public hasWhatsappService(recruiterId: string): boolean {
    return this.whatsappServices.has(recruiterId);
  }

  async onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}
