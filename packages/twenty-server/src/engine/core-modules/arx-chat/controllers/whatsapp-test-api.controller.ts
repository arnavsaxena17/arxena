import { Controller,  Injectable,  Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/engine/guards/jwt.auth.guard';
import * as allDataObjects from '../services/data-model-objects';
import { FacebookWhatsappChatApi } from '../services/whatsapp-api/facebook-whatsapp/facebook-whatsapp-api';
import { UpdateChat } from '../services/candidate-engagement/update-chat';
import { WhatsappTemplateMessages } from '../services/whatsapp-api/facebook-whatsapp/whatsapp-template-messages';
// import {Transformations} from '../services/candidate-engagement/transformations';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { FilterCandidates } from '../services/candidate-engagement/filter-candidates';
import { Cron } from '@nestjs/schedule';
import { TimeManagement } from '../services/time-management';

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




@Injectable()
export class WebhookTestCronService  {
  @Cron(TimeManagement.crontabs.crontTabToExecuteCandidateEngagement) // or any timing you prefer
  async handleWebhookTest() {
    console.log('Starting webhook test:', new Date().toISOString());
    
    try {
      // Test GET verification
      // const verificationResponse = await fetch('https://mrvpnl3x-3000.inc1.devtunnels.ms/webhook?hub.mode=subscribe&hub.verify_token=12345&hub.challenge=test_challenge', {
      //   method: 'GET'
      // });
      
      // console.log('Webhook GET verification response:', {
      //   status: verificationResponse.status,
      //   // body: await verificationResponse.text()
      // });

      // Test POST message
      const testMessage = {
        entry: [{
          changes: [{
            value: {
              messages: [{
                from: '1234567890',
                text: { body: 'Test message from cron' },
                type: 'text',
                timestamp: Math.floor(Date.now() / 1000)
              }],
              metadata: {
                display_phone_number: '0987654321'
              }
            }
          }]
        }]
      };

      const messageResponse = await fetch('https://mrvpnl3x-3000.inc1.devtunnels.ms/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testMessage)
      });

      console.log('Webhook POST test response:', {
        status: messageResponse.status,
        body: await messageResponse.text()
      });

    } catch (error) {
      console.error('Webhook test failed:', error);
    }
    
    console.log('Webhook test completed:', new Date().toISOString());
  }
}