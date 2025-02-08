import { Controller,  Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/engine/guards/jwt.auth.guard';
import * as allDataObjects from '../services/data-model-objects';
import { FacebookWhatsappChatApi } from '../services/whatsapp-api/facebook-whatsapp/facebook-whatsapp-api';
import { UpdateChat } from '../services/candidate-engagement/update-chat';
import { WhatsappTemplateMessages } from '../services/whatsapp-api/facebook-whatsapp/whatsapp-template-messages';
// import {Transformations} from '../services/candidate-engagement/transformations';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { FilterCandidates } from '../services/candidate-engagement/filter-candidates';

@Controller('whatsapp-test')
export class WhatsappTestAPI {

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService
  ) {}



  @Post('template')
  @UseGuards(JwtAuthGuard)
  async create(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    const sendMessageObj: allDataObjects.sendWhatsappTemplateMessageObjectType = request.body as unknown as allDataObjects.sendWhatsappTemplateMessageObjectType;
    new FacebookWhatsappChatApi(this.workspaceQueryService).sendWhatsappTemplateMessage(sendMessageObj,apiToken);
    return { status: 'success' };
  }
  @Post('utility')
  @UseGuards(JwtAuthGuard)
  async createUtilityMessage(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    const sendMessageObj: allDataObjects.sendWhatsappUtilityMessageObjectType = request.body as unknown as allDataObjects.sendWhatsappUtilityMessageObjectType;
    new FacebookWhatsappChatApi(this.workspaceQueryService).sendWhatsappUtilityMessage(sendMessageObj,  apiToken);
    return { status: 'success' };
  }

  @Post('message')
  @UseGuards(JwtAuthGuard)
  async createTextMessage(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    const sendTextMessageObj: allDataObjects.ChatRequestBody = {
      phoneNumberTo: '918411937769',
      phoneNumberFrom: '918411937769',
      messages: 'This is the panda talking',
    };
    new FacebookWhatsappChatApi(this.workspaceQueryService).sendWhatsappTextMessage(sendTextMessageObj, apiToken);
    return { status: 'success' };
  }


  @Post('sendAttachment')
  @UseGuards(JwtAuthGuard)
  async sendFileToFBWAAPIUser(@Req() request: Request): Promise<object> {
    console.log('Send file');
    console.log('Request bod::y::', request.body);
    const sendTextMessageObj = {
      phoneNumberFrom: '918411937769',
      attachmentMessage: 'string',
      phoneNumberTo: '918411937769',
      mediaFileName: 'AttachmentFile',
      mediaID: '377908408596785',
    };
    return { status: 'success' };
  }

  // @Post('sendFile')
  // @UseGuards(JwtAuthGuard)
  // async uploadAndSendFileToFBWAAPIUser(@Req() request: any): Promise<object> {
  //   const apiToken = request.headers.authorization.split(' ')[1];
  //   const sendFileObj = request.body;
  //   const chatControl:allDataObjects.chatControls = {chatControlType:"startChat"};
  //   // candidateJob = {id: "1234"};

  //   new FacebookWhatsappChatApi(this.workspaceQueryService).uploadAndSendFileToWhatsApp(sendFileObj, candidateJob, chatControl,  apiToken);
  //   return { status: 'success' };
  // }

  @Post('downloadAttachment')
  @UseGuards(JwtAuthGuard)
  async downloadFileToFBWAAPIUser(@Req() request: Request): Promise<object> {
    const downloadAttachmentMessageObj = request.body;
    return { status: 'success' };
  }
}
