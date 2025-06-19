import { Injectable } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import * as fs from 'fs';
import { Server, Socket } from 'socket.io';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { MessageDto } from '../types/baileys-types';
import { WhatsappService } from '../whiskeysocket-baileys.service';

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
export class EventsGateway implements OnGatewayConnection<Socket>, OnGatewayDisconnect<Socket> {
  @WebSocketServer() server: Server;

  private _isWhatsappLoggedIn: boolean;
  private _workspaceMemberId: string;
  private whatsappServices: Map<string, WhatsappService> = new Map();
  private clientToSessionMap: Map<string, string> = new Map();

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly whatsappService: WhatsappService
  ) {}

  public get getWorkspaceMemberId() {
    return this._workspaceMemberId;
  }

  set isWhatsappLoggedIn(value: boolean) {
    this._isWhatsappLoggedIn = value;
  }

  async handleConnection(client: Socket) {
    console.log('Client connected in handle connection:', client.id);
    console.log('query token:', client?.handshake?.query?.token);

    try {
      const token = client?.handshake?.query?.token;
      if (!token || typeof token !== 'string') {
        throw new Error('Invalid token');
      }

      const workspaceUserId = await this.workspaceQueryService.getWorkspaceIdFromToken(token);
      const sessionId = workspaceUserId;

      // Map client ID to session ID for event routing
      this.clientToSessionMap.set(client.id, sessionId);

      if (!this.whatsappServices.has(sessionId)) {
        console.log("Initializing session in handle connection");
        const whatsappService = this.whatsappService;
        whatsappService.initializeSession(sessionId, this);
        this.whatsappServices.set(sessionId, whatsappService);
        this.saveSessionId(sessionId);
      } else {
        console.log("Session already exists in handle connection");
        const service = this.whatsappServices.get(sessionId);
        if (service) {
          service.sendConnectionUpdate();
          console.log("whatsappLoginQrString::", service.whatsappLoginQrString);
          this.emitEventTo('qr', service.whatsappLoginQrString, sessionId);
        }
      }

    } catch (error) {
      console.error('Error verifying access token:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log('Client disconnected:', client.id);
    this.clientToSessionMap.delete(client.id);
  }

  emitEventTo(event: string, data: any, sessionId: string) {
    // Find all clients for this session
    const clientIds = Array.from(this.clientToSessionMap.entries())
      .filter(([_, sid]) => sid === sessionId)
      .map(([cid]) => cid);

    // Emit to all clients associated with this session
    clientIds.forEach(clientId => {
      this?.server?.to(clientId).emit(event, data);
    });
  }

  private saveSessionId(sessionId: string) {
    const filePath = './sessionIds.json';
    let sessionIds: string[] = [];
    if (fs.existsSync(filePath)) {
      sessionIds = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    if (!sessionIds.includes(sessionId)) {
      sessionIds.push(sessionId);
      fs.writeFileSync(filePath, JSON.stringify(sessionIds));
    }
  }

  async sendWhatsappMessage(message: string, jid: string, sessionId: string) {
    try {
      console.log('Got to sendWhatsappMssage in Events Gateway');
      console.log('sessionId:', sessionId);
      console.log('jid:', jid);
      console.log('message:', message);
      const messageId: string = await this.whatsappServices.get(sessionId)?.sendMessageWTyping(message, jid);
      return messageId;
    } catch (error) {
      console.error('Error sending message:', error);
      return "failed";
    }
  }

  async sendWhatsappFile(payload: { recruiterId: string; fileToSendData: MessageDto }) {
    const messageId: string = await this.whatsappServices.get(payload?.recruiterId)?.sendMessageFileToBaileys(payload?.fileToSendData);
    return messageId;
  }
  
  async receiveMessages(payload: { recruiterId: string; fileToSendData: MessageDto }) {
    const messageId: string = await this.whatsappServices.get(payload?.recruiterId)?.sendMessageFileToBaileys(payload?.fileToSendData);
    return messageId;
  }
}
