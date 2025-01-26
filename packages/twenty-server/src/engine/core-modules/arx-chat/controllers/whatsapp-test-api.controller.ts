import { Controller,  Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/engine/guards/jwt.auth.guard';
import * as allDataObjects from '../services/data-model-objects';
import { FacebookWhatsappChatApi } from '../services/whatsapp-api/facebook-whatsapp/facebook-whatsapp-api';
import { FetchAndUpdateCandidatesChatsWhatsapps } from '../services/candidate-engagement/update-chat';
import { WhatsappTemplateMessages } from '../services/whatsapp-api/facebook-whatsapp/whatsapp-template-messages';
import {Transformations} from '../services/candidate-engagement/transformations';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { FilterCandidates } from '../services/candidate-engagement/filter-candidates';

@Controller('whatsapp-test')
export class WhatsappTestAPI {

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService
  ) {}

  // @Post('send-template-message')
  // @UseGuards(JwtAuthGuard)
  // async sendTemplateMessage(@Req() request: any): Promise<object> {

  //   const requestBody = request.body as any;
  //   const apiToken = request.headers.authorization.split(' ')[1];

  //   const personObj: allDataObjects.PersonNode = await new FilterCandidates(this.workspaceQueryService).getPersonDetailsByPhoneNumber(requestBody.phoneNumberTo,apiToken);
  //   console.log("This is the process.env.SERVER_BASE_URL:",process.env.SERVER_BASE_URL)
  //   const sendTemplateMessageObj = {
  //     recipient: personObj.phone.replace('+', ''),
  //     template_name: requestBody.templateName,
  //     candidateFirstName: personObj.name.firstName,
  //     recruiterName: allDataObjects.recruiterProfile.name,
  //     recruiterFirstName: allDataObjects.recruiterProfile.name.split(' ')[0],
  //     recruiterJobTitle: allDataObjects.recruiterProfile.job_title,
  //     recruiterCompanyName: allDataObjects.recruiterProfile.job_company_name,
  //     recruiterCompanyDescription: allDataObjects.recruiterProfile.company_description_oneliner,
  //     jobPositionName: personObj?.candidates?.edges[0]?.node?.jobs?.name,
  //     companyName: personObj?.candidates?.edges[0]?.node?.jobs?.company?.name,
  //     descriptionOneliner:personObj?.candidates?.edges[0]?.node?.jobs?.company?.descriptionOneliner,
  //     jobCode: personObj?.candidates?.edges[0]?.node?.jobs?.jobCode,
  //     jobLocation: personObj?.candidates?.edges[0]?.node?.jobs?.jobLocation,
  //     videoInterviewLink: process.env.SERVER_BASE_URL+personObj?.candidates?.edges[0]?.node?.videoInterview?.edges[0]?.node?.interviewLink?.url || "",
  //   };
  //   console.log("This is the sendTemplateMessageObj:", sendTemplateMessageObj)

  //   const response = await new FacebookWhatsappChatApi(this.workspaceQueryService).sendWhatsappUtilityMessage(sendTemplateMessageObj,apiToken);
  //   let utilityMessage = await new WhatsappTemplateMessages().getUpdatedUtilityMessageObj(sendTemplateMessageObj);
  //   const whatsappTemplateMessageSent = await new WhatsappTemplateMessages().generateMessage(requestBody.templateName, sendTemplateMessageObj);
  //   console.log("This is the mesasge obj:", personObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges)
  //   const mostRecentMessageArr: allDataObjects.ChatHistoryItem[] = personObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.messageObj;
  //   console.log("This is the mostRecentMessageArr:", mostRecentMessageArr)
  //   const chatControlType = personObj?.candidates?.edges[0].node.lastEngagementChatControl;
  //   const chatControl:allDataObjects.chatControls = { chatControlType: chatControlType, chatMessageTemplate: 'success' };
  //   mostRecentMessageArr.push({ role: 'user', content: whatsappTemplateMessageSent });

  //   const whatappUpdateMessageObj:allDataObjects.whatappUpdateMessageObjType = await new Transformations().updateChatHistoryObjCreateWhatsappMessageObj( 'success', personObj, mostRecentMessageArr, chatControl,apiToken);
  //   await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).updateCandidateEngagementDataInTable(whatappUpdateMessageObj,apiToken);
  //   console.log("This is ther esponse:", response.data)
  //   return { status: 'success' };
  // }


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
  // @Post('uploadFile')
  // @UseGuards(JwtAuthGuard)
  // async uploadFileToFBWAAPI(@Req() request: any): Promise<object> {
  //   const apiToken = request.headers.authorization.split(' ')[1];

  //   console.log('upload file to whatsapp api');
  //   const requestBody = request?.body;
  //   const filePath = requestBody?.filePath;
  //   // const chatControl = 'startChat';
  //   const chatControl:allDataObjects.chatControls = {chatControlType:"startChat"};

  //   const response = await new FacebookWhatsappChatApi(this.workspaceQueryService).uploadFileToWhatsApp(filePath, chatControl,apiToken);
  //   return response || {}; 
  // }

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
