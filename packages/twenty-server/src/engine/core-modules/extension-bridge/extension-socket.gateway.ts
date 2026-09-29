import { Injectable, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway as NestWebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AccessTokenService } from 'src/engine/core-modules/auth/token/services/access-token.service';

type LinkedinCookieFetchHooks = {
  onConnected: (workspaceMemberId: string) => void;
  onCookiesFetched: (workspaceMemberId: string) => void;
};

@NestWebSocketGateway({
  cors: {
    origin: [/chrome-extension:\/\/.*/, /localhost:\d+$/, /\.arxena\.com$/],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  path: '/extension-socket',
})
@Injectable()
export class ExtensionSocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ExtensionSocketGateway.name);
  private connectedClients: Map<string, Set<string>> = new Map(); // workspaceMemberId -> Set of socketIds
  private linkedinCookieFetchHooks: LinkedinCookieFetchHooks | null = null;

  constructor(private readonly accessTokenService: AccessTokenService) {}

  afterInit(server: Server) {
    this.logger.log('Extension Socket Gateway initialized');
  }

  private getExtensionRoom(workspaceMemberId: string): string {
    return `extension-${workspaceMemberId}`;
  }

  private addClientToWorkspaceMember(
    workspaceMemberId: string,
    socketId: string,
  ) {
    if (!this.connectedClients.has(workspaceMemberId)) {
      this.connectedClients.set(workspaceMemberId, new Set());
    }
    this.connectedClients.get(workspaceMemberId)?.add(socketId);
    this.logger.log(
      `Added extension client ${socketId} for workspace member ${workspaceMemberId}`,
    );
  }

  private removeClientFromWorkspaceMember(socketId: string): string | null {
    for (const [
      workspaceMemberId,
      clients,
    ] of this.connectedClients.entries()) {
      if (clients.has(socketId)) {
        clients.delete(socketId);
        this.logger.log(
          `Removed extension client ${socketId} for workspace member ${workspaceMemberId}`,
        );
        if (clients.size === 0) {
          this.connectedClients.delete(workspaceMemberId);
        }
        return workspaceMemberId;
      }
    }
    return null;
  }

  async handleConnection(client: Socket) {
    try {
      const token = client?.handshake?.query?.token as string;
      const userId = client?.handshake?.query?.userId as string;

      if (!token || typeof token !== 'string') {
        this.logger.error('Invalid or missing token');
        client.emit('connection_error', {
          message: 'Invalid or missing token',
        });
        client.disconnect();
        return;
      }

      if (
        !userId ||
        typeof userId !== 'string' ||
        userId === 'undefined' ||
        userId === 'null'
      ) {
        this.logger.error('Invalid workspaceMemberId:', userId);
        client.emit('connection_error', {
          message: 'Invalid or missing workspaceMemberId',
        });
        client.disconnect();
        return;
      }

      // Validate JWT token
      try {
        const authContext = await this.accessTokenService.validateToken(token);

        // Verify that the userId from query matches the workspaceMemberId from token
        if (authContext.workspaceMemberId !== userId) {
          this.logger.error(
            `Token workspaceMemberId (${authContext.workspaceMemberId}) does not match query userId (${userId})`,
          );
          client.emit('connection_error', {
            message: 'Token workspaceMemberId mismatch',
          });
          client.disconnect();
          return;
        }

        (client.data as { workspaceMemberId?: string }).workspaceMemberId =
          userId;

        // Add to tracking
        this.addClientToWorkspaceMember(userId, client.id);

        // Join the extension room
        const extensionRoom = this.getExtensionRoom(userId);
        await client.join(extensionRoom);

        // Emit connection established
        client.emit('connection_established', {
          clientId: client.id,
          userId: userId,
          message: 'Connected to Extension Socket server',
        });

        this.logger.log(
          `Extension client ${client.id} connected and joined room: ${extensionRoom}`,
        );
        this.linkedinCookieFetchHooks?.onConnected(userId);
      } catch (error) {
        this.logger.error('Token validation failed:', error);
        client.emit('connection_error', {
          message: 'Token validation failed',
        });
        client.disconnect();
        return;
      }
    } catch (error) {
      this.logger.error('Error in handleConnection:', error);
      client.emit('connection_error', { message: error.message });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const workspaceMemberId = this.removeClientFromWorkspaceMember(client.id);

    if (workspaceMemberId) {
      const extensionRoom = this.getExtensionRoom(workspaceMemberId);
      this.logger.log(
        `Extension client ${client.id} disconnected from room: ${extensionRoom}`,
      );

      // Notify others in the room about the disconnection
      client.to(extensionRoom).emit('user_disconnected', {
        clientId: client.id,
        workspaceMemberId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  getServer(): Server {
    return this.server;
  }

  getExtensionRoomForUser(workspaceMemberId: string): string {
    return this.getExtensionRoom(workspaceMemberId);
  }

  registerLinkedinCookieFetchHooks(hooks: LinkedinCookieFetchHooks): void {
    this.linkedinCookieFetchHooks = hooks;
  }

  async emitToWorkspaceMember(
    workspaceMemberId: string,
    eventName: string,
    payload: unknown,
  ): Promise<boolean> {
    if (!this.server) {
      return false;
    }

    const room = this.getExtensionRoom(workspaceMemberId);
    const sockets = await this.server.in(room).fetchSockets();

    if (sockets.length === 0) {
      return false;
    }

    this.server.to(room).emit(eventName, payload);

    return true;
  }

  @SubscribeMessage('linkedin_cookies_fetched')
  handleLinkedinCookiesFetched(@ConnectedSocket() client: Socket): void {
    const workspaceMemberId = (client.data as { workspaceMemberId?: string })
      .workspaceMemberId;

    if (typeof workspaceMemberId !== 'string' || !workspaceMemberId) {
      return;
    }

    this.linkedinCookieFetchHooks?.onCookiesFetched(workspaceMemberId);
  }
}
