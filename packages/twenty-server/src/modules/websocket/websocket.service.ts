// websocket/websocket.service.ts
import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class WebSocketService {
  private server: Server;
  private userIdToClientId: Map<string, string> = new Map();

  setServer(server: Server) {
    this.server = server;
  }

  getServer(): Server {
    return this.server;
  }

  setUserIdMapping(userId: string, clientId: string) {
    this.userIdToClientId.set(userId, clientId);
    console.log(`Mapped userId ${userId} to clientId ${clientId}`);
  }

  removeUserIdMapping(userId: string) {
    this.userIdToClientId.delete(userId);
    console.log(`Removed mapping for userId ${userId}`);
  }

  getClientIdFromUserId(userId: string): string | undefined {
    return this.userIdToClientId.get(userId);
  }

  sendToAll(event: string, data: any) {
    if (!this.server) {
      console.error('WebSocket server not initialized');
      return;
    }
    this.server.emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  sendToUser(userId: string, event: string, data: any) {
    if (!this.server) {
      console.error('WebSocket server not initialized');
      return;
    }
    
    console.log(`Attempting to send event ${event} to user ${userId}`);
    
    // First try direct room-based messaging
    this.server.to(userId).emit(event, {
      ...data,
      recipientId: userId,
      timestamp: new Date().toISOString(),
    });
    
    // Also try using the client ID if we have a mapping
    const clientId = this.userIdToClientId.get(userId);
    if (clientId) {
      console.log(`Also sending directly to client ${clientId}`);
      this.server.to(clientId).emit(event, {
        ...data,
        recipientId: userId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  sendToRoom(room: string, event: string, data: any) {
    if (!this.server) {
      console.error('WebSocket server not initialized');
      return;
    }
    this.server.to(room).emit(event, {
      ...data,
      room,
      timestamp: new Date().toISOString(),
    });
  }

  getActiveConnections() {
    return this.server ? this.server.sockets.sockets.size : 0;
  }
}