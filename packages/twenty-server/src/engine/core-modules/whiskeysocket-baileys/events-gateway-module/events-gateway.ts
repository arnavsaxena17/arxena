import { Injectable, OnModuleInit } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import * as fs from 'fs';
import { Server, Socket } from 'socket.io';
import { RecruiterProfileService } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';
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
export class EventsGateway implements OnGatewayConnection<Socket>, OnGatewayDisconnect<Socket>, OnModuleInit {
  @WebSocketServer() server: Server;

  private _isWhatsappLoggedIn: boolean;
  protected whatsappServices: Map<string, BaileysWhatsappService> = new Map();
  private clientToRecruiterMap: Map<string, string> = new Map();

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
    } catch (error) {
      console.error('Error initializing saved WhatsApp sessions:', error);
    }
  }

  set isWhatsappLoggedIn(value: boolean) {
    this._isWhatsappLoggedIn = value;
  }

  async handleConnection(client: Socket) {
    console.log('Socket client connected:', client.id);
    try {
      const token = client?.handshake?.query?.token;
      const origin = client?.handshake?.headers?.origin;
      if (!token || typeof token !== 'string') {
        throw new Error('Invalid token');
      }
      
      const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(token as string, origin as string);
      const recruiterId = currentUser?.workspaceMember?.id;
      const recruiterName = currentUser?.workspaceMember?.name;
      console.log("Recruiter connected:", { recruiterId, name: recruiterName });

      if (!recruiterId) {
        throw new Error('Could not determine recruiter ID');
      }

      console.log('Mapping socket client', client.id, 'to recruiter', recruiterId);
      this.clientToRecruiterMap.set(client.id, recruiterId);

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
            this.emitEventTo('qr', service.whatsappLoginQrString, recruiterId);
          }
        }
      }
    } catch (error) {
      console.error('Error in handleConnection:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log('Socket client disconnected:', client.id);
    const recruiterId = this.clientToRecruiterMap?.get(client.id);
    if (recruiterId) {
      console.log('Removing socket mapping for recruiter:', recruiterId);
      
      // Get the WhatsApp service instance for this recruiter
      const whatsappService = this.whatsappServices.get(recruiterId);
      if (whatsappService) {
        // Only cleanup socket mappings if no other clients are connected for this recruiter
        const otherClientsForRecruiter = Array.from(this.clientToRecruiterMap?.entries())
          .filter(([cId, rId]) => rId === recruiterId && cId !== client.id)
          .length;

        if (otherClientsForRecruiter === 0) {
          console.log('No other clients connected for recruiter, but keeping WhatsApp service active');
          // Note: We keep the WhatsApp service instance in the map
          // Only remove it on explicit logout
        } else {
          console.log(`${otherClientsForRecruiter} other clients still connected for recruiter`);
        }
      }
    }
    
    this.clientToRecruiterMap?.delete(client.id);
    // console.log('Current socket client to recruiter mappings:', Object.fromEntries(this.clientToRecruiterMap));
  }

  emitEventTo(event: string, data: any, recruiterId: string) {
    console.log('Emitting event:', event, 'to recruiter:', recruiterId);
    // console.log('Current socket client to recruiter mappings:', Object.fromEntries(this.clientToRecruiterMap));
    
    // Find all socket clients for this recruiter
    const socketClientIds = Array.from(this.clientToRecruiterMap?.entries())
      .filter(([_, rid]) => rid === recruiterId)
      .map(([clientId]) => clientId);

    console.log('Found socket clients for recruiter:', socketClientIds);

    if (socketClientIds.length === 0) {
      console.log('No socket clients found for recruiter:', recruiterId, 'Event will not be emitted:', event);
      return;
    }

    // Emit to all socket clients associated with this recruiter
    socketClientIds.forEach(clientId => {
      console.log('Attempting to emit', event, 'to socket client:', clientId);
      if (!this.server) {
        console.error('Socket server is not initialized');
        return;
      }
      const socket = this.server.sockets.sockets.get(clientId);
      if (!socket) {
        console.error('Socket not found for client:', clientId);
        return;
      }
      console.log('Socket found, emitting event');
      this.server.to(clientId).emit(event, data);
      console.log('Event emitted successfully');
    });
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
}
