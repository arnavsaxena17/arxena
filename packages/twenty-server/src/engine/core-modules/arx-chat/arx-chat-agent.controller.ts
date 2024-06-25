import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  Body,
  Inject,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { JwtAuthGuard } from "src/engine/guards/jwt.auth.guard";
import * as allDataObjects from "./services/data-model-objects";
import { FacebookWhatsappChatApi } from "./services/whatsapp-api/facebook-whatsapp/facebook-whatsapp-api";
// import { UpdateCandidatesChatsWhatsapps } from './services/candidateEngagement/updateChat';
import CandidateEngagementArx from "./services/candidate-engagement/check-candidate-engagement";
import { IncomingWhatsappMessages } from "./services/whatsapp-api/incoming-messages";
import { FetchAndUpdateCandidatesChatsWhatsapps } from "./services/candidate-engagement/update-chat";
import { create } from "domain";
import { request, response } from "express";
import { OpenAIArxMultiStepClient } from "./services/llm-agents/arx-multi-step-client";
import { OpenAIArxSingleStepClient } from "./services/llm-agents/arx-single-step-client";
import { WhatsappAPISelector } from "./services/whatsapp-api/whatsapp-controls";
import { any } from "zod";
import { IncomingMessage } from "http";
import { ToolsForAgents } from "src/engine/core-modules/arx-chat/services/llm-agents/prompting-tool-calling";

@Controller("updateChat")
export class UpdateChatEndpoint {
  @Post()
  async create(@Req() request: Request): Promise<object> {
    console.log("These are the request body", request.body);
    const userMessageBody: allDataObjects.ChatRequestBody | null =
      request?.body as allDataObjects.ChatRequestBody | null; // Type assertion
    console.log("This is the user message", userMessageBody);
    if (userMessageBody !== null) {
      const { phoneNumberFrom, phoneNumberTo, messages } = userMessageBody;
      const userMessage: allDataObjects.candidateChatMessageType = {
        phoneNumberFrom,
        phoneNumberTo,
        messages: [{ text: userMessageBody.messages }],
        candidateFirstName: "",
        messageObj: [],
        messageType: "candidateMessage",
        candidateProfile: allDataObjects.emptyCandidateProfileObj,
        executorResultObj: {},
        whatsappDeliveryStatus: "candidateMessageReceived",
        whatsappMessageId: "UpdateChatEndpoint",
      };
      // const updateStatus = await new CandidateEngagementArx().updateCandidateEngagementDataInTable(userMessage);
      // console.log("This is the update status", updateStatus);
      const panda = { status: "updateStatus" };
      return panda;
    } else {
      return { status: "Failed" };
    }
  }
}

@Controller("arx-chat")
export class ArxChatEndpoint {
  @Post("invoke-chat")
  async evaluate(@Req() request: any): Promise<object> {
    const personObj: allDataObjects.PersonNode =
      await new FetchAndUpdateCandidatesChatsWhatsapps().getPersonDetailsByPhoneNumber(
        request.body.phoneNumberFrom
      );
    const personCandidateNode = personObj?.candidates?.edges[0]?.node;
    const messagesList = personCandidateNode?.whatsappMessages?.edges;
    console.log("Current Messages list:", messagesList);
    let mostRecentMessageArr: allDataObjects.ChatHistoryItem[] =
      new CandidateEngagementArx().getMostRecentMessageFromMessagesList(
        messagesList
      );
    console.log(
      "mostRecentMessageArr before chatCompletion:",
      mostRecentMessageArr
    );
    if (mostRecentMessageArr?.length > 0) {
      let chatAgent: OpenAIArxSingleStepClient | OpenAIArxMultiStepClient;
      if (process.env.PROMPT_ENGINEERING_TYPE === "single-step") {
        chatAgent = new OpenAIArxSingleStepClient(personObj);
      } else {
        chatAgent = new OpenAIArxMultiStepClient(personObj);
      }
      await chatAgent.createCompletion(mostRecentMessageArr, personObj);
      const whatappUpdateMessageObj = await new CandidateEngagementArx().updateChatHistoryObjCreateWhatsappMessageObj("ArxChatEndpoint", response,personObj,mostRecentMessageArr);
      await new CandidateEngagementArx().updateCandidateEngagementDataInTable(whatappUpdateMessageObj);
    }
    return { status: "Success" };
  }



  @Post('run-chat-completion')
  async runChatCompletion(@Req() request: any): Promise<object>{
    console.log("JSON.string", JSON.stringify(request.body))
    const personObj:allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps().getPersonDetailsByPhoneNumber("918411937768")
    const messagesList = request.body;

    let chatAgent: OpenAIArxSingleStepClient | OpenAIArxMultiStepClient;
    if (process.env.PROMPT_ENGINEERING_TYPE === 'single-step') {
      chatAgent = new OpenAIArxSingleStepClient(personObj);
    } else {
      chatAgent = new OpenAIArxMultiStepClient(personObj);
    }
    const mostRecentMessageArr = await chatAgent.createCompletion(messagesList, personObj);

    // const personCandidateNode = personObj?.candidates?.edges[0]?.node;
    // const messagesList = personCandidateNode?.whatsappMessages?.edges;
    // console.log("Current Messages list:", messagesList);
    // let mostRecentMessageArr:allDataObjects.ChatHistoryItem[] = new CandidateEngagementArx().getMostRecentMessageFromMessagesList(messagesList);
    // console.log("mostRecentMessageArr before chatCompletion:", mostRecentMessageArr);
    // if (mostRecentMessageArr?.length > 0) {
    //   let chatAgent:OpenAIArxSingleStepClient | OpenAIArxMultiStepClient;
    //   if (process.env.PROMPT_ENGINEERING_TYPE === 'single-step') {
    //     chatAgent = new OpenAIArxSingleStepClient(personObj);
    //   }
    //   else{
    //     chatAgent = new OpenAIArxMultiStepClient(personObj);
    //   }
    //   await chatAgent.createCompletion(mostRecentMessageArr, personObj);
    //   const whatappUpdateMessageObj = await new CandidateEngagementArx().updateChatHistoryObjCreateWhatsappMessageObj("ArxChatEndpoint", response,personObj,mostRecentMessageArr);
    //   await new CandidateEngagementArx().updateCandidateEngagementDataInTable(whatappUpdateMessageObj);
    // }
    return mostRecentMessageArr ;
  }


  @Post("add-chat")
  async addChat(@Req() request: any): Promise<object> {
    const whatsappIncomingMessage: allDataObjects.chatMessageType = {
      phoneNumberFrom: request.body.phoneNumberFrom,
      phoneNumberTo: "918591724917",
      messages: [{ role: "user", content: request.body.message }],
      messageType: "string",
    };

    const chatReply = request.body.message;
    console.log(
      "We will first go and get the candiate who sent us the message"
    );
    const candidateProfileData =
      await new FetchAndUpdateCandidatesChatsWhatsapps().getCandidateInformation(
        whatsappIncomingMessage
      );
    // console.log("This is the candiate who has sent us the message., we have to update the database that this message has been recemivged::", chatReply);
    console.log("This is the candiate who has sent us candidateProfileData::", candidateProfileData);
    await new IncomingWhatsappMessages().createAndUpdateIncomingCandidateChatMessage({ chatReply: chatReply, whatsappDeliveryStatus: "delivered", whatsappMessageId: "receiveIncomingMessagesFromController"}, candidateProfileData);
    return { status: "Success" };
  }

  @Post("start-chat")
  async startChat(@Req() request: any): Promise<object> {
    const whatsappIncomingMessage: allDataObjects.chatMessageType = {
      phoneNumberFrom: request.body.phoneNumberFrom,
      phoneNumberTo: "918591724917",
      messages: [{ role: "user", content: "hi" }],
      messageType: "string",
    };

    console.log("This is the chat reply:", whatsappIncomingMessage);
    const chatReply = "hi";

    const personObj: allDataObjects.PersonNode =
      await new FetchAndUpdateCandidatesChatsWhatsapps().getPersonDetailsByPhoneNumber(
        request.body.phoneNumberFrom
      );
    console.log("Person Obj:", JSON.stringify(personObj));
    console.log("This is the chat reply:", chatReply);
    const recruiterProfile = allDataObjects.recruiterProfile;
    console.log("Recruiter profile", recruiterProfile);
    const chatMessages =
      personObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges;
    console.log("chatMessages:", chatMessages);
    let chatHistory = chatMessages[0]?.node?.messageObj || [];
    console.log("Got chathistory = ", chatHistory);
    console.log("chatMessages:", chatMessages);
    if (chatReply === "hi" && chatMessages.length === 0) {
      const SYSTEM_PROMPT = await new ToolsForAgents().getSystemPrompt(
        personObj
      );
      chatHistory.push({ role: "system", content: SYSTEM_PROMPT });
      chatHistory.push({ role: "user", content: "Hi" });
    } else {
      chatHistory =
        personObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node
          ?.messageObj;
    }
    let whatappUpdateMessageObj: allDataObjects.candidateChatMessageType = {
      executorResultObj: {},
      candidateProfile: personObj?.candidates?.edges[0]?.node,
      candidateFirstName: personObj?.name?.firstName,
      phoneNumberFrom: personObj?.phone,
      phoneNumberTo: recruiterProfile.phone,
      messages: [{ content: chatReply }],
      messageType: "candidateMessage",
      messageObj: chatHistory,
      whatsappDeliveryStatus: "startChatTriggered",
      whatsappMessageId: "startChat",
    };

    const engagementStatus = await new CandidateEngagementArx().updateCandidateEngagementDataInTable(whatappUpdateMessageObj);
    if (engagementStatus?.status === "Success"){
      return { status: engagementStatus?.status };
    }
    else{
      return { status: "Failed" };
    }
    
  }

  @Post("remove-chats")
  async removeChats(@Req() request: any): Promise<object> {
    // await new FetchAndUpdateCandidatesChatsWhatsapps().removeChatsByPhoneNumber(
    //   request.body.phoneNumberFrom
    // );
    return { status: "Success" };
  }
}

// @UseGuards(JwtAuthGuard)
@Controller("webhook")
export class WhatsappWebhook {
  @Get()
  findAll(@Req() request: any, @Res() response: any) {
    console.log("-------------- New Request GET --------------");
    var mode = request.query["hub.mode"];
    var token = request.query["hub.verify_token"];
    var challenge = request.query["hub.challenge"];
    console.log("Mode:", mode);
    console.log("token:", token);
    console.log("challenge:", challenge);
    console.log("-------------- New Request GET --------------");
    console.log("Headers:" + JSON.stringify(request.headers, null, 3));
    console.log("Body:" + JSON.stringify(request.body, null, 3));

    // Check if a token and mode is in the query string of the request
    if (mode && token) {
      // Check the mode and token sent is correct
      if (mode === "subscribe" && token === "12345") {
        // Respond with the challenge token from the request
        console.log("WEBHOOK_VERIFIED");
        response.status(200).send(challenge);
      } else {
        console.log("Responding with 403 Forbidden");
        // Respond with '403 Forbidden' if verify tokens do not match
        response.sendStatus(403);
      }
    } else {
      console.log("Replying Thank you.");
      response.json({ message: "Thank you for the message" });
    }
  }

  @Post()
  async create(@Req() request: any, @Res() response: any) {
    console.log("-------------- New Request POST --------------");
    console.log("Headers:" + JSON.stringify(request.headers, null, 3));
    console.log("Body:" + JSON.stringify(request.body, null, 3));
    const requestBody = request.body;
    try {
      await new IncomingWhatsappMessages().receiveIncomingMessagesFromFacebook(
        requestBody
      );
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
