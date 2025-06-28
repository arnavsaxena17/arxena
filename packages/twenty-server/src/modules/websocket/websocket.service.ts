// websocket/websocket.service.ts
import { Injectable } from '@nestjs/common';
import { WAConnectionState } from '@whiskeysockets/baileys';
import { Server } from 'socket.io';

@Injectable()
export class WebSocketService {
  private server: Server;
  private userIdToClientId: Map<string, string> = new Map();

  setServer(server: Server) {
    this.server = server;
    console.log('WebSocket server initialized');
  }

  getServer(): Server {
    return this.server;
  }

  setUserIdMapping(userId: string, clientId: string) {
    this.userIdToClientId.set(userId, clientId);
    console.log(`Mapped userId ${userId} to clientId ${clientId}`);
    console.log('Current user mappings:', Array.from(this.userIdToClientId.entries()));
    console.log('Active connections:', this.getActiveConnections());
  }

  removeUserIdMapping(userId: string) {
    const clientId = this.userIdToClientId.get(userId);
    this.userIdToClientId.delete(userId);
    console.log(`Removed mapping for userId ${userId} (was mapped to clientId ${clientId})`);
    console.log('Current user mappings:', Array.from(this.userIdToClientId.entries()));
    console.log('Active connections:', this.getActiveConnections());
  }

  getClientIdFromUserId(userId: string): string | undefined {
    const clientId = this.userIdToClientId.get(userId);
    console.log(`Looking up clientId for userId ${userId}: ${clientId || 'not found'}`);
    return clientId;
  }

  emitQRCode(qr: string) {
    if (!this.server) {
      console.error('WebSocket server not initialized for emitQRCode');
      return;
    }
    this.server.emit('whatsapp.qr', {
      qr,
      timestamp: new Date().toISOString(),
    });
  }

  emitConnectionState(state: { state: WAConnectionState; qr: string | null; isConnected: boolean }) {
    if (!this.server) {
      console.error('WebSocket server not initialized for emitConnectionState');
      return;
    }
    this.server.emit('whatsapp.connection', {
      ...state,
      timestamp: new Date().toISOString(),
    });
  }

  sendToAll(event: string, data: any) {
    if (!this.server) {
      console.error('WebSocket server not initialized for sendToAll');
      return;
    }
    this.server.emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  sendToUser(userId: string, event: string, data: any) {
    console.log("Sending to user - Details:", {
      userId,
      event,
      data,
      serverInitialized: !!this.server,
      activeConnections: this.getActiveConnections(),
      userMappings: Array.from(this.userIdToClientId.entries()),
      socketCount: this.server?.sockets?.sockets?.size
    });
  
    if (!this.server) {
      console.error('WebSocket server not initialized for sendToUser');
      return;
    }

    console.log(`Attempting to send event ${event} to user ${userId}`);
    
    // Try sending to the user's room
    this.server.to(userId).emit(event, {
      ...data,
      recipientId: userId,
      timestamp: new Date().toISOString(),
    });
    
    // Also try using the client ID if we have a mapping
    const clientId = this.userIdToClientId.get(userId);
    if (clientId) {
      console.log(`Also sending directly to client ${clientId}`);
      const socket = this.server.sockets.sockets.get(clientId);
      if (socket) {
        socket.emit(event, {
          ...data,
          recipientId: userId,
          timestamp: new Date().toISOString(),
        });
      } else {
        console.log(`Socket not found for clientId ${clientId}`);
      }
    } else {
      console.log(`No client mapping found for userId ${userId}`);
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

  getActiveConnections(): number {
    const count = this.server?.sockets?.sockets?.size || 0;
    const connectedSockets = Array.from(this.server?.sockets?.sockets?.keys() || []);
    console.log('Active socket connections:', {
      count,
      socketIds: connectedSockets
    });
    return count;
  }
}