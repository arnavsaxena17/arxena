import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/engine/guards/jwt.auth.guard';
import * as allDataObjects from './services/data-model-objects';
import { FacebookWhatsappChatApi } from './services/whatsapp-api/facebook-whatsapp/facebook-whatsapp-api';
import CandidateEngagementArx from './services/candidate-engagement/check-candidate-engagement';
import { IncomingWhatsappMessages } from './services/whatsapp-api/incoming-messages';
import { FetchAndUpdateCandidatesChatsWhatsapps } from './services/candidate-engagement/update-chat';
import { OpenAIArxMultiStepClient } from './services/llm-agents/arx-multi-step-client';
import { ToolsForAgents } from 'src/engine/core-modules/arx-chat/services/llm-agents/prompting-tool-calling';
import { axiosRequest } from './utils/arx-chat-agent-utils';
import * as allGraphQLQueries from './services/candidate-engagement/graphql-queries-chatbot';
import { shareJDtoCandidate } from './services/llm-agents/tool-calls-processing';
import twilio from 'twilio';

@Controller('updateChat')
export class UpdateChatEndpoint {
  @Post()
  async create(@Req() request: Request): Promise<object> {
    console.log('These are the request body', request.body);
    const userMessageBody: allDataObjects.ChatRequestBody | null = request?.body as allDataObjects.ChatRequestBody | null; // Type assertion
    console.log('This is the user message', userMessageBody);
    if (userMessageBody !== null) {
      const { phoneNumberFrom, phoneNumberTo, messages } = userMessageBody;
      const userMessage: allDataObjects.candidateChatMessageType = {
        phoneNumberFrom,
        phoneNumberTo,
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
    const messagesList = personCandidateNode?.whatsappMessages?.edges;
    let mostRecentMessageArr: allDataObjects.ChatHistoryItem[] = new CandidateEngagementArx().getMostRecentMessageFromMessagesList(messagesList);
    if (mostRecentMessageArr?.length > 0) {
      let chatAgent: OpenAIArxMultiStepClient;
      chatAgent = new OpenAIArxMultiStepClient(personObj);
      await chatAgent.createCompletion(mostRecentMessageArr, personObj, 'engage');
      const whatappUpdateMessageObj = await new CandidateEngagementArx().updateChatHistoryObjCreateWhatsappMessageObj('ArxChatEndpoint', personObj, mostRecentMessageArr);
      return whatappUpdateMessageObj;
    }
  }

  @Post('retrieve-chat-response')
  async retrieve(@Req() request: any): Promise<object> {
    const personObj: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps().getPersonDetailsByPhoneNumber(request.body.phoneNumberFrom);
    // debugger;
    try {
      const personCandidateNode = personObj?.candidates?.edges[0]?.node;
      const messagesList = personCandidateNode?.whatsappMessages?.edges;
      let mostRecentMessageArr: allDataObjects.ChatHistoryItem[] = new CandidateEngagementArx().getMostRecentMessageFromMessagesList(messagesList);
      const isChatEnabled: boolean = false;
      if (mostRecentMessageArr?.length > 0) {
        let chatAgent: OpenAIArxMultiStepClient;
        chatAgent = new OpenAIArxMultiStepClient(personObj);
        const engagementType = 'engage';
        mostRecentMessageArr = await chatAgent.createCompletion(mostRecentMessageArr, personObj, engagementType, isChatEnabled);
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
    const engagementType = 'engage';
    const mostRecentMessageArr = await chatAgent.createCompletion(messagesList, personObj, engagementType);
    return mostRecentMessageArr;
  }


  @Post('get-system-prompt')
  async getSystemPrompt(@Req() request: any): Promise<object> {
    console.log('JSON.string', JSON.stringify(request.body));
    const personObj: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps().getPersonDetailsByPhoneNumber(request.body.phoneNumber);
    const systemPrompt = await new ToolsForAgents().getSystemPrompt(personObj)
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
    const stage = await chatAgent.getStageOfTheConversation(messagesList, engagementType, processorType);
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
    await new IncomingWhatsappMessages().createAndUpdateIncomingCandidateChatMessage( { chatReply: chatReply, whatsappDeliveryStatus: 'delivered', whatsappMessageId: 'receiveIncomingMessagesFromController', }, candidateProfileData );
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
    if (chatReply === 'startChat' && chatMessages.length === 0) {
      const SYSTEM_PROMPT = await new ToolsForAgents().getSystemPrompt(personObj);
      chatHistory.push({ role: 'system', content: SYSTEM_PROMPT });
      chatHistory.push({ role: 'user', content: 'startChat' });
    } else {
      chatHistory = personObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.messageObj;
    }
    let whatappUpdateMessageObj: allDataObjects.candidateChatMessageType = {
      candidateProfile: personObj?.candidates?.edges[0]?.node,
      candidateFirstName: personObj?.name?.firstName,
      phoneNumberFrom: personObj?.phone,
      phoneNumberTo: recruiterProfile.phone,
      messages: [{ content: chatReply }],
      messageType: 'candidateMessage',
      messageObj: chatHistory,
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
    chatHistory = personObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.messageObj;
    let whatappUpdateMessageObj: allDataObjects.candidateChatMessageType = {
      candidateProfile: personObj?.candidates?.edges[0]?.node,
      candidateFirstName: personObj?.name?.firstName,
      phoneNumberFrom: recruiterProfile.phone,
      phoneNumberTo: personObj?.phone,
      messages: [{ content: request?.body?.messageToSend }],
      messageType: 'recruiterMessage',
      messageObj: chatHistory,
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
    const candidateStatus = personObj?.candidates?.edges[0]?.node?.status
    console.log("Candidate satus:", candidateStatus, "for phone number:", request.body.phoneNumber);
    return {"status":candidateStatus};
  }
  
  @Post('get-candidate-by-phone-number')
  @UseGuards(JwtAuthGuard)
  async getCandidateIdsByPhoneNumbers(@Req() request: any): Promise<object> {
    const personObj: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps().getPersonDetailsByPhoneNumber(request.body.phoneNumber);
    const candidateId = personObj?.candidates?.edges[0]?.node?.id
    console.log('candidateId to fetch all messages:', candidateId);
    return {"candidateId":candidateId};
  }
  
  @Get('get-candidates-and-chats')
  @UseGuards(JwtAuthGuard)
  async getCandidatesAndChats(@Req() request: any): Promise<object> {
    const allPeople = await new FetchAndUpdateCandidatesChatsWhatsapps().fetchAllPeople()
    console.log("All people length:", allPeople?.length)
    return allPeople
  }

  @Post('remove-chats')
  async removeChats(@Req() request: any): Promise<object> {
    return { status: 'Success' };
  }

  @Post('send-jd-from-frontend')
  @UseGuards(JwtAuthGuard)
  async uploadAttachment(@Req() request: any): Promise<object> {
    console.log('This is the request body', request.body);
    const personObj: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps().getPersonDetailsByPhoneNumber(request.body.phoneNumberTo);
    try {
      await shareJDtoCandidate(personObj);
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
      const checkHumanLike = await new OpenAIArxMultiStepClient(personObj).checkIfResponseMessageSoundsHumanLike(request.body.contentObj);
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
    const response = await new FacebookWhatsappChatApi().uploadFileToWhatsApp(filePath);
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
    new FacebookWhatsappChatApi().uploadAndSendFileToWhatsApp(sendFileObj);
    return { status: 'success' };
  }

  @Post('downloadAttachment')
  async downloadFileToFBWAAPIUser(@Req() request: Request): Promise<object> {
    const downloadAttachmentMessageObj = request.body;
    return { status: 'success' };
  }
}
