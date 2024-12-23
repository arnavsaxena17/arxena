import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/engine/guards/jwt.auth.guard';
import * as allDataObjects from './services/data-model-objects';
import { FacebookWhatsappChatApi } from './services/whatsapp-api/facebook-whatsapp/facebook-whatsapp-api';
import CandidateEngagementArx from './services/candidate-engagement/check-candidate-engagement';
import { IncomingWhatsappMessages } from './services/whatsapp-api/incoming-messages';
import { FetchAndUpdateCandidatesChatsWhatsapps } from './services/candidate-engagement/update-chat';
import { StageWiseClassification } from './services/llm-agents/get-stage-wise-classification';
import { OpenAIArxMultiStepClient } from './services/llm-agents/arx-multi-step-client';
import { ToolsForAgents } from 'src/engine/core-modules/arx-chat/services/llm-agents/prompting-tool-calling';
import { axiosRequest } from './utils/arx-chat-agent-utils';
import * as allGraphQLQueries from './services/candidate-engagement/graphql-queries-chatbot';
import { shareJDtoCandidate } from './services/llm-agents/tool-calls-processing';
import { checkIfResponseMessageSoundsHumanLike } from './services/llm-agents/human-or-bot-type-response-classification';
import twilio from 'twilio';
import { GmailMessageData } from '../gmail-sender/services/gmail-sender-objects-types';
import { SendEmailFunctionality, EmailTemplates } from './services/candidate-engagement/send-gmail';
import { CalendarEventType } from '../calendar-events/services/calendar-data-objects-types';
import { CalendarEmailService } from './services/candidate-engagement/calendar-email';
import moment from 'moment-timezone';
import axios from 'axios';
import { WhatsappTemplateMessages } from './services/whatsapp-api/facebook-whatsapp/template-messages';
import { EnvironmentService } from 'src/engine/integrations/environment/environment.service';

import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { EmailService } from 'src/engine/integrations/email/email.service';


@Controller('arx-chat')
export class ArxChatEndpoint {

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
  ) {}


  @Post('invoke-chat')
  @UseGuards(JwtAuthGuard)
  async evaluate(@Req() request: any) {
    const apiToken = request.headers.authorization.split(' ')[1];

    const personObj: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).getPersonDetailsByPhoneNumber(request.body.phoneNumberFrom,apiToken);
    const personCandidateNode = personObj?.candidates?.edges[0]?.node;
    // const messagesList = personCandidateNode?.whatsappMessages?.edges;
    const messagesList: allDataObjects.MessageNode[] = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).fetchAllWhatsappMessages(personCandidateNode.id,apiToken);
    // const messagesList: allDataObjects.MessageNode[] = whatsappMessagesEdges.map(edge => edge?.node);

    console.log('Current Messages list:', messagesList);

    let mostRecentMessageArr: allDataObjects.ChatHistoryItem[] = new CandidateEngagementArx(this.workspaceQueryService).getMostRecentMessageFromMessagesList(messagesList);
    if (mostRecentMessageArr?.length > 0) {
      let chatAgent: OpenAIArxMultiStepClient;
      chatAgent = new OpenAIArxMultiStepClient(personObj, this.workspaceQueryService);
      const chatControl = "startChat";
      await chatAgent.createCompletion(mostRecentMessageArr,chatControl,apiToken);
      const whatappUpdateMessageObj:allDataObjects.candidateChatMessageType = await new CandidateEngagementArx(this.workspaceQueryService).updateChatHistoryObjCreateWhatsappMessageObj('ArxChatEndpoint', personObj, mostRecentMessageArr, chatControl,apiToken);
      return whatappUpdateMessageObj;
    }
  }

  @Post('retrieve-chat-response')
  @UseGuards(JwtAuthGuard)
  async retrieve(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    const personObj: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).getPersonDetailsByPhoneNumber(request.body.phoneNumberFrom,apiToken);
    // debugger;

    try {
      const personCandidateNode = personObj?.candidates?.edges[0]?.node;
      // const messagesList = personCandidateNode?.whatsappMessages?.edges;
      const messagesList: allDataObjects.MessageNode[] = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).fetchAllWhatsappMessages(personCandidateNode.id,apiToken);
      let mostRecentMessageArr: allDataObjects.ChatHistoryItem[] = new CandidateEngagementArx(this.workspaceQueryService ).getMostRecentMessageFromMessagesList(messagesList);
      const isChatEnabled: boolean = false;
      if (mostRecentMessageArr?.length > 0) {
        let chatAgent: OpenAIArxMultiStepClient;
        chatAgent = new OpenAIArxMultiStepClient(personObj, this.workspaceQueryService);
        const chatControl = 'startChat';
        mostRecentMessageArr = await chatAgent.createCompletion(mostRecentMessageArr, chatControl, apiToken, isChatEnabled);
        return mostRecentMessageArr;
      }
    } catch (err) {
      return { status: err };
    }
    return { status: 'Failed' };
  }


  @Post('run-chat-completion')
  @UseGuards(JwtAuthGuard)
  async runChatCompletion(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    console.log('JSON.string', JSON.stringify(request.body));
    const personObj: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).getPersonDetailsByPhoneNumber('918411937768',apiToken);
    const messagesList = request.body;
    let chatAgent: OpenAIArxMultiStepClient;
    chatAgent = new OpenAIArxMultiStepClient(personObj,this.workspaceQueryService);
    const chatControl = 'startChat';
    const mostRecentMessageArr = await chatAgent.createCompletion(messagesList,  chatControl,apiToken);
    return mostRecentMessageArr;
  }


  @Post('get-system-prompt')
  @UseGuards(JwtAuthGuard)
  async getSystemPrompt(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    console.log('JSON.string', JSON.stringify(request.body));
    const personObj: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).getPersonDetailsByPhoneNumber(request.body.phoneNumber,apiToken);
    const chatControl = 'startChat';
    const systemPrompt = await new ToolsForAgents(this.workspaceQueryService).getSystemPrompt(personObj, chatControl, apiToken);
    console.log("This is the system prompt::", systemPrompt)
    return {"system_prompt" : systemPrompt};
  }

  @Post('run-stage-prompt')
  @UseGuards(JwtAuthGuard)

  async runStagePrompt(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    console.log('JSON.string', JSON.stringify(request.body));
    const personObj: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).getPersonDetailsByPhoneNumber('918411937768',apiToken);
    const messagesList = request.body;
    let chatAgent = new OpenAIArxMultiStepClient(personObj, this.workspaceQueryService);
    const engagementType = 'engage';
    const processorType = 'stage';
    const stage = new StageWiseClassification(this.workspaceQueryService).getStageOfTheConversation(personObj, messagesList);
    return { stage: stage };
  }

  @Post('add-chat')
  @UseGuards(JwtAuthGuard)
  async addChat(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    const whatsappIncomingMessage: allDataObjects.chatMessageType = {
      phoneNumberFrom: request.body.phoneNumberFrom,
      phoneNumberTo: '918591724917',
      messages: [{ role: 'user', content: request.body.message }],
      messageType: 'string',
    };
    const chatReply = request.body.message;
    console.log('We will first go and get the candiate who sent us the message');
    const candidateProfileData = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).getCandidateInformation(whatsappIncomingMessage,apiToken);
    await new IncomingWhatsappMessages(this.workspaceQueryService).createAndUpdateIncomingCandidateChatMessage( { chatReply: chatReply, whatsappDeliveryStatus: 'delivered', phoneNumberFrom: request.body.phoneNumberFrom, whatsappMessageId: 'receiveIncomingMessagesFromController', }, candidateProfileData,apiToken );
    return { status: 'Success' };
  }

  @Post('start-chat')
  @UseGuards(JwtAuthGuard)
  async startChat(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    const whatsappIncomingMessage: allDataObjects.chatMessageType = {
      phoneNumberFrom: request.body.phoneNumberFrom,
      phoneNumberTo: '918591724917',
      messages: [{ role: 'user', content: 'startChat' }],
      messageType: 'string',
    };
    console.log('This is the Chat Reply:', whatsappIncomingMessage);
    const chatReply = 'startChat';
    const personObj: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).getPersonDetailsByPhoneNumber(request.body.phoneNumberFrom,apiToken);
    console.log('This is the Chat Reply:', chatReply);
    const recruiterProfile = allDataObjects.recruiterProfile;
    console.log('Recruiter profile', recruiterProfile);
    const chatMessages = personObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges;
    let chatHistory = chatMessages[0]?.node?.messageObj || [];
    const chatControl = 'startChat';
    if (chatReply === 'startChat' && chatMessages.length === 0) {
      const SYSTEM_PROMPT = await new ToolsForAgents(this.workspaceQueryService).getSystemPrompt(personObj, chatControl,apiToken);
      chatHistory.push({ role: 'system', content: SYSTEM_PROMPT });
      chatHistory.push({ role: 'user', content: 'startChat' });
    } else {
      chatHistory = personObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.messageObj;
    }

    let whatappUpdateMessageObj: allDataObjects.candidateChatMessageType = {
      candidateProfile: personObj?.candidates?.edges[0]?.node,
      candidateFirstName: personObj?.name?.firstName,
      phoneNumberFrom: personObj?.phone,
      whatsappMessageType : personObj?.candidates?.edges[0]?.node.whatsappProvider || "application03",
      phoneNumberTo: recruiterProfile.phone,
      messages: [{ content: chatReply }],
      messageType: 'candidateMessage',
      messageObj: chatHistory,
      lastEngagementChatControl: chatControl,
      whatsappDeliveryStatus: 'startChatTriggered',
      whatsappMessageId: 'startChat',
    };
    const engagementStatus = await new CandidateEngagementArx(this.workspaceQueryService ).updateCandidateEngagementDataInTable(whatappUpdateMessageObj,apiToken);
    if (engagementStatus?.status === 'success') {
      return { status: engagementStatus?.status };
    } else {
      return { status: 'Failed' };
    }
  }

  @Post('send-chat')
  @UseGuards(JwtAuthGuard)
  async SendChat(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    const messageToSend = request?.body?.messageToSend;
    const personObj: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).getPersonDetailsByPhoneNumber(request.body.phoneNumberTo,apiToken);
    console.log('This is the chat reply:', messageToSend);
    const recruiterProfile = allDataObjects.recruiterProfile;
    console.log('Recruiter profile', recruiterProfile);
    const chatMessages = personObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges;
    let chatHistory = chatMessages[0]?.node?.messageObj || [];
    const chatControl = 'startChat';
    chatHistory = personObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.messageObj;
    let whatappUpdateMessageObj: allDataObjects.candidateChatMessageType = {
      candidateProfile: personObj?.candidates?.edges[0]?.node,
      candidateFirstName: personObj?.name?.firstName,
      phoneNumberFrom: recruiterProfile.phone,
      whatsappMessageType: personObj?.candidates?.edges[0]?.node.whatsappProvider || "application03",
      phoneNumberTo: personObj?.phone,
      messages: [{ content: request?.body?.messageToSend }],
      messageType: 'recruiterMessage',
      messageObj: chatHistory,
      lastEngagementChatControl: chatControl,
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
    await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).createAndUpdateWhatsappMessage(personObj.candidates.edges[0].node, whatappUpdateMessageObj,apiToken);
    return { status: 'success' };
  }

  @Post('get-all-messages-by-candidate-id')
  @UseGuards(JwtAuthGuard)
  async getWhatsappMessagessByCandidateId(@Req() request: any): Promise<object[]> {
    const apiToken = request.headers.authorization.split(' ')[1];

    const candidateId = request.body.candidateId;
    console.log('candidateId to fetch all messages:', candidateId);
    const allWhatsappMessages = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).fetchAllWhatsappMessages(candidateId,apiToken);
    return allWhatsappMessages;
  }
  
  @Post('get-all-messages-by-phone-number')
  @UseGuards(JwtAuthGuard)
  async getAllMessagesByPhoneNumber(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];
    console.log("Going to get all messages by phone Number for :", request.body.phoneNumber);
    const personObj: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).getPersonDetailsByPhoneNumber(request.body.phoneNumber,apiToken);
    const candidateId = personObj?.candidates?.edges[0]?.node?.id;
    const allWhatsappMessages = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).fetchAllWhatsappMessages(candidateId,apiToken);
    const formattedMessages = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).formatChat(allWhatsappMessages);
    console.log("All messages length:", allWhatsappMessages?.length, "for phone number:", request.body.phoneNumber);
    return {"formattedMessages":formattedMessages};
  }
  
  @Post('get-candidate-status-by-phone-number')
  @UseGuards(JwtAuthGuard)
  async getCandidateStatusByPhoneNumber(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    console.log("Going to get candidate status by phone Number for :", request.body.phoneNumber);
    const personObj: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).getPersonDetailsByPhoneNumber(request.body.phoneNumber,apiToken);
    const candidateStatus = personObj?.candidates?.edges[0]?.node?.status || "Unknown";
    console.log("Candidate satus:", candidateStatus, "for phone number:", request.body.phoneNumber);
    return {"status":candidateStatus};
  }
  
  @Post('get-candidate-by-phone-number')
  @UseGuards(JwtAuthGuard)
  async getCandidateIdsByPhoneNumbers(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];
    console.log("Going to get candidate by phone Number for :", request.body.phoneNumber);
    const personObj: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).getPersonDetailsByPhoneNumber(request.body.phoneNumber,apiToken);
    const candidateId = personObj?.candidates?.edges[0]?.node?.id
    console.log('candidateId to fetch all candidateby phonenumber:', candidateId);
    return {"candidateId":candidateId};
  }
  
  @Post('get-candidate-id-by-hiring-naukri-url')
  @UseGuards(JwtAuthGuard)
  async getCandidateIdsByHiringNaukriURL(@Req() request: any): Promise<object> {
    try{
      const apiToken = request.headers.authorization.split(' ')[1];
      console.log("Going to get candidate by hiring-naukri-url :", request?.body?.hiringNaukriUrl);
      const hiringNaukriUrl = request.body.hiringNaukriUrl
      const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToManyCandidateById, variables: { filter: { hiringNaukriUrl: { url: { eq: hiringNaukriUrl } } } } });
      const response = await axiosRequest(graphqlQueryObj,apiToken);
      console.log("Fetched candidate by candidate ID:", response?.data);
      const candidateObj = response?.data?.data?.candidates?.edges[0]?.node;
      console.log("Fetched candidate by candidate OB:", candidateObj);
      const candidateId = candidateObj?.id
      console.log('candidateId to fetch all candidateby hiring-naukri:', candidateId);
      return {candidateId};
    }
    catch(err){
      console.log("Error in fetching candidate by hiring-naukri-url :", err);
      return {candidateId:null};
    }
  }
  
  @Post('get-candidate-id-by-resdex-naukri-url')
  @UseGuards(JwtAuthGuard)
  async getCandidateIdsByResdexNaukriURL(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1];
      console.log("Going to get candidate esdex-naukri-ur :", request.body.resdexNaukriUrl);
      const resdexNaukriUrl = request.body.resdexNaukriUrl;
      const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToManyCandidateById, variables: { filter: { resdexNaukriUrl: {url: { eq: resdexNaukriUrl } }} } });
      const response = await axiosRequest(graphqlQueryObj,apiToken);
      console.log("Fetched candidate by candidate ID:", response?.data);
      const candidateObj = response?.data?.data?.candidates?.edges[0]?.node;
      console.log("Fetched candidate by candidate Obj ID:", candidateObj);
      const candidateId = candidateObj?.id;
      console.log('candidateId to fetch all candidateby resdex-naukri:', candidateId);
      return { candidateId };
    } catch (err) {
      console.log("Error in fetching candidate by resdex-naukri-url:", err);
      return { candidateId: null };
    }
  }
  


  @Post('get-id-by-unique-string-key')
  @UseGuards(JwtAuthGuard)
  async getCandidateByUniqueStringKey(@Req() request: any): Promise<{ candidateId: string | null }> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1];

      const graphqlQuery = JSON.stringify({
        query: allGraphQLQueries.graphqlQueryToFindPeopleByPhoneNumber,
        variables: {
          filter: { uniqueStringKey: { eq: request.body.uniqueStringKey } },
          limit: 1
        }
      });

      const response = await axiosRequest(graphqlQuery,apiToken);
      const candidateId = response?.data?.data?.people?.edges[0]?.node?.candidates?.edges[0]?.node?.id || null;
      return { candidateId };
    } catch (err) {
      console.error('Error in getCandidateByUniqueStringKey:', err);
      return { candidateId: null };
    }
  }


  @Post('count-chats')
  @UseGuards(JwtAuthGuard)
  async countChats(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1];
      const { candidateIds } = request.body;
      console.log("going to count chats")
      // const candidateIds = ['5f9b3b3b-0b3b-4b3b-8b3b-3b0b3b0b3b0b'];
      await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).updateCandidatesWithChatCount(candidateIds, apiToken);
      return { status: 'Success' };
    } catch (err) {
      console.error('Error in countChats:', err);
      return { status: 'Failed', error: err };
    }
  }


  @Post('refresh-chat-counts-by-candidates')
  @UseGuards(JwtAuthGuard)
  async refreshChats(@Req() request: any): Promise<object>  {
    const apiToken = request.headers.authorization.split(' ')[1];
    try {
      const { candidateIds } = request.body;
      console.log("going to refresh chat counts by candidate Ids")
      await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).updateCandidatesWithChatCount(candidateIds ,apiToken);
      return { status: 'Success' };
    } catch (err) {
      console.error('Error in refresh chats:', err);
      return { status: 'Failed', error: err };
    }
  }

  @Post('create-gmail-draft-shortlist')
  @UseGuards(JwtAuthGuard)
  async sendCVsToClient(@Req() request: any): Promise<object>  {
    try {
      const { candidateIds } = request.body;
      const apiToken = request.headers.authorization.split(' ')[1];
      console.log("going to refresh chat counts by candidate Ids",candidateIds)
      const url = process.env.ENV_NODE === 'production' ? 'https://arxena.com/create-gmail-draft-shortlist' : 'http://localhost:5050/create-gmail-draft-shortlist';
      console.log("This is the url:", url);
      console.log("going to create shortlist by candidate Ids",candidateIds)
      const response = await axios.post(url, { candidateIds: candidateIds }, {
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': 'Bearer ' + apiToken }
      });
      console.log("This is the response:", response);
      return { status: 'Success' };
    } catch (err) {
      console.error('Error in refresh chats:', err);
      return { status: 'Failed', error: err };
    }
  }

  @Post('create-shortlist')
  @UseGuards(JwtAuthGuard)
  async createShortlist(@Req() request: any): Promise<object>  {
    try {
      const { candidateIds } = request.body;
      const apiToken = request.headers.authorization.split(' ')[1];
      console.log("going to create shortlist by candidate Ids",candidateIds)
      const url = process.env.ENV_NODE === 'production' ? 'https://arxena.com/create-shortlist' : 'http://localhost:5050/create-shortlist';
      console.log("This is the url:", url);
      console.log("going to create shortlist by candidate Ids",candidateIds)
      const response = await axios.post(url, { candidateIds: candidateIds }, {
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': 'Bearer ' + apiToken }
      });
      console.log("This is the response:", response);

      return { status: 'Success' };
    } catch (err) {
      console.error('Error in refresh chats:', err);
      return { status: 'Failed', error: err };
    }
  }

  @Post('create-shortlist-document')
  @UseGuards(JwtAuthGuard)
  async createShortlistDocument(@Req() request: any): Promise<object>  {
    try {
      const { candidateIds } = request.body;
      const apiToken = request.headers.authorization.split(' ')[1];
      console.log("This is the NODE NEV:", process.env.ENV_NODE);
      const url = process.env.ENV_NODE === 'production' ? 'https://arxena.com/create-shortlist-document' : 'http://localhost:5050/create-shortlist-document';
      console.log("This is the url:", url);
      console.log("going to create shortlist by candidate Ids",candidateIds)
      const response = await axios.post(url, { candidateIds: candidateIds }, {
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': 'Bearer ' + apiToken }
      });
      console.log("This is the response:", response);
      return { status: 'Success' };
    } catch (err) {
      console.error('Error in refresh chats:', err);
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
            [`${type}NaukriUrl`]: { url: { eq: url } }
          }
        }
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
    console.log("Going to get all candidates and chats")
    const apiToken = request?.headers?.authorization?.split(' ')[1];
    console.log("apiToken received:", apiToken);
    const allPeople = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).fetchSpecificPeopleToEngageBasedOnChatControl("allStartedAndStoppedChats",apiToken);
    console.log("All people length:", allPeople?.length)
    return allPeople
  }

  @Get('get-person-chat')
  @UseGuards(JwtAuthGuard)
  async getCandidateAndChat(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];
    const candidateId = request.query.candidateId;
    const person = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).getPersonDetailsByCandidateId(candidateId,apiToken);
    const allPeople = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).fetchSpecificPersonToEngageBasedOnChatControl("allStartedAndStoppedChats", person.id,apiToken);
    console.log("All people length:", allPeople?.length)
    return allPeople
  }
  
  @Post('create-video-interview')
  @UseGuards(JwtAuthGuard)
  async createVideoInterviewForCandidate(@Req() request: any): Promise<object> {
    const candidateId = request.body.candidateId;
    const apiToken = request.headers.authorization.split(' ')[1];
    console.log('candidateId to create video-interview:', candidateId);
    const createVideoInterviewResponse = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).createVideoInterviewForCandidate(candidateId,apiToken);
    console.log("createVideoInterviewResponse:", createVideoInterviewResponse)
    return createVideoInterviewResponse;
  }
  
  
  @Post('create-video-interview-send-to-candidate')
  @UseGuards(JwtAuthGuard)
  async createVideoInterviewSendToCandidate(@Req() request: any): Promise<object> {
    const { workspace } = await this.workspaceQueryService.tokenService.validateToken(request);
    console.log("workspace:", workspace);
    const apiToken = request.headers.authorization.split(' ')[1];
    try {
      const candidateId = request.body.candidateId;
      console.log('candidateId to create video-interview:', candidateId);
      const createVideoInterviewResponse = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).createVideoInterviewForCandidate(candidateId,apiToken);
      const personObj = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).getPersonDetailsByCandidateId(candidateId,apiToken);
      const person = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).getPersonDetailsByPersonId(personObj.id,apiToken);
      console.log("Got person:", person);
      const videoInterviewUrl = createVideoInterviewResponse?.data?.createAIInterviewStatus?.interviewLink?.url;
      console.log("This is the video interview link:", videoInterviewUrl);

      if (videoInterviewUrl) {
      console.log("Going to send email to person:", person);
      const videoInterviewInviteTemplate = await new EmailTemplates().getInterviewInvitationTemplate(person, videoInterviewUrl);
      console.log("allDataObjects.recruiterProfile?.email:", allDataObjects.recruiterProfile?.email);
      const emailData: GmailMessageData = {
        sendEmailFrom: allDataObjects.recruiterProfile?.email,
        sendEmailTo: person?.email,
        subject: 'Video Interview - ' + person?.name?.firstName + '<>' + person?.candidates.edges[0].node.jobs.companies.name,
        message: videoInterviewInviteTemplate,
      };
      console.log("This is the email Data from createVideo Interview Send To Candidate:", emailData);
      const sendVideoInterviewLinkResponse = await new SendEmailFunctionality().sendEmailFunction(emailData, apiToken);
      console.log("sendVideoInterviewLinkResponse::", sendVideoInterviewLinkResponse);
      return sendVideoInterviewLinkResponse || {};
      } else {
      return createVideoInterviewResponse;
      }
    } catch (error) {
      console.error('Error in createVideoInterviewSendToCandidate:', error);
      throw new Error('Failed to create and send video interview');
    }
  }
  
  @Post('send-video-interview-to-candidate')
  @UseGuards(JwtAuthGuard)
  async sendVideoInterviewSendToCandidate(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    const { workspace } = await this.workspaceQueryService.tokenService.validateToken(request);
    console.log("workspace:", workspace);
    try {
      let sendVideoInterviewLinkResponse
      // const videoInterviewUrl = request.body.videoInterviewUrl;
      const candidateId = request?.body?.candidateId;
      // console.log('candidateId to create video-interview:', candidateId);
      // const createVideoInterviewResponse = await new FetchAndUpdateCandidatesChatsWhatsapps().createVideoInterviewForCandidate(candidateId);
      const personObj = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).getPersonDetailsByCandidateId(candidateId,apiToken);
      const person = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).getPersonDetailsByPersonId(personObj.id,apiToken);
      console.log("Got person:", person);
      console.log("interview link",person?.candidates?.edges[0]?.node?.aIInterviewStatus?.edges[0]?.node?.interviewLink?.url);
      console.log("interview link",person?.candidates);
      console.log("interview link",person?.candidates.edges);
      console.log("interview link",person?.candidates?.edges[0]?.node.aIInterviewStatus);
      const videoInterviewUrl = person?.candidates?.edges[0]?.node?.aIInterviewStatus?.edges[0]?.node?.interviewLink?.url;
      console.log("This is the video interview in send-video-interview-to-candidate link:", videoInterviewUrl);

      if (videoInterviewUrl) {
      // console.log("Going to send email to person:", person);
      const videoInterviewInviteTemplate = await new EmailTemplates().getInterviewInvitationTemplate(person, videoInterviewUrl);
      console.log("allDataObjects.recruiterProfile?.email:", allDataObjects.recruiterProfile?.email);
      const emailData: GmailMessageData = {
        sendEmailFrom: allDataObjects.recruiterProfile?.email,
        sendEmailTo: person?.email,
        subject: 'Video Interview - ' + person?.name?.firstName + '<>' + person?.candidates.edges[0].node.jobs.companies.name,
        message: videoInterviewInviteTemplate,
      };
      console.log("This is the email Data sendVideoInterviewSendToCandidate:", emailData);
      sendVideoInterviewLinkResponse = await new SendEmailFunctionality().sendEmailFunction(emailData, apiToken);
      console.log("sendVideoInterviewLinkResponse::", sendVideoInterviewLinkResponse);
      return sendVideoInterviewLinkResponse || {};
      } else {
      return sendVideoInterviewLinkResponse;
      }
    } catch (error) {
      console.error('Error in sendVideoInterviewSendToCandidate:', error);
      throw new Error('Failed to create and send video interview');
    }
  }

  @Post('delete-people-and-candidates-from-candidate-id')
  @UseGuards(JwtAuthGuard)
  async deletePeopleFromCandidateIds(@Req() request: any): Promise<object> {
    const candidateId = request.body.candidateId;
    const apiToken = request.headers.authorization.split(' ')[1];

    console.log('candidateId to create video-interview:', candidateId);
    const graphqlQueryObjToFetchCandidate = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToManyCandidateById, variables: { filter: { id: { eq: candidateId } } } });
    const candidateObjresponse = await axiosRequest(graphqlQueryObjToFetchCandidate,apiToken);
    const candidateObj = candidateObjresponse?.data?.data;
    console.log("candidate objk1:", candidateObj);
    
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
    console.log("Person ID:", personId);

    const graphqlQueryObj = JSON.stringify({
      query: allGraphQLQueries.graphqlMutationToDeleteManyCandidates,
      variables: { filter: { id: { in: [candidateId] } } },
    });

    console.log("Going to try and delete candidate");
    try {
      const response = await axiosRequest(graphqlQueryObj,apiToken);
      console.log('Deleted candidate:', response.data);
    } catch (err) {
      console.log('Error deleting candidate:', err.response?.data || err.message);
      return { status: 'Failed', message: 'Error deleting candidate' };
    }
    const graphqlQueryObjToDeletePerson = JSON.stringify({
      query: allGraphQLQueries.graphqlMutationToDeleteManyPeople,
      variables: { filter: { id: { in: [personId] } } },
    });
    console.log("Going to try and delete person");
    try {
      const response = await axiosRequest(graphqlQueryObjToDeletePerson,apiToken);
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
    const graphqlQueryObjToFetchPerson = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToFindPeopleByPhoneNumber, variables: { filter: { id: { eq: personId } } } });
    const personresponse = await axiosRequest(graphqlQueryObjToFetchPerson,apiToken);
    const personObj = personresponse?.data?.data;
    console.log("personresponse objk1:", personObj);
    const personNode = personresponse?.data?.data?.people?.edges[0]?.node;
    if (!personNode) {
      console.log('Person not found');
      return { status: 'Failed', message: 'Candidate not found' };
    }
    const candidateId = personNode?.candidates?.edges[0].node.id;
    console.log("personNode:", personNode);
    console.log("candidateId:", candidateId);
    if (!candidateId) {
      console.log('candidateId ID not found');
      return { status: 'Failed', message: 'candidateId ID not found' };
    }
    console.log("candidateId ID:", candidateId);
    const graphqlQueryObj = JSON.stringify({
      query: allGraphQLQueries.graphqlMutationToDeleteManyCandidates,
      variables: { filter: { id: { in: [candidateId] } } },
    });
    console.log("Going to try and delete candidate");
    try {
      const response = await axiosRequest(graphqlQueryObj,apiToken);
      console.log('Deleted candidate:', response.data);
    } catch (err) {
      console.log('Error deleting candidate:', err.response?.data || err.message);
      return { status: 'Failed', message: 'Error deleting candidate' };
    }
    const graphqlQueryObjToDeletePerson = JSON.stringify({
      query: allGraphQLQueries.graphqlMutationToDeleteManyPeople,
      variables: { filter: { id: { in: [personId] } } },
    });
    console.log("Going to try and delete person");
    try {
      const response = await axiosRequest(graphqlQueryObjToDeletePerson,apiToken);
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
  const results: { succeeded: string[], failed: string[] } = {
    succeeded: [],
    failed: []
  };

  if (candidateIds?.length) {
    // First fetch all candidate information to get associated person IDs
    const graphqlQueryObjToFetchCandidates = JSON.stringify({
      query: allGraphQLQueries.graphqlQueryToManyCandidateById,
      variables: { filter: { id: { in: candidateIds } } }
    });

    const candidatesResponse = await axiosRequest(graphqlQueryObjToFetchCandidates,apiToken);
    const candidateNodes = candidatesResponse?.data?.data?.candidates?.edges || [];
    
    // Collect all person IDs associated with these candidates
    const personIdsFromCandidates = candidateNodes
      .map(edge => edge.node?.people?.id)
      .filter(id => id);

    // Delete candidates in bulk
    try {
      const graphqlQueryObjDeleteCandidates = JSON.stringify({
        query: allGraphQLQueries.graphqlMutationToDeleteManyCandidates,
        variables: { filter: { id: { in: candidateIds } } }
      });
      await axiosRequest(graphqlQueryObjDeleteCandidates,apiToken);
      
      // Delete associated people in bulk
      const graphqlQueryObjDeletePeople = JSON.stringify({
        query: allGraphQLQueries.graphqlMutationToDeleteManyPeople,
        variables: { filter: { id: { in: personIdsFromCandidates } } }
      });
      await axiosRequest(graphqlQueryObjDeletePeople,apiToken);
      
      results.succeeded.push(...candidateIds);
    } catch (err) {
      console.error('Error in bulk deletion:', err);
      results.failed.push(...candidateIds);
    }
  }

  if (personIds?.length) {
    // First fetch all person information to get associated candidate IDs
    const graphqlQueryObjToFetchPeople = JSON.stringify({
      query: allGraphQLQueries.graphqlQueryToFindPeopleByPhoneNumber,
      variables: { filter: { id: { in: personIds } } }
    });

    const peopleResponse = await axiosRequest(graphqlQueryObjToFetchPeople,apiToken);
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
        variables: { filter: { id: { in: candidateIdsFromPeople } } }
      });
      await axiosRequest(graphqlQueryObjDeleteCandidates,apiToken);
      
      // Then delete people
      const graphqlQueryObjDeletePeople = JSON.stringify({
        query: allGraphQLQueries.graphqlMutationToDeleteManyPeople,
        variables: { filter: { id: { in: personIds } } }
      });
      await axiosRequest(graphqlQueryObjDeletePeople,apiToken);
      
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
      results
    };
  }

  return {
    status: 'Success',
    message: `Successfully deleted ${results.succeeded.length} items`,
    results
  };
}



  @Post('remove-chats')
  async removeChats(@Req() request: any): Promise<object> {
    return { status: 'Success' };
  }

  @Post('create-interview-videos')
  @UseGuards(JwtAuthGuard)

  async createInterviewVideos(@Req() request: any): Promise<object> {
    console.log("This is the request body:", request.body);
    const jobId = request.body.jobId;
    const apiToken = request.headers.authorization.split(' ')[1];

    console.log("This is the jobId:", jobId);


    console.log("This is the NODE NEV:", process.env.ENV_NODE);
    const url = process.env.ENV_NODE === 'production' ? 'https://arxena.com/create-interview-videos' : 'http://localhost:5050/create-interview-videos';
    console.log("This is the url:", url);
    try {
      const response = await axios.post(url, { jobId:jobId }, {
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': 'Bearer ' + apiToken }, 
        timeout: 10000,
        validateStatus: (status) => status >= 200 && status < 500,
        proxy: false,
        family: 4,
      }
      );
      console.log('Response from /create-interview-videos:', response.data);
    } catch (error) {
      console.error('Error sending request to /create-interview-videos:', error);
    }
    return { status: 'Success' };
  }

  @Post('send-jd-from-frontend')
  @UseGuards(JwtAuthGuard)
  async uploadAttachment(@Req() request: any): Promise<object> {
    console.log('This is the request body', request.body);
    const apiToken = request.headers.authorization.split(' ')[1];

    const personObj: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).getPersonDetailsByPhoneNumber(request.body.phoneNumberTo,apiToken);
    try {
      await shareJDtoCandidate(personObj, 'startChat',  apiToken);
      return { status: 'Success' };
    } catch (err) {
      return { status: err };
    }
  }

  @Post('check-human-like')
  @UseGuards(JwtAuthGuard)
  async checkHumanLike(@Req() request: any): Promise<object> {
    console.log('This is the request body', request.body);
    try {
      const apiToken = request.headers.authorization.split(' ')[1];

      const personObj: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).getPersonDetailsByPhoneNumber(request.body.phoneNumberFrom,apiToken);
      console.log("Person object receiveed::", personObj)
      const checkHumanLike = await checkIfResponseMessageSoundsHumanLike(request.body.contentObj);
      console.log("checkHumanLike:", checkHumanLike)
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

        const responseOfDeliveryStatus = await axiosRequest(graphqlQueryObjForUpdationForDeliveryStatus,apiToken);
        console.log("responseOfDeliveryStatus::", responseOfDeliveryStatus?.data)
        // console.log('Res:::', responseOfDeliveryStatus?.data, "for wamid::", responseOfDeliveryStatus?.data);
        console.log('---------------DELIVERY STATUS UPDATE DONE-----------------------');
      }
      return { status: 'Success' };
    } catch (err) {
      return { status: err };
    }
  }
}




@Controller('webhook')
export class WhatsappWebhook {
  
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,  
    private readonly environmentService: EnvironmentService,

  ) {}



  @Get()
  findAll(@Req() request: any, @Res() response: any) {
    console.log('-------------- New Request GET --------------');
    var mode = request.query['hub.mode'];
    var token = request.query['hub.verify_token'];
    var challenge = request.query['hub.challenge'];
    console.log('Mode:', mode);
    console.log('token:', token);
    console.log('challenge:', challenge);
    console.log('-------------- New Request GET --------------');
    console.log('Headers:' + JSON.stringify(request.headers, null, 3));
    console.log('Body:' + JSON.stringify(request.body, null, 3));

    // Check if a token and mode is in the query string of the request
    if (mode && token) {
      // Check the mode and token sent is correct
      if (mode === 'subscribe' && token === '12345') {
        // Respond with the challenge token from the request
        console.log('WEBHOOK_VERIFIED');
        response.status(200).send(challenge);
      } else {
        console.log('Responding with 403 Forbidden');
        // Respond with '403 Forbidden' if verify tokens do not match
        response.sendStatus(403);
      }
    } else {
      console.log('Replying Thank you.');
      response.json({ message: 'Thank you for the message' });
    }
  }

  @Post()
  async create(@Req() request: any, @Res() response: any) {
    console.log('-------------- New Request POST --------------');
    // console.log('Headers:' + JSON.stringify(request.headers, null, 3));
    // console.log('Body:' + JSON.stringify(request.body, null, 3));
    // const apiToken = request.headers.authorization.split(' ')[1];

    const requestBody = request.body;
    try {
      await new IncomingWhatsappMessages(this.workspaceQueryService).receiveIncomingMessagesFromFacebook(requestBody);
    } catch (error) {
      // Handle error
    }
    response.sendStatus(200);
  }

}

@Controller('whatsapp-controller')
export class WhatsappControllers {

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService
  ) {}
  @Post('uploadFile')
  async uploadFileToFBWAAPI(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    console.log('upload file to whatsapp api');
    const requestBody = request?.body;
    const filePath = requestBody?.filePath;
    const response = await new FacebookWhatsappChatApi(this.workspaceQueryService).uploadFileToWhatsAppUsingControllerApi(filePath, apiToken);
    return response || {}; // Return an empty object if the response is undefined
  }
}



@Controller('google-mail-calendar-contacts')
export class GoogleControllers {

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly emailService: EmailService
  ) {}



  @Post('send-test-email-using-local-email-service')
  async testEmail() {
    await this.emailService.send({
      from: '"Arnav Saxena" <arnav@arxena.com>',
      to: 'test@example.com',
      subject: 'Test Email',
      text: 'This is a test email',
      html: '<h1>Test Email</h1><p>This is a test email</p>',
    });
    return { message: 'Email sent' };
  }




  @Post('send-mail')
  @UseGuards(JwtAuthGuard)
  async sendEmail(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    const person: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).getPersonDetailsByPhoneNumber(request.body.phoneNumber,apiToken);
    console.log("allDataObjects.recruiterProfile?.email:", allDataObjects.recruiterProfile?.email)
    const emailData: GmailMessageData = {
      sendEmailFrom: allDataObjects.recruiterProfile?.email,
      sendEmailTo: person?.email,
      subject: request.body?.subject || 'Email from the recruiter',
      message: request.body?.message || 'This is a test email',
    };
    console.log("This is the email Data in plain send meial:", emailData)
    const response = await new SendEmailFunctionality().sendEmailFunction(emailData, apiToken);
    console.log("This is the response:", response)
    return response || {}; // Return an empty object if the response is undefined
  }

  @Post('send-mail-with-attachment')
  @UseGuards(JwtAuthGuard)
  async sendEmailWithAttachment(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    const person: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).getPersonDetailsByPhoneNumber(request.body.phoneNumber,apiToken);
    
    const emailData: GmailMessageData = {
      sendEmailFrom: allDataObjects.recruiterProfile?.email,
      sendEmailTo: person?.email,
      subject: request.body?.subject || 'Email from the recruiter',
      message: request.body?.message || 'This is a test email',
      attachments: request.body.attachments || [],
    };
    console.log("This si the email data to send attachemnts:", emailData)

    const response = await new SendEmailFunctionality().sendEmailWithAttachmentFunction(emailData, apiToken);
    return response || {};
  }
  @Post('save-draft-mail-with-attachment')
  @UseGuards(JwtAuthGuard)
  async saveDraftEmailWithAttachments (@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];
    const person: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).getPersonDetailsByPhoneNumber(request.body.phoneNumber,apiToken);
    const emailData: GmailMessageData = {
      sendEmailFrom: allDataObjects.recruiterProfile?.email,
      sendEmailTo: person?.email,
      subject: request.body?.subject || 'Email from the recruiter',
      message: request.body?.message || 'This is a test email',
      attachments: request.body.attachments || [],
    };
    console.log("This si the email data to save drafts:", emailData)
    const response = await new SendEmailFunctionality().saveDraftEmailWithAttachmentsFunction(emailData, apiToken);
    return response || {};
  }


  @Post('send-calendar-invite')
  @UseGuards(JwtAuthGuard)
  async sendCalendarInvite(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    const person: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).getPersonDetailsByPhoneNumber(request.body.phoneNumber,apiToken);
    const gptInputs = request.body;

    const convertToUTC = (dateTime: string, timeZone: string): string => {
      if (!dateTime) {
          // If no datetime provided, use tomorrow's date
          return moment.tz(timeZone).add(1, 'day').utc().format();
      }
      return moment.tz(dateTime, timeZone).utc().format();
    };
    const timeZone = gptInputs?.timeZone || "Asia/Kolkata";
    // Convert start and end times to UTC
    const defaultStart = moment.tz(timeZone).add(1, 'day').hour(13).minute(30);
    const defaultEnd = moment(defaultStart).add(2, 'hours');
    console.log("This is default start", defaultStart.format('YYYY-MM-DDTHH:mm:ss'))
    console.log("This is default end", defaultEnd.format('YYYY-MM-DDTHH:mm:ss'))
    

    const startTimeUTC = convertToUTC(gptInputs?.startDateTime || defaultStart.format('YYYY-MM-DDTHH:mm:ss'), timeZone);
    const endTimeUTC = convertToUTC(gptInputs?.endDateTime || defaultEnd.format('YYYY-MM-DDTHH:mm:ss'), timeZone);

    console.log("This is the start time:", startTimeUTC)
    console.log("This is the endTimeUTC:", endTimeUTC)


    console.log('Function Called: scheduleMeeting');
    const calendarEventObj: CalendarEventType = {
      summary: person.name.firstName + ' ' + person.name.lastName + ' <> ' + allDataObjects.recruiterProfile.first_name + ' ' + allDataObjects.recruiterProfile.last_name ||  gptInputs?.summary,
      typeOfMeeting: gptInputs?.typeOfMeeting || 'Virtual',
      location: gptInputs?.location || 'Google Meet',
      description: gptInputs?.description || 'This meeting is scheduled to discuss the role and the company.',
      start: { 
        dateTime: startTimeUTC,
        timeZone: timeZone
      },
      end: { 
        dateTime: endTimeUTC,
        timeZone: timeZone
      },
      attendees: [{ email: person.email }, { email: allDataObjects.recruiterProfile.email }],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'email', minutes: 15 },
          { method: 'popup', minutes: 10 },
        ],
      },
    };
    const response = await new CalendarEmailService().createNewCalendarEvent(calendarEventObj, apiToken);
    console.log("Response data:", (response as any)?.data)
    return { status: 'scheduleMeeting the candidate meeting.' };
  }
}



@Controller('twilio')
export class TwilioControllers {

  @Post('sendMessage')
  @UseGuards(JwtAuthGuard)
  async sendMessage(@Req() request: any): Promise<object> {
    console.log('going to send twilio message');
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure

    const template =
      "Hi {1},\n\nI'm {2}, {3} at {4}, a {5}.\n\nI'm hiring for a {6} role based out of {7} and got your application my job posting. I believe this might be a good fit.\n\nWanted to speak to you in regards your interests in our new role. Would you be available for a short call sometime tomorrow?";

    // Variables to replace placeholders
    const variables = {
      1: 'Anjali', // {1}
      2: 'Arnav', // {2}
      3: 'Director', // {3}
      4: 'Arxena', // {4}
      5: 'US based recruitment agency', // {5}
      6: 'HR Head', // {6}
      7: 'Surat', // {7}
    };

    const recruitingTemplate = 'Hi {{1}}, are you interested in a new job?';
    const recruitingTemplate2 = 'Hello, are you interested in a new job?';
    const recruitingVariables = {
      1: 'Rahul',
    };

    // Replace placeholders with actual values
    let body = template;
    let replacementVariables = variables;
    for (const [key, value] of Object.entries(replacementVariables)) {
      body = body.replace(`{${key}}`, value);
    }
    console.log('This is body', body);

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const client = twilio(accountSid, authToken);
    console.log('Client created');
    const message = await client.messages.create({
      body: body,
      from: 'whatsapp:+15153163273',
      to: 'whatsapp:+919601277382',
    });
    console.log('This is mesage body:', message.body);

    return message;
  }

  @Post('testMessage')
  @UseGuards(JwtAuthGuard)
  async testMessage(@Req() request: any): Promise<any> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const client = require('twilio')(accountSid, authToken);

    client.messages.create({
        body: 'Hi, would you be keen on a new role?',
        from: 'whatsapp:+15153163273',
        to: 'whatsapp:+918411937769',
      }).then(message => console.log(message.sid)).done();
  }
  
}











@Controller('whatsapp-test')
export class WhatsappTestAPI {

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService
  ) {}



  @Post('send-template-message')
  @UseGuards(JwtAuthGuard)
  async sendTemplateMessage(@Req() request: any): Promise<object> {

    const requestBody = request.body as any;
    const apiToken = request.headers.authorization.split(' ')[1];

    const personObj: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).getPersonDetailsByPhoneNumber(requestBody.phoneNumberTo,apiToken);
    console.log("This is the process.env.SERVER_BASE_URL:",process.env.SERVER_BASE_URL)
    const sendTemplateMessageObj = {
      recipient: personObj.phone.replace('+', ''),
      template_name: requestBody.templateName,
      candidateFirstName: personObj.name.firstName,
      recruiterName: allDataObjects.recruiterProfile.name,
      recruiterFirstName: allDataObjects.recruiterProfile.name.split(' ')[0],
      recruiterJobTitle: allDataObjects.recruiterProfile.job_title,
      recruiterCompanyName: allDataObjects.recruiterProfile.job_company_name,
      recruiterCompanyDescription: allDataObjects.recruiterProfile.company_description_oneliner,
      jobPositionName: personObj?.candidates?.edges[0]?.node?.jobs?.name,
      companyName: personObj?.candidates?.edges[0]?.node?.jobs?.companies?.name,
      descriptionOneliner:personObj?.candidates?.edges[0]?.node?.jobs?.companies?.descriptionOneliner,
      jobCode: personObj?.candidates?.edges[0]?.node?.jobs?.jobCode,
      jobLocation: personObj?.candidates?.edges[0]?.node?.jobs?.jobLocation,
      // videoInterviewLink: process.env.SERVER_BASE_URL+personObj?.candidates?.edges[0]?.node?.aIInterviewStatus?.edges[0].node.interviewLink.url,
      videoInterviewLink: process.env.SERVER_BASE_URL+personObj?.candidates?.edges[0]?.node?.aIInterviewStatus?.edges[0]?.node?.interviewLink?.url || "",
    };
    console.log("This is the sendTemplateMessageObj:", sendTemplateMessageObj)

    const response = await new FacebookWhatsappChatApi(this.workspaceQueryService).sendWhatsappUtilityMessage(sendTemplateMessageObj,apiToken);
    let utilityMessage = await new WhatsappTemplateMessages().getUpdatedUtilityMessageObj(sendTemplateMessageObj);
    const whatsappTemplateMessageSent = await new WhatsappTemplateMessages().generateMessage(requestBody.templateName, sendTemplateMessageObj);
    console.log("This is the mesasge obj:", personObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges)
    const mostRecentMessageArr: allDataObjects.ChatHistoryItem[] = personObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.messageObj;
    console.log("This is the mostRecentMessageArr:", mostRecentMessageArr)
    const chatControl = personObj?.candidates?.edges[0].node.lastEngagementChatControl;
    mostRecentMessageArr.push({ role: 'user', content: whatsappTemplateMessageSent });
    const whatappUpdateMessageObj:allDataObjects.candidateChatMessageType = await new CandidateEngagementArx(this.workspaceQueryService).updateChatHistoryObjCreateWhatsappMessageObj( 'success', personObj, mostRecentMessageArr, chatControl,apiToken);
    await new CandidateEngagementArx(this.workspaceQueryService).updateCandidateEngagementDataInTable(whatappUpdateMessageObj,apiToken);
    console.log("This is ther esponse:", response.data)
    return { status: 'success' };
  }


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
  @Post('uploadFile')
  @UseGuards(JwtAuthGuard)
  async uploadFileToFBWAAPI(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    console.log('upload file to whatsapp api');
    const requestBody = request?.body;
    const filePath = requestBody?.filePath;
    const chatControl = 'startChat';
    const response = await new FacebookWhatsappChatApi(this.workspaceQueryService).uploadFileToWhatsApp(filePath, chatControl,apiToken);
    return response || {}; 
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

  @Post('sendFile')
  @UseGuards(JwtAuthGuard)
  async uploadAndSendFileToFBWAAPIUser(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];
    const sendFileObj = request.body;
    const chatControl = 'startChat';
    new FacebookWhatsappChatApi(this.workspaceQueryService).uploadAndSendFileToWhatsApp(sendFileObj, chatControl,  apiToken);
    return { status: 'success' };
  }

  @Post('downloadAttachment')
  @UseGuards(JwtAuthGuard)
  async downloadFileToFBWAAPIUser(@Req() request: Request): Promise<object> {
    const downloadAttachmentMessageObj = request.body;
    return { status: 'success' };
  }
}
