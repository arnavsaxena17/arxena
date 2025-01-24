import { SubscribeMessage, WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { BaileysBot } from '../baileys';
// import { Mimetype } from '@whiskeysockets/baileys';
import * as allDataObjects from '../../arx-chat/services/data-model-objects';

import * as jwt from 'jsonwebtoken';
import { FileDataDto, MessageDto } from '../types/baileys-types';
console.log('SocketGateway being called!!!');
import { MimeType } from 'file-type';
import { delay } from '@whiskeysockets/baileys';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
// import { sendWhatsappTextMessageViaBaileys } from 'src/engine/core-modules/recruitment-agent/services/whatsapp-api/baileys/callBaileys';


const apiToken = process.env.TWENTY_JWT_SECRET || '';
@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private workspaceQueryService: WorkspaceQueryService;

  constructor(workspaceQueryService: WorkspaceQueryService) {
    this.workspaceQueryService = workspaceQueryService;
  }

  setBaileys(b: unknown) {
    console.log('Method not implemented.');
  }

  @WebSocketServer()
  server: Server;
  private baileys: any;

  @SubscribeMessage('file-upload')
  async fileUpload(@MessageBody() message: MessageDto) {
    try {
      let userDirectory: string = message.WANumber;
      let fileData: FileDataDto | undefined = message.fileData;
      if (fileData) {
        new BaileysBot('sendWhatsappMessageHandleFileUpload', this.workspaceQueryService).handleFileUpload(fileData, userDirectory);
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  @SubscribeMessage('WAmsg')
  async sendWhatsappMessage(@MessageBody() body: MessageDto) {
    try {
      body = new MessageDto(body.WANumber, body.message, body?.fileData);
      console.log('wamsg:', body);
      if (Boolean(body.fileData?.fileName)) {
        let userDirectory: string = body.WANumber;
        if (body.fileData) {
          body.fileData = await new BaileysBot('sendWhatsappMessagesendWhatsappMessagehandleFileUpload',this.workspaceQueryService).handleFileUpload(body.fileData, userDirectory);
        }
        this.sendMessageFileToBaileys(body);
      } else {
        body.message && this.sendMessageToBaileys(body);
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  @SubscribeMessage('message')
  handleMessage(@MessageBody() data: string, @ConnectedSocket() socket: Socket) {
    const clientId = socket.id;
    console.log('got message from client data::', data);
    let authToken = socket.handshake.headers.authorization;
    authToken = authToken?.split(' ')[1]; // Add nullish coalescing operator to handle undefined value
    this.handleAuth(authToken, clientId);
    this.server.emit('message', 'server reply:' + authToken + ', this is data' + data); // Broadcast the message to all connected clients
  }

  handleConnection(client: Socket) {
    let authToken = client.handshake.headers?.authorization;
    authToken && (authToken = authToken.split(' ')[1]);
    console.log(`client:(${client.id}) connected...`, authToken);
    (async () => {
      try {
        const chatControl:allDataObjects.chatControls = {"chatControlType": "startChat"};
        this.baileys = await new BaileysBot('sendWhatsappMessagehandleConnection', this.workspaceQueryService).initApp(this, 'started from handleConnection',chatControl,apiToken);
        console.log('Baileys service initialized from SocketGateway.handleConnection.');
      } catch (error) {
        this.handleError(error);
      }
    })();
  }

  handleDisconnect(client: Socket) {
    // Handle disconnection event
    console.log('client disconnected...');
  }

  async sendMessageToBaileys(body: MessageDto): Promise<object> {
    console.log('REceived body in socket gateway:', body);
    try {
      let { jid, message } = body;
      console.log('JID', jid);
      console.log('tshis it ::', jid, { text: message });
      if (!this.baileys) {
        console.error('Baileys service is not initialized.');
        // throw new Error("Baileys service is not initialized.");
        (async () => {
          try {
            const chatControl:allDataObjects.chatControls = {"chatControlType": "startChat"};

            this.baileys = await new BaileysBot('sendMessageServiceNotInitilaised',this.workspaceQueryService).initApp(this, 'because service is not initilised',chatControl,apiToken);
            // await delay(2000);
            return await this.sendMessageToBaileys(body); // ! Recursion
            // let { jid, message } = body;
            // console.log('Sending the mesages to baileys API JID', jid);
            // console.log('this it hjid to baileys API ::', jid, { text: message });
            // await this.baileys.sendMessage(jid, { text: message });
          } catch (error) {
            console.log('09324:: error here', error);
            this.handleError(error);
          }
        })();
      } else {
        // console.log('534534:: this.baileys::');
        try {
          console.log('534534:: this.baileys::', this.baileys);
          let { jid, message } = body;
          console.log('Sending the mesages to baileys API JID', jid);
          console.log('this it hjid to baileys API ::', jid, { text: message });
          await this.baileys.presenceSubscribe(jid);
          await delay(500);

          await this.baileys.sendPresenceUpdate('composing', jid);
          await delay(2000);

          await this.baileys.sendPresenceUpdate('paused', jid);

          // await waSock.sendMessage(waJid, { text: message });
          const sentMsgObj = await this.baileys.sendMessage(jid, { text: message });
          console.log('59435:: sentMsgObj', sentMsgObj);
          return sentMsgObj;
        } catch (error) {
          console.error('baileys.sendMessage got error', error);
          this.handleError(error);

          return await this.retrySendMessageToBaileys(body);
        }
      }
    } catch (error) {
      console.log('baileys.sendMessage got error');
      this.handleError(error);
    }
    return { status: 'failed' };
  }

  async retrySendMessageToBaileys(body: MessageDto) {
    try {
      let { jid, message } = body;
      console.log('Sending the mesages to baileys API JID', jid);
      console.log('this it hjid to baileys API ::', jid, { text: message });
      const sentMsgObj = await this.baileys.sendMessage(jid, { text: message });
      console.log('59435:: sentMsgObj', sentMsgObj);
      return sentMsgObj;
    } catch (error) {
      console.log('retrySendMessageToBaileys got error as well', error);
      throw error;
    }
  }

  // async sendMessageFileToBaileys(body: MessageDto) {
  //   const { jid, message, fileData: { filePath, mimetype, fileName } = {} as any } = body;
  //   console.log('file media ', { jid, message, filePath, mimetype, fileName });
  //   // try {
  //   //   await this.baileys.sendMessage(
  //   //     jid,
  //   //     {
  //   //       // document: { url: filePath },
  //   //       // caption: message,
  //   //       // mimetype,
  //   //       // fileName,

  //   //       WANumber: '919769331376',
  //   //       message: 'Sent one just now world 1234555',
  //   //       fileData: {
  //   //         fileName: 'c4611_sample_explain.pdf',
  //   //         mimetype: 'application/pdf',
  //   //         filePath: '/home/ninad/Documents/twenty/packages/twenty-server/c4611_sample_explain.pdf',
  //   //       },
  //   //       jid: '919769331376@s.whatsapp.net',
  //   //     },
  //   //     { url: filePath },
  //   //   );
  //   // } catch (error) {
  //   //   console.log('baileys.sendMessage got error');
  //   //   this.handleError(error);
  //   // }
  //   if (!this.baileys) {
  //     console.error('Baileys service is not initialized.');
  //     // throw new Error("Baileys service is not initialized.");
  //     (async () => {
  //       try {
  //         this.baileys = await new BaileysBot('sendMessageServiceNotInitilaised').initApp(this, 'because service is not initilised');
  //         // let { jid, message } = body;
  //         // console.log('Sending the mesages to baileys API JID', jid);
  //         // console.log('this it hjid to baileys API ::', jid, { text: message });
  //         // await this.baileys.sendMessage(jid, { text: message });
  //       } catch (error) {
  //         this.handleError(error);
  //       }
  //     })();
  //   } else {
  //     try {
  //       await this.baileys.sendMessage(
  //         jid,
  //         {
  //           // document: { url: filePath },
  //           // caption: message,
  //           // mimetype,
  //           // fileName,

  //           WANumber: '919769331376',
  //           message: 'Sent one just now world 1234555',
  //           fileData: {
  //             fileName: 'c4611_sample_explain.pdf',
  //             mimetype: 'application/pdf',
  //             filePath: '/home/ninad/Documents/twenty/packages/twenty-server/c4611_sample_explain.pdf',
  //           },
  //           jid: '919769331376@s.whatsapp.net',
  //         },
  //         { url: filePath },
  //       );
  //     } catch (error) {
  //       console.log('baileys.sendMessage got error');
  //       this.handleError(error);
  //     }
  //   }
  // }
  // catch(error) {
  //   console.log('baileys.sendMessage got error');
  //   this.handleError(error);
  // }

  async sendMessageFileToBaileys(body: MessageDto) {
    const { jid, message, fileData: { filePath, mimetype, fileName } = {} as any } = body;
    console.log('file media ', { jid, message, filePath, mimetype, fileName });
    try {
      await this.baileys.sendMessage(
        jid,
        {
          document: { url: filePath },
          caption: message,
          mimetype,
          fileName,
        },
        { url: filePath },
      );
    } catch (error) {
      console.log('baileys.sendMessage got error');
      this.handleError(error);
    }
  }

  handleAuth(authToken: any, clientId: string) {
    try {
      // decoded.uid //(uid is mongo db id)
      let decoded = jwt.verify(authToken, process.env.TWENTY_JWT_SECRET || 'secret');
      console.log(decoded);
    } catch (error) {
      console.log(JSON.stringify(error, null, 2));
      console.log('clientId:', clientId);
      const clientSocket = this.server.sockets.sockets.get(clientId);
      if (clientSocket) {
        clientSocket.disconnect(true);
      }
    }
  }
  handleError(error) {
    console.log(error);
    let errorObj = {
      message: `server error:${error}`,
      errorOutput: error?.output,
      errorData: error?.data,
      error,
    };
    this.server.emit('Error', errorObj);
  }
}
