// websocket/websocket.gateway.ts
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
  @WebSocketServer() server: Server; 
  private connectedClients: Map<string, Set<string>> = new Map(); // workspaceMemberId -> Set of GENERAL-SOCKET socketIds

  constructor(
    readonly webSocketService: WebSocketService,
    private readonly unipileAccountPoolService: UnipileAccountPoolService,
  ) {}

  afterInit(server: Server) {
    this.webSocketService.setServer(server);
    console.log('WebSocket Gateway initialized');
  }

  private getRecruiterRoom(recruiterId: string): string {
    return `general-recruiter-${recruiterId}`;
  }

  private addClientToWorkspaceMember(workspaceMemberId: string, socketId: string, workspaceMemberName?: string) {
    if (!this.connectedClients.has(workspaceMemberId)) {
      this.connectedClients.set(workspaceMemberId, new Set());
    }
    this.connectedClients.get(workspaceMemberId)?.add(socketId);
    console.log(`Added GENERAL-SOCKET client ${socketId} for workspace member ${workspaceMemberName}`);
  }

  private removeClientFromWorkspaceMember(socketId: string, workspaceMemberName?: string) {
    for (const [workspaceMemberId, clients] of this.connectedClients.entries()) {
      if (clients.has(socketId)) {
        clients.delete(socketId);
        console.log(`Removed GENERAL-SOCKET client ${socketId} for workspace member ${workspaceMemberName}`);
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
      const workspaceMemberName = client?.handshake?.query?.userName;
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
      if (existingClients.length > 0) {
        console.log(`Found ${existingClients.length} existing GENERAL-SOCKET connections for workspace member ${workspaceMemberId}, cleaning up...`);
        // Disconnect existing GENERAL-SOCKET clients to prevent multiple connections
        for (const existingClientId of existingClients) {
          const existingClient = this.server.sockets.sockets.get(existingClientId);
          if (existingClient) {
            console.log(`Disconnecting existing GENERAL-SOCKET client ${existingClientId}`);
            existingClient.disconnect();
          }
        }
        // Clear the mapping
        this.removeClientFromWorkspaceMember(existingClients[0], workspaceMemberName as string);
      }
      // Add to tracking
      this.addClientToWorkspaceMember(workspaceMemberId, client.id, workspaceMemberName as string);
      
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

      console.log(`Client ${client.id} joined rooms: ${recruiterRoom}, ${workspaceMemberName}`);

    } catch (error) {
      console.error('Error in handleConnection:', error);
      client.emit('connection_error', { message: error.message });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const workspaceMemberName = client?.handshake?.query?.workspaceMemberName;
    const workspaceMemberId = this.removeClientFromWorkspaceMember(client.id, workspaceMemberName as string);

    if (workspaceMemberId) {
      // Remove user mapping from WebSocketService
      this.webSocketService.removeUserIdMapping(workspaceMemberId);

      const recruiterRoom = this.getRecruiterRoom(workspaceMemberId);
      console.log(`Client ${client.id} disconnected from rooms: ${recruiterRoom}, ${workspaceMemberId}, ${workspaceMemberName}`);

      // Notify others in the room about the disconnection
      client.to(recruiterRoom).emit('user_disconnected', {
        clientId: client.id,
        workspaceMemberId,
        workspaceMemberName,
        timestamp: new Date().toISOString(),
      });

      // Disconnect Unipile pool account when last client for this member disconnects (tab close)
      if (this.getClientsForWorkspaceMember(workspaceMemberId).length === 0) {
        this.unipileAccountPoolService
          .disconnectForMember(workspaceMemberId)
          .catch((err) =>
            console.warn(
              `Unipile disconnectForMember failed for ${workspaceMemberId}:`,
              err,
            ),
          );
      }
    }
  }

  @SubscribeMessage('message')
  handleMessage(
    @ConnectedSocket() client: Socket, 
    @MessageBody() payload: { recruiterId: string; message: any }
  ): void {
    if (!payload.recruiterId) {
      console.error('Invalid message payload: missing recruiterId');
      return;
    }

    console.log(`Message received from ${client.id} for recruiter ${payload.recruiterId}:`, payload);
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
      console.error('Invalid room data: missing room');
      return;
    }

    client.join(data.room);
    console.log(`Client ${client.id} joined room: ${data.room}`);
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
      console.error('Invalid room data: missing room');
      return;
    }

    client.leave(data.room);
    console.log(`Client ${client.id} left room: ${data.room}`);
    client.emit('room_left', {
      room: data.room,
      message: `You left room: ${data.room}`
    });
  }
}