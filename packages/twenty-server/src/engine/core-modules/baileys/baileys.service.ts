import { Boom } from '@hapi/boom';
import { Injectable, Logger } from '@nestjs/common';
import makeWASocket, {
  BaileysEventMap,
  ConnectionState,
  DisconnectReason,
  useMultiFileAuthState,
  WAConnectionState,
  WASocket
} from 'baileys';
import EventEmitter from 'events';
import { join } from 'path';
import { WebSocketService } from 'src/modules/websocket/websocket.service';

@Injectable()
export class BaileysService {
  private socket: WASocket | null = null;
  private readonly logger = new Logger(BaileysService.name);
  private readonly eventEmitter = new EventEmitter();
  private qrCode: string | null = null;
  private connectionState: Partial<ConnectionState> = {
    connection: 'close' as WAConnectionState,
  };
  private readonly authPath: string;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private lastReconnectAttempt = 0;
  private cryptoErrorCount = 0; // Add this line
  private forceReconnectInProgress = false; // Add this line


  constructor(private readonly webSocketService: WebSocketService) {
    // Set auth path in a directory named 'auth_baileys' inside the server's data directory
    this.authPath = join(process.cwd(), 'data', 'auth_baileys');
  }

  async connect() {
    if (this.isConnecting) {
      this.logger.warn('Connection attempt already in progress');
      return false;
    }

    if (this.socket?.user) {
      this.logger.warn('Already connected to WhatsApp');
      return true;
    }

    try {
      this.isConnecting = true;
      const { state, saveCreds } = await useMultiFileAuthState(this.authPath);

      const socket = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        connectTimeoutMs: 30000,
        retryRequestDelayMs: 2000,
        browser: ['Chrome (Linux)', '', ''],
        version: [2, 2424, 11],
        syncFullHistory: false,
        shouldIgnoreJid: () => false,
        maxMsgRetryCount: 3,
        markOnlineOnConnect: false,
        keepAliveIntervalMs: 15000,
        linkPreviewImageThumbnailWidth: 192,
        getMessage: async () => {
          return { conversation: 'hello' };
        },
      });

      this.socket = socket;

      // Handle connection updates
      socket.ev.on('connection.update', this.handleConnectionUpdate.bind(this));

      // Save credentials on update
      socket.ev.on('creds.update', saveCreds);

      // Forward all events to our event emitter
      Object.keys(socket.ev.on).forEach((eventName) => {
        socket.ev.on(eventName as keyof BaileysEventMap, (...args: any[]) => {
          this.eventEmitter.emit(eventName, ...args);
        });
      });


    // Add global error handler for the socket
    this.setupSocketErrorHandling(socket);

    // Forward all events to our event emitter with error handling
    this.setupEventForwarding(socket);


      return true;
    } catch (error) {
      this.logger.error('Failed to connect to WhatsApp:', error);
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }
  private setupEventForwarding(socket: WASocket) {
    // Forward all events to our event emitter with error handling
    const eventNames = [
      'connection.update',
      'creds.update',
      'messaging-history.set',
      'chats.set',
      'contacts.set',
      'messages.upsert',
      'message-receipt.update',
      'messages.update',
      'groups.update',
      'group-participants.update',
      'blocklist.set',
      'blocklist.update',
      'call',
      'labels.association',
      'labels.edit'
    ];
  
    eventNames.forEach((eventName) => {
      try {
        socket.ev.on(eventName as keyof BaileysEventMap, (...args: any[]) => {
          try {
            this.eventEmitter.emit(eventName, ...args);
          } catch (error) {
            this.logger.error(`Error handling event ${eventName}:`, error);
          }
        });
      } catch (error) {
        this.logger.error(`Error setting up event listener for ${eventName}:`, error);
      }
    });
  }
  
  private setupSocketErrorHandling(socket: WASocket) {
    // Handle WebSocket errors
    socket.ws.on('error', (error) => {
      this.logger.error('WebSocket error:', error);
      
      // Check if it's a crypto authentication error
      if (error.message?.includes('unable to authenticate data') || 
          error.message?.includes('Unsupported state')) {
        this.logger.warn('Crypto authentication error detected, attempting recovery...');
        this.handleCryptoError();
        return;
      }
      
      // Handle other errors
      this.handleSocketError(error);
    });
  
    // Handle unexpected socket closure
    socket.ws.on('close', (code, reason) => {
      this.logger.warn(`WebSocket closed with code: ${code}, reason: ${reason}`);
      if (code === 1006) { // Abnormal closure
        this.logger.warn('Abnormal WebSocket closure detected');
      }
    });
  }
  
  private handleCryptoError() {
    this.logger.warn('Handling crypto authentication error...');
    
    // Increment a counter to track crypto errors
    this.cryptoErrorCount = (this.cryptoErrorCount || 0) + 1;
    
    // If we get too many crypto errors, force a reconnection
    if (this.cryptoErrorCount > 3) {
      this.logger.error('Too many crypto errors, forcing reconnection...');
      this.forcedReconnect();
      this.cryptoErrorCount = 0;
    }
  }

  private async forcedReconnect() {
    if (this.forceReconnectInProgress) {
      return;
    }
  
    try {
      this.forceReconnectInProgress = true;
      this.logger.warn('Performing forced reconnection...');
      
      // Clean up current socket
      if (this.socket) {
        try {
          await this.socket.end(undefined);
        } catch (error) {
          this.logger.warn('Error ending socket during forced reconnect:', error);
        }
        this.socket = null;
      }
  
      // Reset connection state
      this.connectionState = {
        connection: 'close' as WAConnectionState,
      };
      this.qrCode = null;
      this.isConnecting = false;
  
      // Wait a bit before reconnecting
      await new Promise(resolve => setTimeout(resolve, 3000));
  
      // Attempt to reconnect
      await this.connect();
      
    } catch (error) {
      this.logger.error('Error during forced reconnect:', error);
    } finally {
      this.forceReconnectInProgress = false;
    }
  }
  
  
  private handleSocketError(error: any) {
    this.logger.error('Socket error:', error);
    
    // Don't crash the server, just log and attempt recovery
    if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
      this.logger.warn('Attempting to recover from socket error...');
      setTimeout(() => this.connect(), 5000);
    }
  }

  private async handleConnectionUpdate(update: Partial<ConnectionState>) {
    const { connection, lastDisconnect, qr } = update;
    
    this.logger.debug(`Connection update received: ${JSON.stringify(update)}`);
    
    if (connection) {
      this.connectionState.connection = connection;
      this.logger.log(`Connection state changed to: ${connection}`);
    }

    if (qr) {
      this.qrCode = qr;
      this.logger.log('New QR code received');
      this.webSocketService.emitQRCode(qr);
    }

    if (connection === 'close') {
      const error = lastDisconnect?.error as Boom;
      const statusCode = error?.output?.statusCode;
      
      // Reset reconnect attempts if it's been more than 5 minutes since last attempt
      const timeSinceLastAttempt = Date.now() - (this.lastReconnectAttempt || 0);
      if (timeSinceLastAttempt > 5 * 60 * 1000) {
        this.reconnectAttempts = 0;
      }
      
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut && 
                            statusCode !== 405 && // Don't retry on Method Not Allowed
                            this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS;
      
      this.logger.warn(
        `Connection closed. Status code: ${statusCode}, Error: ${error?.message}, Reconnecting: ${shouldReconnect} (attempt ${this.reconnectAttempts + 1}/${this.MAX_RECONNECT_ATTEMPTS})`,
      );

      if (error?.output?.payload) {
        this.logger.debug(`Detailed error payload: ${JSON.stringify(error.output.payload)}`);
      }

      if (shouldReconnect) {
        this.reconnectAttempts++;
        this.lastReconnectAttempt = Date.now();
        const delay = Math.min(2000 * Math.pow(2, this.reconnectAttempts - 1), 30000); // Exponential backoff with 30s max
        this.logger.log(`Waiting ${delay}ms before reconnecting...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        await this.connect();
      } else if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
        this.logger.error('Max reconnection attempts reached. Please check your WhatsApp connection and try again later.');
        this.reconnectAttempts = 0;
        this.lastReconnectAttempt = 0;
      }
    } else if (connection === 'open') {
      this.logger.log('Successfully connected to WhatsApp');
      this.qrCode = null;
      this.reconnectAttempts = 0;
      this.lastReconnectAttempt = 0;
    }

    // Emit connection state update
    const state = this.getConnectionState();
    this.logger.debug(`Emitting connection state: ${JSON.stringify(state)}`);
    this.webSocketService.emitConnectionState(state);
  }

  async disconnect() {
    if (this.socket) {
      await this.socket.logout();
      await this.socket.end(undefined);
      this.socket = null;
      this.qrCode = null;
      this.connectionState = {
        connection: 'close' as WAConnectionState,
      };
    }
  }

  getConnectionState(): { state: WAConnectionState; qr: string | null; isConnected: boolean } {
    return {
      state: this.connectionState.connection || 'close',
      qr: this.qrCode,
      isConnected: Boolean(this.socket?.user),
    };
  }

  getSocket(): WASocket {
    if (!this.socket) {
      throw new Error('WhatsApp connection not initialized');
    }
    return this.socket;
  }

  onEvent<T extends keyof BaileysEventMap>(
    event: T,
    listener: (...args: any[]) => void,
  ): () => void {
    this.eventEmitter.on(event, listener);
    return () => this.eventEmitter.off(event, listener);
  }
}
