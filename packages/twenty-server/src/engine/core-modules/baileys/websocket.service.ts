import { Injectable } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: 'whatsapp',
  transports: ['websocket'],
  allowEIO3: true,
  path: '/whatsapp/socket.io',
})
@Injectable()
export class WebSocketService {
  @WebSocketServer()
  private server: Server;

  emitQRCode(qrCode: string) {
    if (this.server) {
      this.server.emit('qr', qrCode);
    }
  }

  emitConnectionState(state: any) {
    if (this.server) {
      this.server.emit('connection', state);
    }
  }
}
