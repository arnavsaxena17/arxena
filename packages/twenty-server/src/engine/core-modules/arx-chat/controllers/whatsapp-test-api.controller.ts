import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';

import {
  CandidateNode,
  ChatHistoryItem,
  ChatRequestBody,
  Jobs,
  PersonNode,
  sendWhatsappTemplateMessageObjectType,
  SendWhatsappUtilityMessageObjectType,
} from 'twenty-shared';

import { FilterCandidates } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/filter-candidates';
import { UpdateChat } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/update-chat';
import { getRecruiterProfileByJob } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';
import { FacebookWhatsappChatApi } from 'src/engine/core-modules/arx-chat/services/whatsapp-api/facebook-whatsapp/facebook-whatsapp-api';
import { WhatsappTemplateMessages } from 'src/engine/core-modules/arx-chat/services/whatsapp-api/facebook-whatsapp/whatsapp-template-messages';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

@Controller('whatsapp-test')
export class WhatsappTestAPI {
  constructor(private readonly workspaceQueryService: WorkspaceQueryService) {}

  @Post('send-template-message')
  @UseGuards(JwtAuthGuard)
  async sendTemplateMessage(@Req() request: any): Promise<object> {
    try {
      const requestBody = request.body as any;
      const apiToken = request.headers.authorization.split(' ')[1];

      const personObj: PersonNode = await new FilterCandidates(
        this.workspaceQueryService,
      ).getPersonDetailsByPhoneNumber(requestBody.phoneNumberTo, apiToken);

      console.log(
        'This is the process.env.SERVER_BASE_URL:',
        process.env.SERVER_BASE_URL,
      );

      const candidateNode: CandidateNode =
        personObj?.candidates?.edges[0]?.node;

      const candidateJob: Jobs = candidateNode?.jobs;
      const recruiterProfile = await getRecruiterProfileByJob(
        candidateJob,
        apiToken,
      );

      const sendTemplateMessageObj = {
        recipient:
          personObj.phones.primaryPhoneNumber.length == 10
            ? '91' + personObj.phones.primaryPhoneNumber
            : personObj.phones.primaryPhoneNumber,
        template_name: requestBody.templateName,
        candidateFirstName: personObj.name.firstName,
        recruiterName: recruiterProfile.name,
        recruiterFirstName: recruiterProfile.name.split(' ')[0],
        recruiterJobTitle: recruiterProfile.jobTitle || '',
        recruiterCompanyName: recruiterProfile.companyName,
        recruiterCompanyDescription: recruiterProfile.companyDescription,
        jobPositionName: personObj?.candidates?.edges[0]?.node?.jobs?.name,
        companyName: personObj?.candidates?.edges[0]?.node?.jobs?.company?.name,
        descriptionOneliner:
          personObj?.candidates?.edges[0]?.node?.jobs?.company
            ?.descriptionOneliner || '',
        jobCode: personObj?.candidates?.edges[0]?.node?.jobs?.jobCode,
        jobLocation: personObj?.candidates?.edges[0]?.node?.jobs?.jobLocation,
        videoInterviewLink:
          process.env.SERVER_BASE_URL +
            personObj?.candidates?.edges[0]?.node?.videoInterview?.edges[0]
              ?.node?.interviewLink?.primaryLinkUrl || '',
        candidateSource: 'Apna',
      };

      console.log(
        'This is the sendTemplateMessageObj:',
        sendTemplateMessageObj,
      );

      const response = await new FacebookWhatsappChatApi(
        this.workspaceQueryService,
      ).sendWhatsappUtilityMessage(sendTemplateMessageObj, apiToken);
      const utilityMessage =
        await new WhatsappTemplateMessages().getUpdatedUtilityMessageObj(
          sendTemplateMessageObj,
        );
      // const whatsappTemplateMessageSent = await new WhatsappTemplateMessages().generateMessage(requestBody.templateName, sendTemplateMessageObj);
      const mostRecentMessageArr: ChatHistoryItem[] =
        personObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node
          ?.messageObj;

      console.log('This is the mostRecentMessageArr:', mostRecentMessageArr);
      const chatControl = {
        chatControlType:
          personObj?.candidates?.edges[0]?.node?.lastEngagementChatControl,
      };

      mostRecentMessageArr.push({
        role: 'user',
        content: requestBody.templateName,
      });
      const whatappUpdateMessageObj = await new FilterCandidates(
        this.workspaceQueryService,
      ).updateChatHistoryObjCreateWhatsappMessageObj(
        'success',
        personObj,
        personObj.candidates.edges[0].node,
        mostRecentMessageArr,
        chatControl,
        apiToken,
      );

      await new UpdateChat(
        this.workspaceQueryService,
      ).updateCandidateEngagementDataInTable(whatappUpdateMessageObj, apiToken);
      console.log('This is ther esponse:', response.data);
    } catch (error) {
      console.error('Error in sendTemplateMessage:', error);
      throw error;
    }

    return { status: 'success' };
  }

  @Post('template')
  @UseGuards(JwtAuthGuard)
  async create(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    const sendMessageObj: sendWhatsappTemplateMessageObjectType =
      request.body as unknown as sendWhatsappTemplateMessageObjectType;

    new FacebookWhatsappChatApi(
      this.workspaceQueryService,
    ).sendWhatsappTemplateMessage(sendMessageObj, apiToken);

    return { status: 'success' };
  }

  @Post('utility')
  @UseGuards(JwtAuthGuard)
  async createUtilityMessage(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    const sendMessageObj: SendWhatsappUtilityMessageObjectType =
      request.body as unknown as SendWhatsappUtilityMessageObjectType;

    new FacebookWhatsappChatApi(
      this.workspaceQueryService,
    ).sendWhatsappUtilityMessage(sendMessageObj, apiToken);

    return { status: 'success' };
  }

  @Post('message')
  @UseGuards(JwtAuthGuard)
  async createTextMessage(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    const sendTextMessageObj: ChatRequestBody = {
      phoneNumberTo: '918411937769',
      phoneNumberFrom: '918411937769',
      messages: 'This is the panda talking',
    };

    new FacebookWhatsappChatApi(
      this.workspaceQueryService,
    ).sendWhatsappTextMessage(sendTextMessageObj, apiToken);

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
  //   const chatControl:ChatControlsObjType = {chatControlType:"startChat"};
  //   // candidateJob = {id: "1234"};

  //   new FacebookWhatsappChatApi(this.workspaceQueryService).uploadAndSendFileToWhatsApp(sendFileObj, candidateJob, chatControl,  apiToken);
  //   return { status: 'success' };
  // }

  // @Post('downloadAttachment')
  // @UseGuards(JwtAuthGuard)
  // async downloadFileToFBWAAPIUser(@Req() request: Request): Promise<object> {
  //   const downloadAttachmentMessageObj = request.body;

  //   return { status: 'success' };
  // }

  @Get('get-templates')
  @UseGuards(JwtAuthGuard)
  async getTemplates(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];
    const templates = await new FacebookWhatsappChatApi(
      this.workspaceQueryService,
    ).getWhatsappTemplates(apiToken);

    return { templates };
  }
}

// @Injectable()
// export class WebhookTestCronService  {
//   @Cron(TimeManagement.crontabs.crontTabToExecuteCandidateEngagement) // or any timing you prefer
//   async handleWebhookTest() {
//     console.log('Starting webhook test:', new Date().toISOString());

//     try {
//       // Test GET verification
//       // const verificationResponse = await fetch('https://mrvpnl3x-3000.inc1.devtunnels.ms/webhook?hub.mode=subscribe&hub.verify_token=12345&hub.challenge=test_challenge', {
//       //   method: 'GET'
//       // });

//       // console.log('Webhook GET verification response:', {
//       //   status: verificationResponse.status,
//       //   // body: await verificationResponse.text()
//       // });

//       // Test POST message
//       const testMessage = {
//         entry: [{
//           changes: [{
//             value: {
//               messages: [{
//                 from: '1234567890',
//                 text: { body: 'Test message from cron' },
//                 type: 'text',
//                 timestamp: Math.floor(Date.now() / 1000)
//               }],
//               metadata: {
//                 display_phone_number: '0987654321'
//               }
//             }
//           }]
//         }]
//       };

//       const messageResponse = await fetch('https://mrvpnl3x-3000.inc1.devtunnels.ms/webhook', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json'
//         },
//         body: JSON.stringify(testMessage)
//       });

//       console.log('Webhook POST test response:', {
//         status: messageResponse.status,
//         body: await messageResponse.text()
//       });

//     } catch (error) {
//       console.error('Webhook test failed:', error);
//     }

//     console.log('Webhook test completed:', new Date().toISOString());
//   }
// }
