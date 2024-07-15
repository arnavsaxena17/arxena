import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { TokenService } from '../../auth/services/token.service';
import { SocketVerifyAuth } from '../../auth/controllers/socket-auth.controller';
import axios from 'axios';

@WebSocketGateway({
  cors: {
    origin: '*', // Adjust the CORS settings according to your needs
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  public isWhatsappLoggedIn: boolean;

  constructor() {} // Inject WhatsappService

  async handleConnection(client: Socket) {
    const user = client?.handshake?.auth?.user;
    console.log('Client connected:', client.id);

    console.log('qurey token:', client?.handshake?.query?.token);

    // const { workspaceMemberId, workspaceId } = await new SocketVerifyAuth.socketVerifyAuthVerify((client?.handshake?.query?.token as string) || '');
    try {
      const headers = {
        Authorization: `Bearer ${client?.handshake?.query?.token}`,
      };
      const response = await axios.get('http://localhost:3000/socket-auth/verify', { headers });

      console.log('User connected:', response?.data?.workspaceMemberId);
    } catch (error) {
      console.error('Error verifying transient token:', error);
    }
    // console.log('isWhatsappLoggedIn:', this.isWhatsappLoggedIn);
    // client.emit('isWhatsappLoggedIn', this.isWhatsappLoggedIn);
  }

  handleDisconnect(client: Socket) {
    console.log('Client disconnected:', client.id);
  }

  emitEvent(event: string, data: any) {
    this?.server?.emit(event, data);
  }

  // updateLoginState(isLoggedIn: boolean) {
  //   this.isWhatsappLoggedIn = isLoggedIn;
  //   this.emitEvent('isWhatsappLoggedIn', this.isWhatsappLoggedIn);
  // }
}
