import { Controller, Get, Post, Body } from '@nestjs/common';
import { BaileysService } from './baileys.service';
import { SocketGateway } from './socket-gateway/socket.gateway';
// import { SendMessageDto, initApp } from './baileys';
import { BaileysBot, SendMessageDto } from './baileys';
import { MessageDto } from './types/baileys-types';
import { WorkspaceQueryService } from '../workspace-modifications/workspace-modifications.service';

console.log('BaileysController being called!!!');

const apiToken = process.env.TWENTY_JWT_SECRET || "";

@Controller('baileys')
export class BaileysController {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly BaileysService: BaileysService,
    private readonly socket: SocketGateway,
  ) {
    (async () => {
      let b = await new BaileysBot( 'baileysController', this.workspaceQueryService).initApp(this.socket, 'because baileyscontroller wants it', 'startChat', apiToken);
      // this.socket.setBaileys(b);
    })();
  }

  // async initAppFromController() {}

  @Get()
  getHello(@Body() ad: SendMessageDto): string {
    console.log(ad);

    return this.BaileysService.getHello();
  }

  @Post('/send-wa-message')
  sendWAMessage(@Body() data: MessageDto): Promise<object> {
    console.log(data);
    console.log('--------------------This is from baileys app ----------------------------');
    const resData = this.socket.sendMessageToBaileys(data);
    return resData;
  }

  @Post('/send-wa-message-file')
  sendWAMessageFile(@Body() data: MessageDto): any {
    console.log(data);
    this.socket.sendMessageFileToBaileys(data);
  }
}
