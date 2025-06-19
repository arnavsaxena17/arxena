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
    const user = client?.handshake?.auth?.user;
    console.log('Client connected in handle connection:', client.id);
    const socketClientId = client?.id;
    console.log('socketClientId:', socketClientId);
    console.log('query token:', client?.handshake?.query?.token);

    try {
      const headers = {
        Authorization: `Bearer ${client?.handshake?.query?.token}`,
      };
      console.log("headers in handle connection:", headers)
      // const response = await axios.get('http://localhost:3000/socket-auth/verify', { headers });

      const token = client?.handshake?.query?.token;
      if (!token || typeof token !== 'string') {
        throw new Error('Invalid token');
      }
      // console.log("workspaceUserId in handle connection:", workspaceUserId);
      // const graphqlVariableToFilterWorkspaceMember = { filter: { userId: { eq: workspaceUserId } } };
      // let responseAfterQueryingWorkspaceMember;
      // try {
      //   responseAfterQueryingWorkspaceMember = await axiosRequest(
      //     JSON.stringify({
      //       query: FindManyWorkspaceMembers,
      //       variables: graphqlVariableToFilterWorkspaceMember,
      //     }),
      //     apiToken
      //   );

        // console.log('response in handle connection:', response?.data);
        // } catch (error) {
        //   console.error('Error querying workspace member:', error);
        // }
      const workspaceUserId = await this.workspaceQueryService.getWorkspaceIdFromToken(token);

      // const workspaceMemberId = responseAfterQueryingWorkspaceMember?.data?.data?.workspaceMembers?.edges[0]?.node?.id;
      // console.log('responseAfterQueryingWorkspaceMember:', workspaceMemberId);
      const sessionId = workspaceUserId;

      if (!this.whatsappServices.has(sessionId)) {
        console.log("Initializing session in handle connection")
        const whatsappService = this.whatsappService;
        whatsappService.initializeSession(sessionId, socketClientId, this);
        this.whatsappServices.set(sessionId, whatsappService);
        this.saveSessionId(sessionId);
      } else {
        console.log("Session already exists in handle connection")
        console.log('342323::', socketClientId);
        this.whatsappServices.get(sessionId)?.setSocketClientId(socketClientId);
        this.whatsappServices.get(sessionId)?.sendConnectionUpdate();
        console.log("whatsappLoginQrString::", this.whatsappServices.get(sessionId)?.whatsappLoginQrString)
        console.log(
          "Sending qr to client::",
          this.whatsappServices.get(sessionId)?.whatsappLoginQrString,
          socketClientId
        )
        this.emitEventTo('qr', this.whatsappServices.get(sessionId)?.whatsappLoginQrString, socketClientId);
      }

    } catch (error) {
      console.error('Error verifying access token:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log('Client disconnected:', client.id);
  }

  emitEventTo(event: string, data: any, socketClientId: string) {
    this?.server?.to(socketClientId).emit(event, data);
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

  private loadSessionIds() {
    const filePath = './sessionIds.json';
    if (fs.existsSync(filePath)) {
      const sessionIds: string[] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      console.log("Loaded sessionIds:", sessionIds);
      sessionIds.forEach((sessionId: string) => {
        const whatsappService = this.whatsappService;
        whatsappService.initializeSession(sessionId, '', this);
        this.whatsappServices.set(sessionId, whatsappService);
      });
    }
    else {
      console.log("Session IDs file not found")
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
    return messageId
  }
  
  async receiveMessages(payload: { recruiterId: string; fileToSendData: MessageDto }) {
    const messageId: string = await this.whatsappServices.get(payload?.recruiterId)?.sendMessageFileToBaileys(payload?.fileToSendData);
    return messageId
  }
}
