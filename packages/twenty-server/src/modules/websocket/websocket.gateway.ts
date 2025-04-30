// websocket/websocket.gateway.ts
import {
    ConnectedSocket,
    MessageBody,
    WebSocketGateway as NestWebSocketGateway,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WebSocketService } from './websocket.service';
  
  @NestWebSocketGateway({
    cors: {
        origin: [/\.localhost:3001$/, process.env.FRONTEND_URL], // Allow subdomains on localhost and production URL
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      path: '/socket.io',
      })
  export class WebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;
    private connectedClients: Map<string, Socket> = new Map();
  
    constructor(private readonly webSocketService: WebSocketService) {}
  
    afterInit(server: Server) {
      this.webSocketService.setServer(server);
      console.log('WebSocket Gateway initialized');
    }
  
    handleConnection(client: Socket) {
      console.log(`Client connected: ${client.id}`);
      this.connectedClients.set(client.id, client);
      
      // Tell the client their ID so they can use it for testing
      client.emit('connection_established', { 
        clientId: client.id,
        message: 'Connected to WebSocket server'
      });
    }
  
    handleDisconnect(client: Socket) {
      console.log(`Client disconnected: ${client.id}`);
      this.connectedClients.delete(client.id);
    }
  
    @SubscribeMessage('message')
    handleMessage(@ConnectedSocket() client: Socket, @MessageBody() payload: any): void {
      console.log(`Message received from ${client.id}:`, payload);
      // Forward the message to all clients
      this.server.emit('message', {
        ...payload,
        clientId: client.id,
        timestamp: new Date().toISOString()
      });
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