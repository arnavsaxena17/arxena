import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/engine/guards/jwt.auth.guard';
import * as allDataObjects from '../services/data-model-objects';
import { FacebookWhatsappChatApi } from '../services/whatsapp-api/facebook-whatsapp/facebook-whatsapp-api';
import { IncomingWhatsappMessages } from '../services/whatsapp-api/incoming-messages';
import { UpdateChat } from '../services/candidate-engagement/update-chat';
import { StageWiseClassification } from '../services/llm-agents/stage-classification';
import { OpenAIArxMultiStepClient } from '../services/llm-agents/arx-multi-step-client';
import { axiosRequest, formatChat } from '../utils/arx-chat-agent-utils';
import * as allGraphQLQueries from '../graphql-queries/graphql-queries-chatbot';
import { ToolCallsProcessing } from '../services/llm-agents/tool-calls-processing';
import { HumanLikeLLM } from '../services/llm-agents/human-or-bot-classification';
import { GmailMessageData } from '../../gmail-sender/services/gmail-sender-objects-types';
import { SendEmailFunctionality, EmailTemplates } from '../utils/send-gmail';
import axios from 'axios';
import { CandidateService } from 'src/engine/core-modules/candidate-sourcing/services/candidate.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { graphQltoUpdateOneCandidate } from 'src/engine/core-modules/candidate-sourcing/graphql-queries';
import { CreateMetaDataStructure } from 'src/engine/core-modules/workspace-modifications/object-apis/object-apis-creation';
import { FilterCandidates } from '../services/candidate-engagement/filter-candidates';
import { ChatControls } from '../services/candidate-engagement/chat-controls';
import CandidateEngagementArx from '../services/candidate-engagement/candidate-engagement';
import { consoleIntegration } from '@sentry/node';
import { GoogleSheetsService } from '../../google-sheets/google-sheets.service';

@Controller('arx-chat')
export class ArxChatEndpoint {
  constructor(
    private readonly candidateService: CandidateService,
    private readonly workspaceQueryService: WorkspaceQueryService,
  ) {}

  @Post('start-chat')
  @UseGuards(JwtAuthGuard)
  async startChat(@Req() request: any) {
    const apiToken = request.headers.authorization.split(' ')[1]; // Assuming Bearer token
    const chatControl: allDataObjects.chatControls = { chatControlType: 'startChat' };
    const response = await new CandidateEngagementArx(this.workspaceQueryService).createChatControl(request.body.candidateId, chatControl, apiToken);
    console.log('Response from create start-Chat api', response);
  }

  // @Post('start-chats')
  // async startChatsByJobCandidateIds(@Req() request: any): Promise<object> {
  //   const apiToken = request.headers.authorization.split(' ')[1];
  //   const jobCandidateIds = request.body.jobCandidateIds;
  //   const currentViewWithCombinedFiltersAndSorts = request.body.currentViewWithCombinedFiltersAndSorts;
  //   const objectNameSingular = request.body.objectNameSingular;
  //   console.log('jobCandidateIds::', jobCandidateIds);
  //   console.log('objectNameSingular::', objectNameSingular);
  //   const path_position = request?.body?.objectNameSingular.replace('JobCandidate', '');
  //   const allDataObjects = await new CreateMetaDataStructure(this.workspaceQueryService).fetchAllObjects(apiToken);

  //   const allJobCandidates = await this.candidateService.findManyJobCandidatesWithCursor(path_position, apiToken);
  //   console.log('All Job Candidates:', allJobCandidates?.length);
  //   const filteredCandidateIds = await this.candidateService.filterCandidatesBasedOnView(allJobCandidates, currentViewWithCombinedFiltersAndSorts, allDataObjects);
  //   console.log('This is the filteredCandidates, ', filteredCandidateIds);
  //   console.log('Got a total of filteredCandidates length, ', filteredCandidateIds.length);
  //   console.log('Starting chat for , ', filteredCandidateIds.length, ' candidates');
  //   for (const candidateId of filteredCandidateIds) {
  //     const chatControl: allDataObjects.chatControls = { chatControlType: 'startChat' };
  //     await await new CandidateEngagementArx(this.workspaceQueryService).createChatControl(candidateId, chatControl, apiToken);
  //   }
  //   return { status: 'Success' };
  // }
  @Post('start-chats-by-candidate-ids')
  async startChatsByCandidateIds(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];
    const candidateIds = request.body.jobCandidateIds;
    for (const candidateId of candidateIds) {
      const chatControl: allDataObjects.chatControls = { chatControlType: 'startChat' };
      await await new CandidateEngagementArx(this.workspaceQueryService).createChatControl(candidateId, chatControl, apiToken);
    }
    return { status: 'Success' };
  }

  @Post('stop-chat')
  @UseGuards(JwtAuthGuard)
  async stopChat(@Req() request: any) {
    const apiToken = request.headers.authorization.split(' ')[1]; // Assuming Bearer token

    const graphqlVariables = {
      idToUpdate: request.body.candidateId,
      input: {
        stopChat: true,
      },
    };
    const graphqlQueryObj = JSON.stringify({
      query: graphQltoUpdateOneCandidate,
      variables: graphqlVariables,
    });

    const response = await axiosRequest(graphqlQueryObj, apiToken);
    console.log('Response from create stopchat', response.data);
  }

  @Post('fetch-candidate-by-phone-number-start-chat')
  @UseGuards(JwtAuthGuard)
  async fetchCandidateByPhoneNumber(@Req() request: any) {
    const apiToken = request.headers.authorization.split(' ')[1]; // Assuming Bearer token
    const phoneNumber = request.body.phoneNumber;
    console.log('called fetchCandidateByPhoneNumber for phone:', phoneNumber);
    const personObj: allDataObjects.PersonNode = await new FilterCandidates(this.workspaceQueryService).getPersonDetailsByPhoneNumber(phoneNumber, apiToken);
    const candidateId = personObj.candidates?.edges[0]?.node?.id;
    const graphqlVariables = {
      idToUpdate: candidateId,
      input: {
        startChat: true,
      },
    };
    const graphqlQueryObj = JSON.stringify({
      query: graphQltoUpdateOneCandidate,
      variables: graphqlVariables,
    });

    const response = await axiosRequest(graphqlQueryObj, apiToken);
    console.log('Response from create fetch-candidate-by-phone-number-start::', response.data);
    return response.data;
  }

  @Post('retrieve-chat-response')
  @UseGuards(JwtAuthGuard)
  async retrieve(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    const personObj: allDataObjects.PersonNode = await new FilterCandidates(this.workspaceQueryService).getPersonDetailsByPhoneNumber(request.body.phoneNumberFrom,apiToken);
    // debugger;

    try {
      const personCandidateNode = personObj?.candidates?.edges[0]?.node;
      const candidateJob = personCandidateNode?.jobs;
      // const messagesList = personCandidateNode?.whatsappMessages?.edges;
      const messagesList: allDataObjects.MessageNode[] = await new FilterCandidates(this.workspaceQueryService).fetchAllWhatsappMessages(personCandidateNode.id,apiToken);
      let mostRecentMessageArr: allDataObjects.ChatHistoryItem[] = new FilterCandidates(this.workspaceQueryService ).getMostRecentMessageFromMessagesList(messagesList);
      const isChatEnabled: boolean = false;
      if (mostRecentMessageArr?.length > 0) {
        let chatAgent: OpenAIArxMultiStepClient;
        chatAgent = new OpenAIArxMultiStepClient(personObj, this.workspaceQueryService);
        const chatControl: allDataObjects.chatControls = { chatControlType: 'startChat' };
        mostRecentMessageArr = (await chatAgent.createCompletion(mostRecentMessageArr, candidateJob, chatControl, apiToken, isChatEnabled)) || [];
        return mostRecentMessageArr;
      }
    } catch (err) {
      return { status: err };
    }
    return { status: 'Failed' };
  }




  @Post('start-interim-chat-prompt')
  @UseGuards(JwtAuthGuard)
  async startChatPrompt(@Req() request: any) {
    const apiToken = request.headers.authorization.split(' ')[1]; // Assuming Bearer token
    const interimChat = request.body.interimChat;
    const phoneNumber = request.body.phoneNumber;
    console.log('called interimChat:', interimChat);
    const personObj: allDataObjects.PersonNode = await new FilterCandidates(this.workspaceQueryService).getPersonDetailsByPhoneNumber(phoneNumber, apiToken);
    const candidateId = personObj.candidates?.edges[0]?.node?.id;
    const chatReply = interimChat;
      const whatsappIncomingMessage: allDataObjects.chatMessageType = {
        phoneNumberFrom: phoneNumber,
        phoneNumberTo: allDataObjects.recruiterProfile.phone,
        messages: [{ role: 'user', content: chatReply }],
        messageType: 'string',
      };
      const candidateProfileData = await new FilterCandidates(this.workspaceQueryService).getCandidateInformation(whatsappIncomingMessage,apiToken);
      const candidateJob:allDataObjects.Jobs = candidateProfileData.jobs
      console.log('This is the candiate who has sent us the message., we have to update the database that this message has been recemivged::', chatReply);
      const replyObject = {
        chatReply: chatReply,
        whatsappDeliveryStatus: 'receivedFromCandidate',
        phoneNumberFrom: phoneNumber,
        whatsappMessageId: "NA",
      };
      const responseAfterMessageUpdate = await new IncomingWhatsappMessages(this.workspaceQueryService).createAndUpdateIncomingCandidateChatMessage(replyObject, candidateProfileData,candidateJob, apiToken);
    return;
  }

  @Post('send-chat')
  @UseGuards(JwtAuthGuard)
  async SendChat(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    const messageToSend = request?.body?.messageToSend;
    const phoneNumber = request.body.phoneNumberTo;

    const personObj: allDataObjects.PersonNode = await new FilterCandidates(this.workspaceQueryService).getPersonDetailsByPhoneNumber(phoneNumber, apiToken);
    console.log('This is the chat reply:', messageToSend);
    const recruiterProfile = allDataObjects.recruiterProfile;
    console.log('Recruiter profile', recruiterProfile);
    const chatMessages = personObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges;
    let chatHistory = chatMessages[0]?.node?.messageObj || [];
    const chatControl: allDataObjects.chatControls = { chatControlType: 'startChat' };
    chatHistory = personObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.messageObj;
    let whatappUpdateMessageObj: allDataObjects.whatappUpdateMessageObjType = {
      candidateProfile: personObj?.candidates?.edges[0]?.node,
      candidateFirstName: personObj?.name?.firstName,
      phoneNumberFrom: recruiterProfile.phone,
      whatsappMessageType: personObj?.candidates?.edges[0]?.node.whatsappProvider || 'application03',
      phoneNumberTo: personObj?.phone,
      messages: [{ content: request?.body?.messageToSend }],
      messageType: 'recruiterMessage',
      messageObj: chatHistory,
      lastEngagementChatControl: chatControl.chatControlType,
      whatsappDeliveryStatus: 'created',
      whatsappMessageId: 'startChat',
    };
    let messageObj: allDataObjects.ChatRequestBody = {
      phoneNumberFrom: recruiterProfile.phone,
      phoneNumberTo: personObj.phone,
      messages: messageToSend,
    };
    const sendMessageResponse = await new FacebookWhatsappChatApi(this.workspaceQueryService).sendWhatsappTextMessage(messageObj, apiToken);
    whatappUpdateMessageObj.whatsappMessageId = sendMessageResponse?.data?.messages[0]?.id;
    whatappUpdateMessageObj.whatsappDeliveryStatus = 'sent';
    await new UpdateChat(this.workspaceQueryService).createAndUpdateWhatsappMessage(personObj.candidates.edges[0].node, whatappUpdateMessageObj, apiToken);
    return { status: 'success' };
  }

  @Post('get-all-messages-by-candidate-id')
  @UseGuards(JwtAuthGuard)
  async getWhatsappMessagessByCandidateId(@Req() request: any): Promise<object[]> {
    const apiToken = request.headers.authorization.split(' ')[1];
    const candidateId = request.body.candidateId;
    const allWhatsappMessages = await new FilterCandidates(this.workspaceQueryService).fetchAllWhatsappMessages(candidateId, apiToken);
    return allWhatsappMessages;
  }

  @Post('get-all-messages-by-phone-number')
  @UseGuards(JwtAuthGuard)
  async getAllMessagesByPhoneNumber(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];
    console.log('Going to get all messages by phone Number for :', request.body.phoneNumber);
    const personObj: allDataObjects.PersonNode = await new FilterCandidates(this.workspaceQueryService).getPersonDetailsByPhoneNumber(request.body.phoneNumber, apiToken);
    const candidateId = personObj?.candidates?.edges[0]?.node?.id;
    const allWhatsappMessages = await new FilterCandidates(this.workspaceQueryService).fetchAllWhatsappMessages(candidateId, apiToken);
    const formattedMessages = await formatChat(allWhatsappMessages);
    console.log('All messages length:', allWhatsappMessages?.length, 'for phone number:', request.body.phoneNumber);
    return { formattedMessages: formattedMessages };
  }

  @Post('get-candidate-status-by-phone-number')
  @UseGuards(JwtAuthGuard)
  async getCandidateStatusByPhoneNumber(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    console.log('Going to get candidate status by phone Number for :', request.body.phoneNumber);
    const personObj: allDataObjects.PersonNode = await new FilterCandidates(this.workspaceQueryService).getPersonDetailsByPhoneNumber(request.body.phoneNumber, apiToken);
    const candidateStatus = personObj?.candidates?.edges[0]?.node?.status || 'Unknown';
    console.log('Candidate satus:', candidateStatus, 'for phone number:', request.body.phoneNumber);
    return { status: candidateStatus };
  }

  @Post('get-candidate-by-phone-number')
  @UseGuards(JwtAuthGuard)
  async getCandidateIdsByPhoneNumbers(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];
    console.log('Going to get candidate by phone Number for :', request.body.phoneNumber);
    const personObj: allDataObjects.PersonNode = await new FilterCandidates(this.workspaceQueryService).getPersonDetailsByPhoneNumber(request.body.phoneNumber, apiToken);
    const candidateId = personObj?.candidates?.edges[0]?.node?.id;
    console.log('candidateId to fetch all candidateby phonenumber:', candidateId);
    return { candidateId: candidateId };
  }

  @Post('get-candidate-id-by-hiring-naukri-url')
  @UseGuards(JwtAuthGuard)
  async getCandidateIdsByHiringNaukriURL(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1];
      console.log('Going to get candidate by hiring-naukri-url :', request?.body?.hiringNaukriUrl);
      const hiringNaukriUrl = request.body.hiringNaukriUrl;
      const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToManyCandidateById, variables: { filter: { hiringNaukriUrl: { url: { eq: hiringNaukriUrl } } } } });
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      console.log('Fetched candidate by candidate ID:', response?.data);
      const candidateObj = response?.data?.data?.candidates?.edges[0]?.node;
      console.log('Fetched candidate by candidate OB:', candidateObj);
      const candidateId = candidateObj?.id;
      console.log('candidateId to fetch all candidateby hiring-naukri:', candidateId);
      return { candidateId };
    } catch (err) {
      console.log('Error in fetching candidate by hiring-naukri-url :', err);
      return { candidateId: null };
    }
  }

  @Post('get-candidate-id-by-resdex-naukri-url')
  @UseGuards(JwtAuthGuard)
  async getCandidateIdsByResdexNaukriURL(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1];
      console.log('Going to get candidate esdex-naukri-ur :', request.body.resdexNaukriUrl);
      const resdexNaukriUrl = request.body.resdexNaukriUrl;
      const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToManyCandidateById, variables: { filter: { resdexNaukriUrl: { url: { eq: resdexNaukriUrl } } } } });
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      console.log('Fetched candidate by candidate ID:', response?.data);
      const candidateObj = response?.data?.data?.candidates?.edges[0]?.node;
      console.log('Fetched candidate by candidate Obj ID:', candidateObj);
      const candidateId = candidateObj?.id;
      console.log('candidateId to fetch all candidateby resdex-naukri:', candidateId);
      return { candidateId };
    } catch (err) {
      console.log('Error in fetching candidate by resdex-naukri-url:', err);
      return { candidateId: null };
    }
  }

  @Post('get-id-by-unique-string-key')
  @UseGuards(JwtAuthGuard)
  async getCandidateByUniqueStringKey(@Req() request: any): Promise<{ candidateId: string | null }> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1];

      const graphqlQuery = JSON.stringify({
        query: allGraphQLQueries.graphqlQueryToFindManyPeople,
        variables: {
          filter: { uniqueStringKey: { eq: request.body.uniqueStringKey } },
          limit: 1,
        },
      });

      const response = await axiosRequest(graphqlQuery, apiToken);
      const candidateId = response?.data?.data?.people?.edges[0]?.node?.candidates?.edges[0]?.node?.id || null;
      return { candidateId };
    } catch (err) {
      console.error('Error in getCandidateByUniqueStringKey:', err);
      return { candidateId: null };
    }
  }

  @Post('refresh-chat-status-by-candidates')
  @UseGuards(JwtAuthGuard)
  async countChats(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1];
      const { candidateIds } = request.body;
      console.log('going to refresh chats');
      console.log('Fetching job IDs for candidates:', candidateIds);
      // const graphqlQuery = JSON.stringify({
      //   query: allGraphQLQueries.graphqlQueryToManyCandidateById,
      //   variables: { filter: { id: { in: candidateIds } } }
      // });

      // const response = await axiosRequest(graphqlQuery, apiToken);
      // console.log("Number of candidates fetched:", response?.data?.data?.candidates?.edges.length);
      // const jobIds = response?.data?.data?.candidates?.edges.map((edge: { node?: { jobs?: { id: string } } }) => edge?.node?.jobs?.id)
      // console.log("Found job IDs:", jobIds);
      const jobIds = await new FilterCandidates(this.workspaceQueryService).getJobIdsFromCandidateIds(candidateIds, apiToken);
      const results = await new UpdateChat(this.workspaceQueryService).processCandidatesChatsGetStatuses(apiToken, jobIds, candidateIds);
      console.log("Have received results and will try and update the sheets also from the controlelr")
      await new GoogleSheetsService().updateGoogleSheetsWithChatData(results, apiToken);
      
      return { status: 'Success' };
    } catch (err) {
      console.error('Error in countChats:', err);
      return { status: 'Failed', error: err };
    }
  }

  @Post('refresh-chat-counts-by-candidates')
  @UseGuards(JwtAuthGuard)
  async refreshChats(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];
    try {
      const { candidateIds } = request.body;
      console.log('going to refresh chat counts by candidate Ids');
      await new UpdateChat(this.workspaceQueryService).updateCandidatesWithChatCount(candidateIds, apiToken);
      return { status: 'Success' };
    } catch (err) {
      console.error('Error in refresh-chat-counts-by-candi chats:', err);
      return { status: 'Failed', error: err };
    }
  }

  @Post('create-shortlist-document')
  @UseGuards(JwtAuthGuard)
  async createShortlistDocument(@Req() request: any): Promise<object> {
    try {
      const { candidateIds } = request.body;
      const apiToken = request.headers.authorization.split(' ')[1];
      console.log('going to refresh chat counts by candidate Ids', candidateIds);
      await new UpdateChat(this.workspaceQueryService).createShortlistDocument(candidateIds, apiToken);
      console.log('This is the response in create chatBasedShortlistDelivery shortlist');
      return { status: 'Success' };
    } catch (err) {
      console.error('Error in create_gmail_draft_shortlist chats:', err);
      return { status: 'Failed', error: err };
    }
  }

  @Post('chat-based-shortlist-delivery')
  @UseGuards(JwtAuthGuard)
  async chatBasedShortlistDelivery(@Req() request: any): Promise<object> {
    try {
      const { candidateIds } = request.body;
      const apiToken = request.headers.authorization.split(' ')[1];
      console.log('going to refresh chat counts by candidate Ids', candidateIds);
      await new UpdateChat(this.workspaceQueryService).createChatBasedShortlistDelivery(candidateIds, apiToken);
      console.log('This is the response in create chatBasedShortlistDelivery shortlist');
      return { status: 'Success' };
    } catch (err) {
      console.error('Error in create_gmail_draft_shortlist chats:', err);
      return { status: 'Failed', error: err };
    }
  }

  @Post('create-gmail-draft-shortlist')
  @UseGuards(JwtAuthGuard)
  async chatGmailDraftShortlist(@Req() request: any): Promise<object> {
    try {
      const { candidateIds } = request.body;
      const apiToken = request.headers.authorization.split(' ')[1];
      console.log('going to refresh chat counts by candidate Ids', candidateIds);
      const createGmailBasedShortlist = await new UpdateChat(this.workspaceQueryService).createGmailDraftShortlist(candidateIds, apiToken);
      console.log('This is the response in create chatBasedShortlistDelivery shortlist');
      return { status: 'Success' };
    } catch (err) {
      console.error('Error in create_gmail_draft_shortlist chats:', err);
      return { status: 'Failed', error: err };
    }
  }

  @Post('create-shortlist')
  @UseGuards(JwtAuthGuard)
  async createShortlist(@Req() request: any): Promise<object> {
    try {
      console.log('Create shortlist called');
      const { candidateIds } = request.body;
      const apiToken = request.headers.authorization.split(' ')[1];
      await new UpdateChat(this.workspaceQueryService).createShortlist(candidateIds, apiToken);
      return { status: 'Success' };
    } catch (err) {
      console.error('Error creating shortlist:', err);
      return { status: 'Failed', error: err };
    }
  }

  @Post('create-interview-videos')
  @UseGuards(JwtAuthGuard)
  async createInterviewVideos(@Req() request: any): Promise<object> {
    try {
      console.log('Create video interview called');
      const apiToken = request.headers.authorization.split(' ')[1];
      const jobId = request.body.jobId;
      await new UpdateChat(this.workspaceQueryService).createInterviewVideos(jobId, apiToken);
      return { status: 'Success' };
    } catch (err) {
      console.log('Error creating interview videos:', err);
      return { status: 'Failed', error: err };
    }
  }

  @Post('get-id-by-naukri-url')
  @UseGuards(JwtAuthGuard)
  async getCandidateIdByNaukriURL(@Req() request: any): Promise<{ candidateId: string | null }> {
    const apiToken = request.headers.authorization.split(' ')[1];

    try {
      const url = request.body[request.body.resdexNaukriUrl ? 'resdexNaukriUrl' : 'hiringNaukriUrl'];
      const type = request.body.resdexNaukriUrl ? 'resdex' : 'hiring';

      const graphqlQueryObj = JSON.stringify({
        query: allGraphQLQueries.graphqlQueryToManyCandidateById,
        variables: {
          filter: {
            [`${type}NaukriUrl`]: { url: { eq: url } },
          },
        },
      });

      const response = await axiosRequest(graphqlQueryObj, apiToken);
      const candidateId = response?.data?.data?.candidates?.edges[0]?.node?.id || null;

      console.log(`Fetched candidateId for ${type}: ${candidateId}`);
      return { candidateId };
    } catch (err) {
      console.error(`Error fetching candidate by ${request.body.resdexNaukriUrl ? 'resdex' : 'hiring'}-naukri-url:`, err);
      return { candidateId: null };
    }
  }

  @Get('get-candidates-and-chats')
  @UseGuards(JwtAuthGuard)
  async getCandidatesAndChats(@Req() request: any): Promise<object> {
    console.log('Going to get all candidates and chats');
    const apiToken = request?.headers?.authorization?.split(' ')[1];
    const chatControl: allDataObjects.chatControls = { chatControlType: 'allStartedAndStoppedChats' };
    const { people, candidateJob } = await new CandidateEngagementArx(this.workspaceQueryService).fetchSpecificPeopleToEngageAcrossAllChatControls(chatControl, apiToken);
    console.log('All people length:', people?.length);
    return people;
  }

  @Get('get-person-chat')
  @UseGuards(JwtAuthGuard)
  async getCandidateAndChat(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];
    const candidateId = request.query.candidateId;
    const person = await new FilterCandidates(this.workspaceQueryService).getPersonDetailsByCandidateId(candidateId, apiToken);
    const chatControl: allDataObjects.chatControls = { chatControlType: 'allStartedAndStoppedChats' };
    const allPeople = await new FilterCandidates(this.workspaceQueryService).fetchAllPeopleByCandidatePeopleIds([person.id], apiToken);
    console.log('All people length:', allPeople?.length);
    return allPeople;
  }

  @Post('delete-people-and-candidates-from-candidate-id')
  @UseGuards(JwtAuthGuard)
  async deletePeopleFromCandidateIds(@Req() request: any): Promise<object> {
    const candidateId = request.body.candidateId;
    const apiToken = request.headers.authorization.split(' ')[1];

    console.log('candidateId to create video-interview:', candidateId);
    const graphqlQueryObjToFetchCandidate = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToManyCandidateById, variables: { filter: { id: { eq: candidateId } } } });
    const candidateObjresponse = await axiosRequest(graphqlQueryObjToFetchCandidate, apiToken);
    const candidateObj = candidateObjresponse?.data?.data;
    console.log('candidate objk1:', candidateObj);

    const candidateNode = candidateObjresponse?.data?.data?.candidates?.edges[0]?.node;
    if (!candidateNode) {
      console.log('Candidate not found');
      return { status: 'Failed', message: 'Candidate not found' };
    }
    const personId = candidateNode?.people?.id;
    if (!personId) {
      console.log('Person ID not found');
      return { status: 'Failed', message: 'Person ID not found' };
    }

    const graphqlQueryObj = JSON.stringify({
      query: allGraphQLQueries.graphqlMutationToDeleteManyCandidates,
      variables: { filter: { id: { in: [candidateId] } } },
    });

    console.log('Going to try and delete candidate');
    try {
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      console.log('Deleted candidate:', response.data);
    } catch (err) {
      console.log('Error deleting candidate:', err.response?.data || err.message);
      return { status: 'Failed', message: 'Error deleting candidate' };
    }
    const graphqlQueryObjToDeletePerson = JSON.stringify({
      query: allGraphQLQueries.graphqlMutationToDeleteManyPeople,
      variables: { filter: { id: { in: [personId] } } },
    });
    console.log('Going to try and delete person');
    try {
      const response = await axiosRequest(graphqlQueryObjToDeletePerson, apiToken);
      console.log('Deleted person:', response.data);
      return { status: 'Success' };
    } catch (err) {
      console.log('Error deleting person:', err.response?.data || err.message);
      return { status: 'Failed', message: 'Error deleting person' };
    }
  }

  @Post('delete-people-and-candidates-from-person-id')
  @UseGuards(JwtAuthGuard)
  async deletePeopleFromPersonIds(@Req() request: any): Promise<object> {
    const personId = request.body.personId;
    const apiToken = request.headers.authorization.split(' ')[1];
    console.log('personId to delete:', personId);
    const graphqlQueryObjToFetchPerson = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToFindManyPeople, variables: { filter: { id: { eq: personId } } } });
    const personresponse = await axiosRequest(graphqlQueryObjToFetchPerson, apiToken);
    const personObj = personresponse?.data?.data;
    console.log('personresponse objk1:', personObj);
    const personNode = personresponse?.data?.data?.people?.edges[0]?.node;
    if (!personNode) {
      console.log('Person not found');
      return { status: 'Failed', message: 'Candidate not found' };
    }
    const candidateId = personNode?.candidates?.edges[0].node.id;
    console.log('personNode:', personNode);
    console.log('candidateId:', candidateId);
    if (!candidateId) {
      console.log('candidateId ID not found');
      return { status: 'Failed', message: 'candidateId ID not found' };
    }
    console.log('candidateId ID:', candidateId);
    const graphqlQueryObj = JSON.stringify({
      query: allGraphQLQueries.graphqlMutationToDeleteManyCandidates,
      variables: { filter: { id: { in: [candidateId] } } },
    });
    console.log('Going to try and delete candidate');
    try {
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      console.log('Deleted candidate:', response.data);
    } catch (err) {
      console.log('Error deleting candidate:', err.response?.data || err.message);
      return { status: 'Failed', message: 'Error deleting candidate' };
    }
    const graphqlQueryObjToDeletePerson = JSON.stringify({
      query: allGraphQLQueries.graphqlMutationToDeleteManyPeople,
      variables: { filter: { id: { in: [personId] } } },
    });
    console.log('Going to try and delete person');
    try {
      const response = await axiosRequest(graphqlQueryObjToDeletePerson, apiToken);
      console.log('Deleted person:', response.data);
      return { status: 'Success' };
    } catch (err) {
      console.log('Error deleting person:', err.response?.data || err.message);
      return { status: 'Failed', message: 'Error deleting person' };
    }
  }

  @Post('delete-people-and-candidates-bulk')
  @UseGuards(JwtAuthGuard)
  async deletePeopleAndCandidatesBulk(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    const { candidateIds, personIds } = request.body;
    const results: { succeeded: string[]; failed: string[] } = {
      succeeded: [],
      failed: [],
    };

    if (candidateIds?.length) {
      // First fetch all candidate information to get associated person IDs
      const graphqlQueryObjToFetchCandidates = JSON.stringify({
        query: allGraphQLQueries.graphqlQueryToManyCandidateById,
        variables: { filter: { id: { in: candidateIds } } },
      });

      const candidatesResponse = await axiosRequest(graphqlQueryObjToFetchCandidates, apiToken);
      const candidateNodes = candidatesResponse?.data?.data?.candidates?.edges || [];

      // Collect all person IDs associated with these candidates
      const personIdsFromCandidates = candidateNodes.map(edge => edge.node?.people?.id).filter(id => id);

      // Delete candidates in bulk
      try {
        const graphqlQueryObjDeleteCandidates = JSON.stringify({
          query: allGraphQLQueries.graphqlMutationToDeleteManyCandidates,
          variables: { filter: { id: { in: candidateIds } } },
        });
        await axiosRequest(graphqlQueryObjDeleteCandidates, apiToken);

        // Delete associated people in bulk
        const graphqlQueryObjDeletePeople = JSON.stringify({
          query: allGraphQLQueries.graphqlMutationToDeleteManyPeople,
          variables: { filter: { id: { in: personIdsFromCandidates } } },
        });
        await axiosRequest(graphqlQueryObjDeletePeople, apiToken);

        results.succeeded.push(...candidateIds);
      } catch (err) {
        console.error('Error in bulk deletion:', err);
        results.failed.push(...candidateIds);
      }
    }

    if (personIds?.length) {
      // First fetch all person information to get associated candidate IDs
      const graphqlQueryObjToFetchPeople = JSON.stringify({
        query: allGraphQLQueries.graphqlQueryToFindManyPeople,
        variables: { filter: { id: { in: personIds } } },
      });

      const peopleResponse = await axiosRequest(graphqlQueryObjToFetchPeople, apiToken);
      const peopleNodes = peopleResponse?.data?.data?.people?.edges || [];

      // Collect all candidate IDs associated with these people
      const candidateIdsFromPeople = peopleNodes
        .flatMap(edge => edge.node?.candidates?.edges || [])
        .map(edge => edge?.node?.id)
        .filter(id => id);

      try {
        // Delete candidates first
        const graphqlQueryObjDeleteCandidates = JSON.stringify({
          query: allGraphQLQueries.graphqlMutationToDeleteManyCandidates,
          variables: { filter: { id: { in: candidateIdsFromPeople } } },
        });
        await axiosRequest(graphqlQueryObjDeleteCandidates, apiToken);

        // Then delete people
        const graphqlQueryObjDeletePeople = JSON.stringify({
          query: allGraphQLQueries.graphqlMutationToDeleteManyPeople,
          variables: { filter: { id: { in: personIds } } },
        });
        await axiosRequest(graphqlQueryObjDeletePeople, apiToken);

        results.succeeded.push(...personIds);
      } catch (err) {
        console.error('Error in bulk deletion:', err);
        results.failed.push(...personIds);
      }
    }

    if (results.failed.length > 0) {
      return {
        status: 'Partial',
        message: `Successfully deleted ${results.succeeded.length} items, failed to delete ${results.failed.length} items`,
        results,
      };
    }

    return {
      status: 'Success',
      message: `Successfully deleted ${results.succeeded.length} items`,
      results,
    };
  }

  @Post('remove-chats')
  async removeChats(@Req() request: any): Promise<object> {
    return { status: 'Success' };
  }

  @Post('check-human-like')
  @UseGuards(JwtAuthGuard)
  async checkHumanLike(@Req() request: any): Promise<object> {
    console.log('This is the request body', request.body);
    try {
      const apiToken = request.headers.authorization.split(' ')[1];

      const personObj: allDataObjects.PersonNode = await new FilterCandidates(this.workspaceQueryService).getPersonDetailsByPhoneNumber(request.body.phoneNumberFrom, apiToken);
      console.log('Person object receiveed::', personObj);
      const checkHumanLike = await new HumanLikeLLM(this.workspaceQueryService).checkIfResponseMessageSoundsHumanLike(request.body.contentObj, apiToken);
      console.log('checkHumanLike:', checkHumanLike);
      return { status: 'Success' };
    } catch (err) {
      return { status: err };
    }
  }

  @Post('update-whatsapp-delivery-status')
  @UseGuards(JwtAuthGuard)
  async updateDeliveryStatus(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];
    const listOfMessagesIds: string[] = request.body.listOfMessagesIds;
    try {
      for (let id of listOfMessagesIds) {
        const variablesToUpdateDeliveryStatus = {
          idToUpdate: id,
          input: {
            whatsappDeliveryStatus: 'readByRecruiter',
          },
        };
        // debugger
        const graphqlQueryObjForUpdationForDeliveryStatus = JSON.stringify({
          query: allGraphQLQueries.graphqlQueryToUpdateMessageDeliveryStatus,
          variables: variablesToUpdateDeliveryStatus,
        });

        const responseOfDeliveryStatus = await axiosRequest(graphqlQueryObjForUpdationForDeliveryStatus, apiToken);
        console.log('responseOfDeliveryStatus::', responseOfDeliveryStatus?.data);
        // console.log('Res:::', responseOfDeliveryStatus?.data, "for wamid::", responseOfDeliveryStatus?.data);
        console.log('---------------DELIVERY STATUS UPDATE DONE-----------------------');
      }
      return { status: 'Success' };
    } catch (err) {
      return { status: err };
    }
  }
}
