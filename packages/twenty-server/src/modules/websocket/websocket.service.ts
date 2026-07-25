// websocket/websocket.service.ts
import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { RedisClientService } from 'src/engine/core-modules/redis-client/redis-client.service';
import {
  WEBSOCKET_USER_CHANNEL_PREFIX,
  WebSocketUserRedisPayload,
} from './websocket-user-redis.constants';

type WAConnectionState = string;

@Injectable()
export class WebSocketService {
  private server: Server;

  constructor(private readonly redisClientService: RedisClientService) {}
  private connectedClients: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds
  private userIdToClientId: Map<string, string> = new Map();
  private acknowledgmentListeners: Map<string, (data: any) => void> = new Map();

  setServer(server: Server) {
    this.server = server;
    console.log('WebSocket server initialized');

    // Add error handling for the server
    this.server.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });

    this.server.on('connection_error', (error) => {
      console.error('WebSocket connection error:', error);
    });

    // Monitor connection events
    this.server.on('connection', (socket) => {
      // Get userId from query parameters or headers
      const userId = socket.handshake.query.userId as string;
      if (userId) {
        this.addSocketConnection(userId, socket.id);
      }

      // Handle disconnection
      socket.on('disconnect', () => {
        if (userId) {
          this.removeSocketConnection(userId, socket.id);
        }
      });

      // Listen for acknowledgments
      socket.on('notification_received', (data) => {
        console.log("data in notification_received::", data);
        console.log("data in notification_received socket.id::", socket.id);
        console.log("data in notification_received socket.handshake.query::", socket.handshake.query);
        console.log("data in notification_received socket.handshake.query.userId::", socket.handshake.query.userId);
        const userId = socket.handshake.query.userId;
        console.log("userId::", userId);
        if (userId) {
          const key = `notification_received_${userId}`;
          const listener = this.acknowledgmentListeners.get(key);
          console.log("acknowledgmentListeners::", this.acknowledgmentListeners);
          // console.log("listener::", listener);
          if (listener) {
            listener(data);
            this.acknowledgmentListeners.delete(key);
          }
        }
      });
    });
  }

  getServer(): Server {
    return this.server;
  }

  setUserIdMapping(userId: string, clientId: string) {
    this.userIdToClientId.set(userId, clientId);
    // console.log(`Mapped userId ${userId} to clientId ${clientId}`);
    // console.log('Current user mappings:', Array.from(this.userIdToClientId.entries()));
    // console.log('Active connections:', this.getActiveConnections());
  }

  removeUserIdMapping(userId: string) {
    const clientId = this.userIdToClientId.get(userId);
    this.userIdToClientId.delete(userId);
    // console.log(`Removed mapping for userId ${userId} (was mapped to clientId ${clientId})`);
    // console.log('Current user mappings:', Array.from(this.userIdToClientId.entries()));
    // console.log('Active connections:', this.getActiveConnections());
  }

  getClientIdFromUserId(userId: string): string | undefined {
    const clientId = this.userIdToClientId.get(userId);
    // console.log(`Looking up clientId for userId ${userId}: ${clientId || 'not found'}`);
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
    const payload = {
      ...data,
      timestamp: new Date().toISOString(),
    };

    if (!this.server) {
      void this.publishUserEventToRedis(userId, event, payload);
      return;
    }

    const socketIds = this.connectedClients.get(userId);
    if (!socketIds || socketIds.size === 0) {
      console.warn(`No connected sockets found for user ${userId}`);
      return;
    }

    console.log(`Found ${socketIds.size} connected sockets for user ${userId}`);

    for (const socketId of socketIds) {
      console.log(`Emitting to socket ${socketId}`);
      this.server.to(socketId).emit(event, payload);
    }
  }

  private async publishUserEventToRedis(
    userId: string,
    event: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    try {
      const channel = `${WEBSOCKET_USER_CHANNEL_PREFIX}${userId}`;
      const message: WebSocketUserRedisPayload = { event, data };
      await this.redisClientService.getClient().publish(channel, JSON.stringify(message));
      console.log(
        `Published websocket user event "${event}" to Redis for user ${userId}`,
      );
    } catch (error) {
      console.error('WebSocket server not initialized for sendToUser', error);
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
    // console.log('Active socket connections:', {
    //   count,
    //   socketIds: connectedSockets
    // });
    return count;
  }

  // Add method to wait for acknowledgment
  async waitForAcknowledgment(userId: string, timeout: number = 5000): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.acknowledgmentListeners.delete(`notification_received_${userId}`);
        reject(new Error('Acknowledgment timeout'));
      }, timeout);

      this.acknowledgmentListeners.set(`notification_received_${userId}`, () => {
        clearTimeout(timeoutId);
        resolve(true);
      });
    });
  }

  private getUserIdFromClientId(clientId: string): string | undefined {
    for (const [userId, mappedClientId] of this.userIdToClientId.entries()) {
      if (mappedClientId === clientId) {
        return userId;
      }
    }
    return undefined;
  }

  // Add methods to manage socket connections
  private addSocketConnection(userId: string, socketId: string) {
    if (!this.connectedClients?.has(userId)) {
      this.connectedClients?.set(userId, new Set());
    }
    this.connectedClients?.get(userId)?.add(socketId);
    this.setUserIdMapping(userId, socketId);
  }

  private removeSocketConnection(userId: string, socketId: string) {
    const userSockets = this.connectedClients?.get(userId);
    if (userSockets) {
      userSockets.delete(socketId);
      if (userSockets.size === 0) {
        this.connectedClients?.delete(userId);
        this.removeUserIdMapping(userId);
      }
    }
  }
}
