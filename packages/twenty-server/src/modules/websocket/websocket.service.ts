// websocket/websocket.service.ts
import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class WebSocketService {
  private server: Server;

  setServer(server: Server) {
    this.server = server;
  }

  getServer(): Server {
    return this.server;
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
    this.server.to(userId).emit(event, {
      ...data,
      recipientId: userId,
      timestamp: new Date().toISOString(),
    });
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