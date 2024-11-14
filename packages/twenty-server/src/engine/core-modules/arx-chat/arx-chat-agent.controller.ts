import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/engine/guards/jwt.auth.guard';
import * as allDataObjects from './services/data-model-objects';
import { FacebookWhatsappChatApi } from './services/whatsapp-api/facebook-whatsapp/facebook-whatsapp-api';
import CandidateEngagementArx from './services/candidate-engagement/check-candidate-engagement';
import { IncomingWhatsappMessages } from './services/whatsapp-api/incoming-messages';
import { FetchAndUpdateCandidatesChatsWhatsapps } from './services/candidate-engagement/update-chat';
import { getStageOfTheConversation } from './services/llm-agents/get-stage-wise-classification';
import { OpenAIArxMultiStepClient } from './services/llm-agents/arx-multi-step-client';
import { ToolsForAgents } from 'src/engine/core-modules/arx-chat/services/llm-agents/prompting-tool-calling';
import { axiosRequest } from './utils/arx-chat-agent-utils';
import * as allGraphQLQueries from './services/candidate-engagement/graphql-queries-chatbot';
import { shareJDtoCandidate } from './services/llm-agents/tool-calls-processing';
import { checkIfResponseMessageSoundsHumanLike } from './services/llm-agents/human-or-bot-type-response-classification';
import twilio from 'twilio';
import { GmailMessageData } from '../gmail-sender/services/gmail-sender-objects-types';
import { SendEmailFunctionality } from './services/candidate-engagement/send-gmail';
import { CalendarEventType } from '../calendar-events/services/calendar-data-objects-types';
import { CalendarEmailService } from './services/candidate-engagement/calendar-email';
import moment from 'moment-timezone';
import axios from 'axios';
import { WhatsappTemplateMessages } from './services/whatsapp-api/facebook-whatsapp/template-messages';

@Controller('updateChat')
export class UpdateChatEndpoint {
  @Post()
  async create(@Req() request: Request): Promise<object> {
    console.log('These are the request body', request.body);
    const userMessageBody: allDataObjects.ChatRequestBody | null = request?.body as allDataObjects.ChatRequestBody | null; // Type assertion
    console.log('This is the user message', userMessageBody);
    const chatControl = 'startChat';

    if (userMessageBody !== null) {
      const { phoneNumberFrom, phoneNumberTo, messages } = userMessageBody;
      const userMessage: allDataObjects.candidateChatMessageType = {
        phoneNumberFrom,
        phoneNumberTo,
        whatsappMessageType: 'application03',
        lastEngagementChatControl: chatControl,
        messages: [{ text: userMessageBody.messages }],
        candidateFirstName: '',
        messageObj: [],
        messageType: 'candidateMessage',
        candidateProfile: allDataObjects.emptyCandidateProfileObj,
        whatsappDeliveryStatus: 'candidateMessageReceived',
        whatsappMessageId: 'UpdateChatEndpoint',
      };
      const statusMessage = { status: 'updateStatus' };
      return statusMessage;
    } else {
      return { status: 'Failed' };
    }
  }
}

@Controller('arx-chat')
export class ArxChatEndpoint {
  @Post('invoke-chat')
  async evaluate(@Req() request: any) {
    const personObj: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps().getPersonDetailsByPhoneNumber(request.body.phoneNumberFrom);
    const personCandidateNode = personObj?.candidates?.edges[0]?.node;
    // const messagesList = personCandidateNode?.whatsappMessages?.edges;
    const messagesList: allDataObjects.MessageNode[] = await new FetchAndUpdateCandidatesChatsWhatsapps().fetchAllWhatsappMessages(personCandidateNode.id);
    // const messagesList: allDataObjects.MessageNode[] = whatsappMessagesEdges.map(edge => edge?.node);

    console.log('Current Messages list:', messagesList);

    let mostRecentMessageArr: allDataObjects.ChatHistoryItem[] = new CandidateEngagementArx().getMostRecentMessageFromMessagesList(messagesList);
    if (mostRecentMessageArr?.length > 0) {
      let chatAgent: OpenAIArxMultiStepClient;
      chatAgent = new OpenAIArxMultiStepClient(personObj);
      const chatControl = "startChat";
      await chatAgent.createCompletion(mostRecentMessageArr,chatControl);
      const whatappUpdateMessageObj:allDataObjects.candidateChatMessageType = await new CandidateEngagementArx().updateChatHistoryObjCreateWhatsappMessageObj('ArxChatEndpoint', personObj, mostRecentMessageArr, chatControl);
      return whatappUpdateMessageObj;
    }
  }

  @Post('retrieve-chat-response')
  async retrieve(@Req() request: any): Promise<object> {
    const personObj: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps().getPersonDetailsByPhoneNumber(request.body.phoneNumberFrom);
    // debugger;
    try {
      const personCandidateNode = personObj?.candidates?.edges[0]?.node;
      // const messagesList = personCandidateNode?.whatsappMessages?.edges;
      const messagesList: allDataObjects.MessageNode[] = await new FetchAndUpdateCandidatesChatsWhatsapps().fetchAllWhatsappMessages(personCandidateNode.id);
      let mostRecentMessageArr: allDataObjects.ChatHistoryItem[] = new CandidateEngagementArx().getMostRecentMessageFromMessagesList(messagesList);
      const isChatEnabled: boolean = false;
      if (mostRecentMessageArr?.length > 0) {
        let chatAgent: OpenAIArxMultiStepClient;
        chatAgent = new OpenAIArxMultiStepClient(personObj);
        const chatControl = 'startChat';
        mostRecentMessageArr = await chatAgent.createCompletion(mostRecentMessageArr, chatControl, isChatEnabled);
        return mostRecentMessageArr;
      }
    } catch (err) {
      return { status: err };
    }
    return { status: 'Failed' };
  }

  @Post('run-chat-completion')
  async runChatCompletion(@Req() request: any): Promise<object> {
    console.log('JSON.string', JSON.stringify(request.body));
    const personObj: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps().getPersonDetailsByPhoneNumber('918411937768');
    const messagesList = request.body;
    let chatAgent: OpenAIArxMultiStepClient;
    chatAgent = new OpenAIArxMultiStepClient(personObj);
    const chatControl = 'startChat';
    const mostRecentMessageArr = await chatAgent.createCompletion(messagesList, chatControl);
    return mostRecentMessageArr;
  }


  @Post('get-system-prompt')
  async getSystemPrompt(@Req() request: any): Promise<object> {
    console.log('JSON.string', JSON.stringify(request.body));
    const personObj: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps().getPersonDetailsByPhoneNumber(request.body.phoneNumber);
    const chatControl = 'startChat';
    const systemPrompt = await new ToolsForAgents().getSystemPrompt(personObj, chatControl)
    console.log("This is the system prompt::", systemPrompt)
    return {"system_prompt":systemPrompt};
  }

  @Post('run-stage-prompt')
  async runStagePrompt(@Req() request: any): Promise<object> {
    console.log('JSON.string', JSON.stringify(request.body));
    const personObj: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps().getPersonDetailsByPhoneNumber('918411937768');
    const messagesList = request.body;
    let chatAgent = new OpenAIArxMultiStepClient(personObj);
    const engagementType = 'engage';
    const processorType = 'stage';
    const stage = getStageOfTheConversation(personObj, messagesList);
    return { stage: stage };
  }

  @Post('add-chat')
  async addChat(@Req() request: any): Promise<object> {
    const whatsappIncomingMessage: allDataObjects.chatMessageType = {
      phoneNumberFrom: request.body.phoneNumberFrom,
      phoneNumberTo: '918591724917',
      messages: [{ role: 'user', content: request.body.message }],
      messageType: 'string',
    };
    const chatReply = request.body.message;
    console.log('We will first go and get the candiate who sent us the message');
    const candidateProfileData = await new FetchAndUpdateCandidatesChatsWhatsapps().getCandidateInformation(whatsappIncomingMessage);
    await new IncomingWhatsappMessages().createAndUpdateIncomingCandidateChatMessage( { chatReply: chatReply, whatsappDeliveryStatus: 'delivered', phoneNumberFrom: request.body.phoneNumberFrom, whatsappMessageId: 'receiveIncomingMessagesFromController', }, candidateProfileData );
    return { status: 'Success' };
  }

  @Post('start-chat')
  async startChat(@Req() request: any): Promise<object> {
    const whatsappIncomingMessage: allDataObjects.chatMessageType = {
      phoneNumberFrom: request.body.phoneNumberFrom,
      phoneNumberTo: '918591724917',
      messages: [{ role: 'user', content: 'startChat' }],
      messageType: 'string',
    };
    console.log('This is the chat reply:', whatsappIncomingMessage);
    const chatReply = 'startChat';
    const personObj: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps().getPersonDetailsByPhoneNumber(request.body.phoneNumberFrom);
    console.log('This is the chat reply:', chatReply);
    const recruiterProfile = allDataObjects.recruiterProfile;
    console.log('Recruiter profile', recruiterProfile);
    const chatMessages = personObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges;
    let chatHistory = chatMessages[0]?.node?.messageObj || [];
    const chatControl = 'startChat';
    if (chatReply === 'startChat' && chatMessages.length === 0) {
      const SYSTEM_PROMPT = await new ToolsForAgents().getSystemPrompt(personObj, chatControl);
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
    const engagementStatus = await new CandidateEngagementArx().updateCandidateEngagementDataInTable(whatappUpdateMessageObj);
    if (engagementStatus?.status === 'success') {
      return { status: engagementStatus?.status };
    } else {
      return { status: 'Failed' };
    }
  }

  @Post('send-chat')
  @UseGuards(JwtAuthGuard)
  async SendChat(@Req() request: any): Promise<object> {
    const messageToSend = request?.body?.messageToSend;
    const personObj: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps().getPersonDetailsByPhoneNumber(request.body.phoneNumberTo);
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
    const sendMessageResponse = await new FacebookWhatsappChatApi().sendWhatsappTextMessage(messageObj);
    whatappUpdateMessageObj.whatsappMessageId = sendMessageResponse?.data?.messages[0]?.id;
    whatappUpdateMessageObj.whatsappDeliveryStatus = 'sent';
    await new FetchAndUpdateCandidatesChatsWhatsapps().createAndUpdateWhatsappMessage(personObj.candidates.edges[0].node, whatappUpdateMessageObj);
    return { status: 'success' };
  }

  @Post('get-all-messages-by-candidate-id')
  @UseGuards(JwtAuthGuard)
  async getWhatsappMessagessByCandidateId(@Req() request: any): Promise<object[]> {
    const candidateId = request.body.candidateId;
    console.log('candidateId to fetch all messages:', candidateId);
    const allWhatsappMessages = await new FetchAndUpdateCandidatesChatsWhatsapps().fetchAllWhatsappMessages(candidateId);
    return allWhatsappMessages;
  }
  
  @Post('get-all-messages-by-phone-number')
  @UseGuards(JwtAuthGuard)
  async getAllMessagesByPhoneNumber(@Req() request: any): Promise<object> {
    console.log("Going to get all messages by phone Number for :", request.body.phoneNumber);
    const personObj: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps().getPersonDetailsByPhoneNumber(request.body.phoneNumber);
    const candidateId = personObj?.candidates?.edges[0]?.node?.id;
    const allWhatsappMessages = await new FetchAndUpdateCandidatesChatsWhatsapps().fetchAllWhatsappMessages(candidateId);
    const formattedMessages = await new FetchAndUpdateCandidatesChatsWhatsapps().formatChat(allWhatsappMessages);
    console.log("All messages length:", allWhatsappMessages?.length, "for phone number:", request.body.phoneNumber);
    return {"formattedMessages":formattedMessages};
  }
  
  @Post('get-candidate-status-by-phone-number')
  @UseGuards(JwtAuthGuard)
  async getCandidateStatusByPhoneNumber(@Req() request: any): Promise<object> {
    console.log("Going to get candidate status by phone Number for :", request.body.phoneNumber);
    const personObj: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps().getPersonDetailsByPhoneNumber(request.body.phoneNumber);
    const candidateStatus = personObj?.candidates?.edges[0]?.node?.status || "Unknown";
    console.log("Candidate satus:", candidateStatus, "for phone number:", request.body.phoneNumber);
    return {"status":candidateStatus};
  }
  
  @Post('get-candidate-by-phone-number')
  @UseGuards(JwtAuthGuard)
  async getCandidateIdsByPhoneNumbers(@Req() request: any): Promise<object> {
    console.log("Going to get candidate by phone Number for :", request.body.phoneNumber);
    const personObj: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps().getPersonDetailsByPhoneNumber(request.body.phoneNumber);
    const candidateId = personObj?.candidates?.edges[0]?.node?.id
    console.log('candidateId to fetch all candidateby phonenumber:', candidateId);
    return {"candidateId":candidateId};
  }
  
  @Post('get-candidate-id-by-hiring-naukri-url')
  @UseGuards(JwtAuthGuard)
  async getCandidateIdsByHiringNaukriURL(@Req() request: any): Promise<object> {
    try{

      console.log("Going to get candidate by hiring-naukri-url :", request?.body?.hiringNaukriUrl);
      const hiringNaukriUrl = request.body.hiringNaukriUrl
      
      const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToManyCandidateById, variables: { filter: { hiringNaukriUrl: { url: { eq: hiringNaukriUrl } } } } });
      const response = await axiosRequest(graphqlQueryObj);
      console.log("Fetched candidate by candidate ID:", response?.data);
      const candidateObj = response?.data?.data?.candidates?.edges[0]?.node;
      console.log("Fetched candidate by candidate Obj :", candidateObj);
  
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
      console.log("Going to get candidate esdex-naukri-ur :", request.body.resdexNaukriUrl);
      const resdexNaukriUrl = request.body.resdexNaukriUrl;
      const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToManyCandidateById, variables: { filter: { resdexNaukriUrl: {url: { eq: resdexNaukriUrl } }} } });
      const response = await axiosRequest(graphqlQueryObj);
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
  
  @Get('get-candidates-and-chats')
  @UseGuards(JwtAuthGuard)
  async getCandidatesAndChats(@Req() request: any): Promise<object> {
    // const allPeople = await new FetchAndUpdateCandidatesChatsWhatsapps().fetchAllPeopleWithStartChatTrue()
    const allPeople = await new FetchAndUpdateCandidatesChatsWhatsapps().fetchSpecificPeopleToEngageBasedOnChatControl("allStartedAndStoppedChats");
    console.log("All people length:", allPeople?.length)
    return allPeople
  }
  @Post('create-video-interview')
  @UseGuards(JwtAuthGuard)
  async createVideoInterviewForCandidate(@Req() request: any): Promise<object> {
    const candidateId = request.body.candidateId;
    console.log('candidateId to create video-interview:', candidateId);
    const createVideoInterviewResponse = await new FetchAndUpdateCandidatesChatsWhatsapps().createVideoInterviewForCandidate(candidateId);
    console.log("createVideoInterviewResponse:", createVideoInterviewResponse)
    return createVideoInterviewResponse;
  }



  @Post('delete-people-and-candidates-from-candidate-id')
  @UseGuards(JwtAuthGuard)
  async deletePeopleFromCandidateIds(@Req() request: any): Promise<object> {
    const candidateId = request.body.candidateId;
    console.log('candidateId to create video-interview:', candidateId);
    const graphqlQueryObjToFetchCandidate = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToManyCandidateById, variables: { filter: { id: { eq: candidateId } } } });
    const candidateObjresponse = await axiosRequest(graphqlQueryObjToFetchCandidate);
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
      const response = await axiosRequest(graphqlQueryObj);
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
      const response = await axiosRequest(graphqlQueryObjToDeletePerson);
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
    console.log('personId to delete:', personId);
    const graphqlQueryObjToFetchPerson = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToFindPeopleByPhoneNumber, variables: { filter: { id: { eq: personId } } } });
    const personresponse = await axiosRequest(graphqlQueryObjToFetchPerson);
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
      const response = await axiosRequest(graphqlQueryObj);
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
      const response = await axiosRequest(graphqlQueryObjToDeletePerson);
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

    const candidatesResponse = await axiosRequest(graphqlQueryObjToFetchCandidates);
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
      await axiosRequest(graphqlQueryObjDeleteCandidates);
      
      // Delete associated people in bulk
      const graphqlQueryObjDeletePeople = JSON.stringify({
        query: allGraphQLQueries.graphqlMutationToDeleteManyPeople,
        variables: { filter: { id: { in: personIdsFromCandidates } } }
      });
      await axiosRequest(graphqlQueryObjDeletePeople);
      
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

    const peopleResponse = await axiosRequest(graphqlQueryObjToFetchPeople);
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
      await axiosRequest(graphqlQueryObjDeleteCandidates);
      
      // Then delete people
      const graphqlQueryObjDeletePeople = JSON.stringify({
        query: allGraphQLQueries.graphqlMutationToDeleteManyPeople,
        variables: { filter: { id: { in: personIds } } }
      });
      await axiosRequest(graphqlQueryObjDeletePeople);
      
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
  async createInterviewVideos(@Req() request: any): Promise<object> {
    console.log("This is the request body:", request.body);
    const jobId = request.body.jobId;
    console.log("This is the jobId:", jobId);
    console.log("This is the NODE NEV:", process.env.NODE_ENV);
    const url = process.env.NODE_ENV === 'production' ? 'https://arxena.com/create-interview-videos' : 'http://localhost:5050/create-interview-videos';
    console.log("This is the url:", url);
    try {
      const response = await axios.post(url, { jobId:jobId }, {
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', }, 
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
    const personObj: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps().getPersonDetailsByPhoneNumber(request.body.phoneNumberTo);
    try {
      await shareJDtoCandidate(personObj, 'startChat');
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
      const personObj: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps().getPersonDetailsByPhoneNumber(request.body.phoneNumberFrom);
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
        const responseOfDeliveryStatus = await axiosRequest(graphqlQueryObjForUpdationForDeliveryStatus);
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

// @UseGuards(JwtAuthGuard)
@Controller('webhook')
export class WhatsappWebhook {
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
    const requestBody = request.body;
    try {
      await new IncomingWhatsappMessages().receiveIncomingMessagesFromFacebook(requestBody);
    } catch (error) {
      // Handle error
    }
    response.sendStatus(200);
  }

}

@Controller('whatsapp-controller')
export class WhatsappControllers {
  @Post('uploadFile')
  async uploadFileToFBWAAPI(@Req() request: any): Promise<object> {
    console.log('upload file to whatsapp api');
    const requestBody = request?.body;
    const filePath = requestBody?.filePath;
    const response = await new FacebookWhatsappChatApi().uploadFileToWhatsAppUsingControllerApi(filePath);
    return response || {}; // Return an empty object if the response is undefined
  }
}



@Controller('google-mail-calendar-contacts')
export class GoogleControllers {
  @Post('send-mail')
  async sendEmail(@Req() request: any): Promise<object> {
    const person: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps().getPersonDetailsByPhoneNumber(request.body.phoneNumber);
    const emailData: GmailMessageData = {
      sendEmailFrom: allDataObjects.recruiterProfile?.email,
      sendEmailTo: person?.email,
      subject: request.body?.subject || 'Email from the recruiter',
      message: request.body?.message || 'This is a test email',
    };
    console.log("This is the email Data:", emailData)
    const response = await new SendEmailFunctionality().sendEmailFunction(emailData);
    console.log("This is the response:", response)
    return response || {}; // Return an empty object if the response is undefined
  }

  @Post('send-mail-with-attachment')
  async sendEmailWithAttachment(@Req() request: any): Promise<object> {
    const person: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps().getPersonDetailsByPhoneNumber(request.body.phoneNumber);
    
    const emailData: GmailMessageData = {
      sendEmailFrom: allDataObjects.recruiterProfile?.email,
      sendEmailTo: person?.email,
      subject: request.body?.subject || 'Email from the recruiter',
      message: request.body?.message || 'This is a test email',
      attachments: [
        {
          filename: 'Resume - JC Sharma.pdf',
          path: '/Users/arnavsaxena/Downloads/Resumes - Executive Director (MIL)/JC Sharma.pdf'
        }
      ]
    };

    const response = await new SendEmailFunctionality().sendEmailWithAttachmentFunction(emailData);
    return response || {};
  }


  @Post('send-calendar-invite')
  async sendCalendarInvite(@Req() request: any): Promise<object> {
    const person: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps().getPersonDetailsByPhoneNumber(request.body.phoneNumber);
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
    const response = await new CalendarEmailService().createNewCalendarEvent(calendarEventObj);
    console.log("Response data:", (response as any)?.data)
    return { status: 'scheduleMeeting the candidate meeting.' };
  }
}



@Controller('twilio')
export class TwilioControllers {
  @Post('sendMessage')
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

  @Post('send-template-message')
  async sendTemplateMessage(@Req() request: Request): Promise<object> {

    const requestBody = request.body as any;
    const personObj: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps().getPersonDetailsByPhoneNumber(requestBody.phoneNumberTo);
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

    const response = await new FacebookWhatsappChatApi().sendWhatsappUtilityMessage(sendTemplateMessageObj);
    let utilityMessage = await new WhatsappTemplateMessages().getUpdatedUtilityMessageObj(sendTemplateMessageObj);
    const whatsappTemplateMessageSent = await new WhatsappTemplateMessages().generateMessage(requestBody.templateName, sendTemplateMessageObj);
    const mostRecentMessageArr: allDataObjects.ChatHistoryItem[] = personObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.messageObj;
    console.log("This is the mostRecentMessageArr:", mostRecentMessageArr)
    const chatControl = personObj?.candidates?.edges[0].node.lastEngagementChatControl;
    mostRecentMessageArr.push({ role: 'user', content: whatsappTemplateMessageSent });
    const whatappUpdateMessageObj:allDataObjects.candidateChatMessageType = await new CandidateEngagementArx().updateChatHistoryObjCreateWhatsappMessageObj( 'success', personObj, mostRecentMessageArr, chatControl);
    await new CandidateEngagementArx().updateCandidateEngagementDataInTable(whatappUpdateMessageObj);
    console.log("This is ther esponse:", response.data)
    return { status: 'success' };
  }


  @Post('template')
  async create(@Req() request: Request): Promise<object> {
    const sendMessageObj: allDataObjects.sendWhatsappTemplateMessageObjectType = request.body as unknown as allDataObjects.sendWhatsappTemplateMessageObjectType;
    new FacebookWhatsappChatApi().sendWhatsappTemplateMessage(sendMessageObj);
    return { status: 'success' };
  }
  @Post('utility')
  async createUtilityMessage(@Req() request: Request): Promise<object> {
    const sendMessageObj: allDataObjects.sendWhatsappUtilityMessageObjectType = request.body as unknown as allDataObjects.sendWhatsappUtilityMessageObjectType;
    new FacebookWhatsappChatApi().sendWhatsappUtilityMessage(sendMessageObj);
    return { status: 'success' };
  }

  @Post('message')
  async createTextMessage(@Req() request: Request): Promise<object> {
    const sendTextMessageObj: allDataObjects.ChatRequestBody = {
      phoneNumberTo: '918411937769',
      phoneNumberFrom: '918411937769',
      messages: 'This is the panda talking',
    };
    new FacebookWhatsappChatApi().sendWhatsappTextMessage(sendTextMessageObj);
    return { status: 'success' };
  }
  @Post('uploadFile')
  async uploadFileToFBWAAPI(@Req() request: any): Promise<object> {
    console.log('upload file to whatsapp api');
    const requestBody = request?.body;
    const filePath = requestBody?.filePath;
    const chatControl = 'startChat';
    const response = await new FacebookWhatsappChatApi().uploadFileToWhatsApp(filePath, chatControl);
    return response || {}; 
  }

  @Post('sendAttachment')
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
  async uploadAndSendFileToFBWAAPIUser(@Req() request: any): Promise<object> {
    const sendFileObj = request.body;
    const chatControl = 'startChat';
    new FacebookWhatsappChatApi().uploadAndSendFileToWhatsApp(sendFileObj, chatControl);
    return { status: 'success' };
  }

  @Post('downloadAttachment')
  async downloadFileToFBWAAPIUser(@Req() request: Request): Promise<object> {
    const downloadAttachmentMessageObj = request.body;
    return { status: 'success' };
  }
}
