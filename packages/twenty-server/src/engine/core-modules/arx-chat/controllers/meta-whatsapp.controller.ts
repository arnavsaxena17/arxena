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

@Controller('meta-whatsapp-controller')
export class MetaWhatsappController {
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
        companyName: personObj?.candidates?.edges.filter(
          (edge) => edge.node.jobs.id === candidateJob.id,
        )[0]?.node?.jobs?.company?.name,
        descriptionOneliner:
          personObj?.candidates?.edges.filter(
            (edge) => edge.node.jobs.id === candidateJob.id,
          )[0]?.node?.jobs?.companyDetails || '',
        jobCode: personObj?.candidates?.edges.filter(
          (edge) => edge.node.jobs.id === candidateJob.id,
        )[0]?.node?.jobs?.jobCode,
        jobLocation: personObj?.candidates?.edges.filter(
          (edge) => edge.node.jobs.id === candidateJob.id,
        )[0]?.node?.jobs?.jobLocation,
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
        personObj.candidates.edges.filter(
          (candidate) => candidate.node.jobs.id == candidateJob.id,
        )[0].node,
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


  @Post('uploadFile')
  async uploadFileToFBWAAPI(@Req() request: any): Promise<object> {
    console.log('This is the request body:', request.body);
    const apiToken = request.headers.authorization.split(' ')[1];

    console.log('upload file to meta whatsapp business api');
    const requestBody = request?.body;
    const filePath = requestBody?.filePath;
    const response = await new FacebookWhatsappChatApi(
      this.workspaceQueryService,
    ).uploadFileToWhatsAppUsingControllerApi(filePath, apiToken);

    return response || {}; // Return an empty object if the response is undefined
  }


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