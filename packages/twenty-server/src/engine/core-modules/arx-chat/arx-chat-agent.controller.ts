import { Controller, Get, Post, Req, Res, UseGuards, Body, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from 'src/engine/guards/jwt.auth.guard';
import * as allDataObjects from 'src/engine/core-modules/arx-chat/services/data-model-objects';
import { FacebookWhatsappChatApi } from './services/whatsapp-api/facebook-whatsapp/facebook-whatsapp-api';
// import { UpdateCandidatesChatsWhatsapps } from './services/candidateEngagement/updateChat';
import CandidateEngagementArx from './services/candidate-engagement/check-candidate-engagement';
import { IncomingWhatsappMessages}  from './services/whatsapp-api/incoming-messages';



@Controller('updateChat')
export class UpdateChatEndpoint {
  @Post()
  async create(@Req() request: Request): Promise<object>{
      console.log("These are the request body", request.body);
      const userMessageBody: allDataObjects.ChatRequestBody | null = request?.body as allDataObjects.ChatRequestBody | null; // Type assertion
      console.log("This is the user message", userMessageBody);

      if (userMessageBody !== null) {
          const { phoneNumberFrom, phoneNumberTo, messages } = userMessageBody;
          const userMessage: allDataObjects.candidateChatMessageType = {
              phoneNumberFrom,
              phoneNumberTo,
              messages:[{"text": userMessageBody.messages}],
              candidateFirstName: '',
              messageObj: [],
              messageType: "candidateMessage",
              candidateProfile : allDataObjects.emptyCandidateProfileObj,
              executorResultObj: {}
          };
          const updateStatus = await new CandidateEngagementArx().updateAndSendWhatsappMessageAndCandidateEngagementStatusInTable(userMessage);
          console.log("This is the update status", updateStatus);
          return { status: updateStatus };
      }
      else {
          return { status: "Failed" };
      }
  }
}

// @UseGuards(JwtAuthGuard)
@Controller('webhook')
export class WhatsappWebhook {
  @Get()
  findAll(@Req() request: any, @Res() response: any) {
    
    console.log("-------------- New Request GET --------------");  
    var mode = request.query["hub.mode"];
    var token = request.query["hub.verify_token"];
    var challenge = request.query["hub.challenge"];
  
    console.log("-------------- New Request GET --------------");
    console.log("Headers:"+ JSON.stringify(request.headers, null, 3));
    console.log("Body:"+ JSON.stringify(request.body, null, 3));
  
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
    console.log("Headers:"+ JSON.stringify(request.headers, null, 3));
    console.log("Body:"+ JSON.stringify(request.body, null, 3));
    const requestBody = request.body;
    try {
      await new IncomingWhatsappMessages().receiveIncomingMessagesFromFacebook(requestBody);
    } catch (error) {
      // Handle error
    }
  response.sendStatus(200);
  }
}
