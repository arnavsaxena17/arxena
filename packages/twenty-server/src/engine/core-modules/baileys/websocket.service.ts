import { Injectable } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: [/\.localhost:3001$/, process.env.FRONTEND_URL, /\.arxena\.com$/, 'https://arxena.arxena.com', 'https://app.arxena.com'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: 'whatsapp',
  transports: ['websocket'],
  allowEIO3: true,
  path: '/baileys-socket',
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
