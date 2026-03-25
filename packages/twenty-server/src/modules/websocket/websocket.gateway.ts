// websocket/websocket.gateway.ts
import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  WebSocketGateway as NestWebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UnipileAccountPoolService } from 'src/engine/core-modules/arx-chat/services/unipile-account-pool.service';
import { WebSocketService } from './websocket.service';

@NestWebSocketGateway({
  cors: {
    origin: [/localhost:\d+$/, /\.arxena\.com$/, 'https://arxena.arxena.com', 'https://app.arxena.com', 'https://web.whatsapp.com'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  path: '/general-socket',
})


export class WebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  private readonly logger = new Logger(WebSocketGateway.name);

  @WebSocketServer() server: Server;
  private connectedClients: Map<string, Set<string>> = new Map(); // workspaceMemberId -> Set of GENERAL-SOCKET socketIds

  constructor(
    readonly webSocketService: WebSocketService,
    private readonly unipileAccountPoolService: UnipileAccountPoolService,
  ) {}

  afterInit(server: Server) {
    this.webSocketService.setServer(server);
  }

  private getRecruiterRoom(recruiterId: string): string {
    return `general-recruiter-${recruiterId}`;
  }

  private addClientToWorkspaceMember(workspaceMemberId: string, socketId: string) {
    if (!this.connectedClients.has(workspaceMemberId)) {
      this.connectedClients.set(workspaceMemberId, new Set());
    }
    this.connectedClients.get(workspaceMemberId)?.add(socketId);
  }

  private displayNameFromHandshakeQuery(
    query: Socket['handshake']['query'],
  ): string | undefined {
    const raw = query?.userName ?? query?.workspaceMemberName;
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value !== 'string' || value === 'undefined' || value === 'null') {
      return undefined;
    }
    return value;
  }

  private removeClientFromWorkspaceMember(socketId: string): string | null {
    for (const [workspaceMemberId, clients] of this.connectedClients.entries()) {
      if (clients.has(socketId)) {
        clients.delete(socketId);
        if (clients.size === 0) {
          this.connectedClients.delete(workspaceMemberId);
        }
        return workspaceMemberId;
      }
    }
    return null;
  }

  private getClientsForWorkspaceMember(workspaceMemberId: string): string[] {
    const clients = this.connectedClients.get(workspaceMemberId);
    return clients ? Array.from(clients) : [];
  }

  async handleConnection(client: Socket) {
    try {
      const token = client?.handshake?.query?.token;
      const workspaceMemberId = client?.handshake?.query?.userId;
      const workspaceMemberName = this.displayNameFromHandshakeQuery(
        client.handshake.query,
      );
      if (!token || typeof token !== 'string') {
        throw new Error('Invalid or missing token');
      }

      if (!workspaceMemberId || typeof workspaceMemberId !== 'string' || workspaceMemberId === 'undefined' || workspaceMemberId === 'null') {
        console.error('Invalid workspaceMemberId:', workspaceMemberId);
        client.emit('connection_error', { message: 'Invalid or missing workspaceMemberId' });
        client.disconnect();
        return;
      }

      // Check if there's already an active GENERAL-SOCKET connection for this workspace member
      // Note: We only track general-socket connections here, not baileys-socket connections
      const existingClients = this.getClientsForWorkspaceMember(workspaceMemberId);
      const hadPriorSessions = existingClients.length > 0;
      if (hadPriorSessions) {
        const recruiterRoom = this.getRecruiterRoom(workspaceMemberId);
        for (const existingClientId of existingClients) {
          const existingClient =
            this.server.sockets.sockets.get(existingClientId);
          existingClient?.to(recruiterRoom).emit('user_disconnected', {
            clientId: existingClientId,
            workspaceMemberId,
            workspaceMemberName,
            timestamp: new Date().toISOString(),
          });
          this.removeClientFromWorkspaceMember(existingClientId);
          existingClient?.disconnect();
        }
      }
      // Add to tracking
      this.addClientToWorkspaceMember(workspaceMemberId, client.id);
      
      // Set up user mapping in WebSocketService
      this.webSocketService.setUserIdMapping(workspaceMemberId, client.id);

      // Join the recruiter's room
      const recruiterRoom = this.getRecruiterRoom(workspaceMemberId);
      await client.join(recruiterRoom);
      // Also join a room with the user's ID for direct messaging
      await client.join(workspaceMemberId);
      
      
      // Emit connection established
      client.emit('connection_established', { 
        clientId: client.id,
        userId: workspaceMemberId,
        message: 'Connected to WebSocket server'
      });
      
      // Emit recruiter details
      client.emit('recruiterDetails', {
        id: workspaceMemberId,
        name: workspaceMemberName
      });

      const label = workspaceMemberName ? ` ${workspaceMemberName}` : '';
      if (hadPriorSessions) {
        this.logger.log(
          `General socket: reconnect ${workspaceMemberId}${label} (${client.id}, dropped ${existingClients.length})`,
        );
      } else {
        this.logger.log(
          `General socket: connect ${workspaceMemberId}${label} (${client.id})`,
        );
      }

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(err.message, err.stack);
      client.emit('connection_error', { message: error.message });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const workspaceMemberId = this.removeClientFromWorkspaceMember(client.id);

    if (workspaceMemberId) {
      // Remove user mapping from WebSocketService
      this.webSocketService.removeUserIdMapping(workspaceMemberId);

      const recruiterRoom = this.getRecruiterRoom(workspaceMemberId);
      const workspaceMemberName =
        this.displayNameFromHandshakeQuery(client.handshake.query);
      const label = workspaceMemberName ? ` ${workspaceMemberName}` : '';
      this.logger.log(
        `General socket: disconnected ${workspaceMemberId}${label} (${client.id})`,
      );

      // Notify others in the room about the disconnection
      client.to(recruiterRoom).emit('user_disconnected', {
        clientId: client.id,
        workspaceMemberId,
        workspaceMemberName,
        timestamp: new Date().toISOString(),
      });

      // Disconnect Unipile pool account when last client for this member disconnects (tab close)
      // if (this.getClientsForWorkspaceMember(workspaceMemberId).length === 0) {
      //   this.unipileAccountPoolService
      //     .disconnectForMember(workspaceMemberId)
      //     .catch((err) =>
      //       console.warn(
      //         `Unipile disconnectForMember failed for ${workspaceMemberId}:`,
      //         err,
      //       ),
      //     );
      // }
    }
  }

  @SubscribeMessage('message')
  handleMessage(
    @ConnectedSocket() client: Socket, 
    @MessageBody() payload: { recruiterId: string; message: any }
  ): void {
    if (!payload.recruiterId) {
      this.logger.warn('Invalid message payload: missing recruiterId');
      return;
    }
    const recruiterRoom = this.getRecruiterRoom(payload.recruiterId);
    this.server.to(recruiterRoom).emit('message', {
      ...payload.message,
      clientId: client.id,
      timestamp: new Date().toISOString()
    });
  }

  @SubscribeMessage('join_room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string }
  ): void {
    if (!data.room) {
      this.logger.warn('Invalid join_room: missing room');
      return;
    }

    client.join(data.room);
    client.emit('room_joined', {
      room: data.room,
      message: `You joined room: ${data.room}`
    });
    
    client.to(data.room).emit('user_joined_room', {
      room: data.room,
      clientId: client.id,
      timestamp: new Date().toISOString()
    });
  }

  @SubscribeMessage('leave_room')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string }
  ): void {
    if (!data.room) {
      this.logger.warn('Invalid leave_room: missing room');
      return;
    }

    client.leave(data.room);
    client.emit('room_left', {
      room: data.room,
      message: `You left room: ${data.room}`
    });
  }
}