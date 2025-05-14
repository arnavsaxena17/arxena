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
import axios from 'axios';
import { Server, Socket } from 'socket.io';
import { graphqlQueryToGetCurrentUser } from 'twenty-shared';
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
    private userIdToClientId: Map<string, string> = new Map();
  
    constructor(private readonly webSocketService: WebSocketService) {}
  
    afterInit(server: Server) {
      this.webSocketService.setServer(server);
      console.log('WebSocket Gateway initialized');
    }
    async getCurrentUser(token: string) {
      try {
        const data = JSON.stringify({
          query: graphqlQueryToGetCurrentUser,
          variables: {},
        });
        const config = {
          method: 'post',
          maxBodyLength: Infinity,
          url: process.env.GRAPHQL_URL,
          headers: {
            Origin: process.env.APPLE_ORIGIN_URL || '*',
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
          },
          timeout: 10000,
          data: data,
        };
        const response = await axios.request(config);
        console.log('WebSocket auth - currentUser:', response.data.data.currentUser?.id);
        return response.data.data.currentUser;
      } catch (error) {
        console.log('Error authenticating WebSocket user:', error.message);
        return null;
      }
    }
  
    async handleConnection(client: Socket) {
      console.log(`Client connected: ${client.id}`);
      this.connectedClients.set(client.id, client);
      
      // Check if client has a token and authenticate them
      const token = client.handshake?.query?.token as string;
      if (token) {
        try {
          console.log('token and will use to get current user::', token);
          // Get user from token using GraphQL API
          const currentUser = await this.getCurrentUser(token);
          console.log('currentUser::', currentUser);
          if (currentUser.workspaceMember?.id) {
            const userId = currentUser.workspaceMember.id;
            console.log(`Authenticated user ${userId} connected with client ${client.id}`);
            
            // Store the mapping between userId and clientId
            this.userIdToClientId.set(userId, client.id);
            
            // Make the client join a room with their userId
            client.join(userId);
            
            // Update the WebSocketService with this mapping
            this.webSocketService.setUserIdMapping(userId, client.id);
            
            client.emit('connection_established', { 
              clientId: client.id,
              userId: userId,
              message: 'Connected to WebSocket server as authenticated user'
            });
            return;
          }
        } catch (error) {
          console.log('Error authenticating websocket user:', error.message);
          // Continue with unauthenticated connection
        }
      }
      
      // If we reach here, it's an unauthenticated connection or auth failed
      client.emit('connection_established', { 
        clientId: client.id,
        message: 'Connected to WebSocket server'
      });
    }
  
    handleDisconnect(client: Socket) {
      console.log(`Client disconnected: ${client.id}`);
      
      // Remove from userIdToClientId mapping
      for (const [userId, clientId] of this.userIdToClientId.entries()) {
        if (clientId === client.id) {
          this.userIdToClientId.delete(userId);
          this.webSocketService.removeUserIdMapping(userId);
          break;
        }
      }
      
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