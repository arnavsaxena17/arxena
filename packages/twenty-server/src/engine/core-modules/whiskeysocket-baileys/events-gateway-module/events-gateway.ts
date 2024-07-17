import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import axios from 'axios';
import * as fs from 'fs';
import { WhatsappService } from '../whiskeysocket-baileys.service';

@WebSocketGateway({
  cors: {
    origin: '*', // Adjust the CORS settings according to your needs
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private _isWhatsappLoggedIn: boolean;
  private _workspaceMemberId: string;
  private whatsappServices: Map<string, WhatsappService> = new Map();

  constructor() {
    this.loadSessionIds();
  }

  public get getWorkspaceMemberId() {
    return this._workspaceMemberId;
  }

  set isWhatsappLoggedIn(value: boolean) {
    this._isWhatsappLoggedIn = value;
    // this.emitEvent('isWhatsappLoggedIn', this._isWhatsappLoggedIn);
  }

  async handleConnection(client: Socket) {
    const user = client?.handshake?.auth?.user;
    console.log('Client connected:', client.id);
    const socketClientId = client?.id;
    console.log('socketClientId:', socketClientId);
    console.log('query token:', client?.handshake?.query?.token);

    // const { workspaceMemberId, workspaceId } = await new SocketVerifyAuth.socketVerifyAuthVerify((client?.handshake?.query?.token as string) || '');
    try {
      const headers = {
        Authorization: `Bearer ${client?.handshake?.query?.token}`,
      };
      const response = await axios.get('http://localhost:3000/socket-auth/verify', { headers });

      console.log('UserId connected:', response?.data);
      const workspaceMemberId = response?.data;

      const sessionId = workspaceMemberId;

      if (!this.whatsappServices.has(sessionId)) {
        const whatsappService = new WhatsappService(this, sessionId, socketClientId);
        this.whatsappServices.set(sessionId, whatsappService);
        this.saveSessionId(sessionId);
      } else {
        console.log('342323::', socketClientId);
        //@ts-ignore
        this.whatsappServices.get(sessionId).setSocketClientId(socketClientId);
        this.whatsappServices.get(sessionId)?.sendConnectionUpdate();
      }

      // this._workspaceMemberId = response?.data;
      // client.emit('isWhatsappLoggedIn', this.isWhatsappLoggedIn);
    } catch (error) {
      console.error('Error verifying access token:', error);
      client.disconnect();
    }
    // console.log('isWhatsappLoggedIn:', this.isWhatsappLoggedIn);
  }

  handleDisconnect(client: Socket) {
    console.log('Client disconnected:', client.id);
  }

  emitEventTo(event: string, data: any, socketClientId: string) {
    this?.server?.to(socketClientId).emit(event, data);
  }

  private saveSessionId(sessionId: string) {
    const filePath = './sessionIds.json';
    let sessionIds = [];
    if (fs.existsSync(filePath)) {
      sessionIds = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    //@ts-ignore
    if (!sessionIds.includes(sessionId)) {
      //@ts-ignore
      sessionIds.push(sessionId);
      fs.writeFileSync(filePath, JSON.stringify(sessionIds));
    }
  }

  private loadSessionIds() {
    const filePath = './sessionIds.json';
    if (fs.existsSync(filePath)) {
      const sessionIds = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      sessionIds.forEach((sessionId: string) => {
        const whatsappService = new WhatsappService(this, sessionId, '');
        this.whatsappServices.set(sessionId, whatsappService);
      });
    }
  }
}
