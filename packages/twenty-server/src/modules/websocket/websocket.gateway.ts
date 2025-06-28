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
import { WebSocketService } from './websocket.service';
  
@NestWebSocketGateway({
  cors: {
    origin: [/\.localhost:3001$/, process.env.FRONTEND_URL],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  path: '/baileys-socket',
})
export class WebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer() server: Server;

  constructor(
    readonly webSocketService: WebSocketService,
    // private readonly staticGraphQLService: StaticGraphQLService,
  ) {}

  afterInit(server: Server) {
    this.webSocketService.setServer(server);
    console.log('WebSocket Gateway initialized');
  }

  private getRecruiterRoom(recruiterId: string): string {
    return `recruiter-${recruiterId}`;
  }

  async handleConnection(client: Socket) {
    console.log('Socket client connected in websocket-gateway:', client.id);
    try {
      const token:string = client?.handshake?.query?.token as string;
      const workspaceMemberId:string = client?.handshake?.query?.workspaceMemberId as string;

      if (!token || typeof token !== 'string') {
        throw new Error('Invalid or missing token');
      }

      if (!workspaceMemberId || typeof workspaceMemberId !== 'string' || workspaceMemberId === 'undefined' || workspaceMemberId === 'null') {
        console.error('Invalid workspaceMemberId:', workspaceMemberId);
        throw new Error('Invalid or missing workspaceMemberId');
      }

      // Join the recruiter's room
      const recruiterRoom = this.getRecruiterRoom(workspaceMemberId);
      await client.join(recruiterRoom);
      console.log(`Client ${client.id} joined room ${recruiterRoom}`);

      // Emit connection established
      client.emit('connection_established', { 
        clientId: client.id,
        userId: workspaceMemberId,
        message: 'Connected to WebSocket server as authenticated user'
      });

      // Emit recruiter details
      client.emit('recruiterDetails', {
        id: workspaceMemberId,
        name: workspaceMemberId // The frontend already has the full name from Recoil state
      });

      console.log('Connection Established for workspaceMemberId:', workspaceMemberId);
    } catch (error) {
      console.error('Error in handleConnection:', error);
      client.emit('connection_established', { 
        clientId: client.id,
        message: 'Connected to WebSocket server'
      });
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    
    // Get all rooms this client was in
    const clientRooms = Array.from(client.rooms);
    
    // Find the recruiter room (if any)
    const recruiterRoom = clientRooms.find(room => room.startsWith('recruiter-'));
    if (recruiterRoom) {
      // Leave the room
      client.leave(recruiterRoom);
      console.log(`Client ${client.id} left room ${recruiterRoom}`);
      
      // Notify others in the room about the disconnection
      client.to(recruiterRoom).emit('user_disconnected', {
        clientId: client.id,
        room: recruiterRoom,
        timestamp: new Date().toISOString()
      });
    }
  }

  emitEventTo(event: string, data: any, recruiterId: string) {
    console.log('Emitting event:', event, 'to recruiter:', recruiterId);
    const recruiterRoom = this.getRecruiterRoom(recruiterId);
    this.server.to(recruiterRoom).emit(event, data);
    console.log('Event emitted to room from websocket-gateway:', recruiterRoom);
  }

  @SubscribeMessage('message')
  handleMessage(
    @ConnectedSocket() client: Socket, 
    @MessageBody() payload: { recruiterId: string; message: any }
  ): void {
    console.log(`Message received from ${client.id}:`, payload);
    if (payload.recruiterId) {
      // Send message to specific recruiter's room
      const recruiterRoom = this.getRecruiterRoom(payload.recruiterId);
      this.server.to(recruiterRoom).emit('message', {
        ...payload.message,
        clientId: client.id,
        timestamp: new Date().toISOString()
      });
    }
  }

  @SubscribeMessage('join_room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string }
  ): void {
    client.join(data.room);
    console.log(`Client ${client.id} joined room: ${data.room}`);
    client.emit('room_joined', {
      room: data.room,
      message: `You joined room: ${data.room}`
    });
    
    // Notify others in the room
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
    client.leave(data.room);
    console.log(`Client ${client.id} left room: ${data.room}`);
    client.emit('room_left', {
      room: data.room,
      message: `You left room: ${data.room}`
    });
  }
}