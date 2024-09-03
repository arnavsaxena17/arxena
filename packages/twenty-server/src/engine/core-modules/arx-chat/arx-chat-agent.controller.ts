import { Controller, Get, Post, Req, Res, UseGuards, Body, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from 'src/engine/guards/jwt.auth.guard';
import * as allDataObjects from './services/data-model-objects';
import { FacebookWhatsappChatApi } from './services/whatsapp-api/facebook-whatsapp/facebook-whatsapp-api';
// import { UpdateCandidatesChatsWhatsapps } from './services/candidateEngagement/updateChat';
import CandidateEngagementArx from './services/candidate-engagement/check-candidate-engagement';
import { IncomingWhatsappMessages } from './services/whatsapp-api/incoming-messages';
import { FetchAndUpdateCandidatesChatsWhatsapps } from './services/candidate-engagement/update-chat';
import { create } from 'domain';
import { request, response } from 'express';
import { OpenAIArxMultiStepClient } from './services/llm-agents/arx-multi-step-client';
// import { OpenAIArxSingleStepClient } from "./services/llm-agents/arx-single-step-client";
import { WhatsappAPISelector } from './services/whatsapp-api/whatsapp-controls';
import { any } from 'zod';
import { IncomingMessage } from 'http';
import { ToolsForAgents } from 'src/engine/core-modules/arx-chat/services/llm-agents/prompting-tool-calling';
import { axiosRequest } from './utils/arx-chat-agent-utils';
import * as allGraphQLQueries from './services/candidate-engagement/graphql-queries-chatbot';
import { FilePathGuard } from '../file/guards/file-path-guard';
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
        // executorResultObj: {},
        whatsappDeliveryStatus: 'candidateMessageReceived',
        whatsappMessageId: 'UpdateChatEndpoint',
      };
      // const updateStatus = await new CandidateEngagementArx().updateCandidateEngagementDataInTable(userMessage);
      // console.log("This is the update status", updateStatus);
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
    // console.log('Current Messages list:', messagesList);
    let mostRecentMessageArr: allDataObjects.ChatHistoryItem[] = new CandidateEngagementArx().getMostRecentMessageFromMessagesList(messagesList);
    // console.log('mostRecentMessageArr before chatCompletion:', mostRecentMessageArr);
    if (mostRecentMessageArr?.length > 0) {
      let chatAgent: OpenAIArxMultiStepClient;
      // if (process.env.PROMPT_ENGINEERING_TYPE === "single-step") {
      //   chatAgent = new OpenAIArxSingleStepClient(personObj);
      // } else {
      chatAgent = new OpenAIArxMultiStepClient(personObj);
      await chatAgent.createCompletion(mostRecentMessageArr, personObj, 'engage');
      const whatappUpdateMessageObj = await new CandidateEngagementArx().updateChatHistoryObjCreateWhatsappMessageObj('ArxChatEndpoint', personObj, mostRecentMessageArr);
      // const engagementStatus =
      //   await new CandidateEngagementArx().updateCandidateEngagementDataInTable(
      //     whatappUpdateMessageObj
      //   );

      // console.log("Engagement Status:", engagementStatus);
      // if (engagementStatus?.status === "success") {
      //   return { status: engagementStatus?.status };
      // } else {
      //   return { status: "Failed" };
      // }
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
      // console.log('Current Messages list:', messagesList);
      let mostRecentMessageArr: allDataObjects.ChatHistoryItem[] = new CandidateEngagementArx().getMostRecentMessageFromMessagesList(messagesList);
      const isChatEnabled: boolean = false;
      // console.log('mostRecentMessageArr before chatCompletion:', mostRecentMessageArr);
      if (mostRecentMessageArr?.length > 0) {
        let chatAgent: OpenAIArxMultiStepClient;
        // if (process.env.PROMPT_ENGINEERING_TYPE === "single-step") {
        //   chatAgent = new OpenAIArxSingleStepClient(personObj);
        // } else {
        chatAgent = new OpenAIArxMultiStepClient(personObj);
        // }
        // await chatAgent.createCompletion(
        //   mostRecentMessageArr,
        //   personObj,
        //   isChatEnabled
        // );
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
    // if (process.env.PROMPT_ENGINEERING_TYPE === "single-step") {
    //   chatAgent = new OpenAIArxSingleStepClient(personObj);
    // } else {
    chatAgent = new OpenAIArxMultiStepClient(personObj);
    // }
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
    // console.log("This is the candiate who has sent us the message., we have to update the database that this message has been recemivged::", chatReply);
    // console.log('This is the candiate who has sent us candidateProfileData::', candidateProfileData);
    await new IncomingWhatsappMessages().createAndUpdateIncomingCandidateChatMessage(
      {
        chatReply: chatReply,
        whatsappDeliveryStatus: 'delivered',
        whatsappMessageId: 'receiveIncomingMessagesFromController',
      },
      candidateProfileData,
    );
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
    // console.log('Person Obj:', JSON.stringify(personObj));
    console.log('This is the chat reply:', chatReply);
    const recruiterProfile = allDataObjects.recruiterProfile;
    console.log('Recruiter profile', recruiterProfile);
    const chatMessages = personObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges;
    // console.log('chatMessages:', chatMessages);
    let chatHistory = chatMessages[0]?.node?.messageObj || [];
    // console.log('Got chathistory = ', chatHistory);
    // console.log('chatMessages:', chatMessages);
    if (chatReply === 'startChat' && chatMessages.length === 0) {
      const SYSTEM_PROMPT = await new ToolsForAgents().getSystemPrompt(personObj);
      chatHistory.push({ role: 'system', content: SYSTEM_PROMPT });
      chatHistory.push({ role: 'user', content: 'startChat' });
    } else {
      chatHistory = personObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.messageObj;
    }
    let whatappUpdateMessageObj: allDataObjects.candidateChatMessageType = {
      // executorResultObj: {},
      candidateProfile: personObj?.candidates?.edges[0]?.node,
      candidateFirstName: personObj?.name?.firstName,
      phoneNumberFrom: personObj?.phone,
      phoneNumberTo: recruiterProfile.phone,
      messages: [{ content: chatReply }],
      messageType: 'candidateMessage',
      messageObj: chatHistory,
      // messageObjWithTimeStamp: chatHistoryWithTimeStamp,
      whatsappDeliveryStatus: 'startChatTriggered',
      whatsappMessageId: 'startChat',
    };

    const engagementStatus = await new CandidateEngagementArx().updateCandidateEngagementDataInTable(whatappUpdateMessageObj);
    // console.log('Engagement Status:', engagementStatus);
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
    // console.log('Person Obj:', JSON.stringify(personObj));
    console.log('This is the chat reply:', messageToSend);
    const recruiterProfile = allDataObjects.recruiterProfile;
    console.log('Recruiter profile', recruiterProfile);
    const chatMessages = personObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges;
    // console.log('chatMessages:', chatMessages);
    let chatHistory = chatMessages[0]?.node?.messageObj || [];
    // console.log('Got chathistory = ', chatHistory);
    // console.log('chatMessages:', chatMessages);

    chatHistory = personObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.messageObj;
    // }
    let whatappUpdateMessageObj: allDataObjects.candidateChatMessageType = {
      // executorResultObj: {},
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
    // to send the message to facebook api
    const sendMessageResponse = await new FacebookWhatsappChatApi().sendWhatsappTextMessage(messageObj);
    whatappUpdateMessageObj.whatsappMessageId = sendMessageResponse?.data?.messages[0]?.id;
    whatappUpdateMessageObj.whatsappDeliveryStatus = 'sent';
    // to put it inside database table
    await new FetchAndUpdateCandidatesChatsWhatsapps().createAndUpdateWhatsappMessage(personObj.candidates.edges[0].node, whatappUpdateMessageObj);
    // console.log(sendMessageResponse);
    return { status: 'success' };
  }


  @Post('get-all-messages-by-candidate-id')
  @UseGuards(JwtAuthGuard)
  async getPhoneNumbersByCandidateId(@Req() request: any): Promise<object> {
    
    let allWhatsappMessages = [];
    let lastCursor = null;
    // let tryNo = 0
    const candidateId = request.body.candidateId;
    console.log('candidateId to fetch all messages:', candidateId);
    while (true) {
      // tryNo+=1
      // console.log("Try #", tryNo)
      try {
        const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphQlToFetchWhatsappMessages, variables:{ "limit": 30, "lastCursor": lastCursor, "filter": { "candidateId":{"in": [candidateId] } }, "orderBy": [ { "position": "DescNullsFirst" } ] } });
        const response = await axiosRequest(graphqlQueryObj);
        const whatsappMessages = response.data.data.whatsappMessages;
        // console.log("Got Whatsapp Messages:", whatsappMessages)
        if (!whatsappMessages || whatsappMessages?.edges?.length === 0) {
          console.log("No more data to fetch.");
          break;
        }
        const newWhatsappMessages = whatsappMessages.edges.map(edge => edge.node);
        allWhatsappMessages = allWhatsappMessages.concat(newWhatsappMessages);
        lastCursor = whatsappMessages.edges[whatsappMessages.edges.length - 1].cursor;
        if (newWhatsappMessages.length < 30) {  // Assuming 1000 is the maximum limit per request
          console.log("Reached the last page.");
          break;
        }
      } catch (error) {
        console.error('Error fetching whatsappmessages:', error);
        break;
      }
    }
    return allWhatsappMessages;
  }



  async fetchAllPeople() {
    let allPeople = [];
    let lastCursor = null;
    while (true) {
      try {
        const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToFindEngagedCandidates, variables: { "limit": 30, "lastCursor": lastCursor } });
        const response = await axiosRequest(graphqlQueryObj);
        const peopleData = response.data.data.people;
        if (!peopleData || !peopleData.edges || peopleData.edges.length === 0) {
          console.log("No more data to fetch.");
          break;
        }
        const newPeople = peopleData.edges.map(edge => edge.node);
        allPeople = allPeople.concat(newPeople);
        lastCursor = peopleData.edges[peopleData.edges.length - 1].cursor;
        if (newPeople.length < 30) {  // Assuming 1000 is the maximum limit per request
          // console.log("Reached the last page.");
          break;
        }
      } catch (error) {
        console.error('Error fetching people:', error);
        break;
      }
    }
    return allPeople;
  }

  @Get('get-candidates-and-chats')
  @UseGuards(JwtAuthGuard)
  async getCandidatesAndChats(@Req() request: any): Promise<object> {

    const allPeople = await this.fetchAllPeople()
    console.log("All people length:", allPeople.length)

    return allPeople
  }

  @Post('remove-chats')
  async removeChats(@Req() request: any): Promise<object> {
    // await new FetchAndUpdateCandidatesChatsWhatsapps().removeChatsByPhoneNumber(
    //   request.body.phoneNumberFrom
    // );
    return { status: 'Success' };
  }

  @Post('send-jd-from-frontend')
  @UseGuards(JwtAuthGuard)
  async uploadAttachment(@Req() request: any): Promise<object> {
    console.log('This is the request body', request.body);
    debugger;
    // const attachmentData: allDataObjects.AttachmentData =
    //   request.body.attachmentData;
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
        console.log('Res:::', responseOfDeliveryStatus?.data?.data?.whatsappDeliveryStatus, "for wamid::", responseOfDeliveryStatus?.data?.data?.whatsappMessageId);
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

  @Post('send-message-baileys')
  async sendMessageToBaileys() {
    try {
      // await this.baileys.sendMessage('919769331376@s.whatsapp.net', { text: 'Hello from controller' });
    } catch (error) {
      // Handle error
    }
    response.sendStatus(200);
  }

  // @Get('testing-schedule')
  // async schedulingTest(){
  //   await scheduleMeeting({}, )
  // }
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
    // const message = await client.messages.create({
    //   contentSid:"HX8d480450a706f4a40cc6f7be26b48ba0",
    //   from: "whatsapp:+15153163273",
    //   to: "whatsapp:+918411937769",
    //   body: recruitingTemplate,
    //   contentVariables: JSON.stringify({
    //     1: "Anjali"
    //   }),
    //   });

    console.log('This is mesage:', message);
    console.log(message.body);

    return message;
  }

  @Post('testMessage')
  async testMessage(@Req() request: any): Promise<any> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const client = require('twilio')(accountSid, authToken);

    client.messages
      .create({
        // body: 'Your Yummy Cupcakes Company order of 1 dozen frosted cupcakes has shipped and should be delivered on July 10, 2019. Details: http://www.yummycupcakes.com/',
        body: 'Hi, would you be keen on a new role?',
        from: 'whatsapp:+15153163273',
        to: 'whatsapp:+918411937769',
      })
      .then(message => console.log(message.sid))
      .done();
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
    return response || {}; // Return an empty object if the response is undefined
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

    // new FacebookWhatsappChatApi().sendWhatsappAttachmentMessage(
    //   sendTextMessageObj
    // );
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
    // new FacebookWhatsappChatApi().downloadWhatsappAttachmentMessage(
    //   downloadAttachmentMessageObj
    // );
    return { status: 'success' };
  }
}
