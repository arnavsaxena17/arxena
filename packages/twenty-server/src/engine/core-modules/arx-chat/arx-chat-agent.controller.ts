import { Controller, Get, Post, Req, Res, UseGuards, Body, Inject, HttpException, HttpStatus } from '@nestjs/common';

import { LLMChatAgent } from './services/llm-agents/llm-chat-agent';
import { JwtAuthGuard } from 'src/engine/guards/jwt.auth.guard';
import * as allDataObjects from 'src/engine/core-modules/arx-chat/services/data-model-objects';
import { FacebookWhatsappChatApi } from './services/whatsapp-api/facebook-whatsapp/facebook-whatsapp-api';
// import { UpdateCandidatesChatsWhatsapps } from './services/candidateEngagement/updateChat';
import CandidateEngagement from './services/candidate-engagement/check-candidate-engagement';
import { IncomingWhatsappMessages}  from './services/whatsapp-api/incoming-messages';


// import { BaileysGateway } from './services/baileys/callBaileys';
// import { SocketGateway } from 'src/engine/core-modules/baileys/socket-gateway/socket.gateway';
// import { MessageDto } from 'src/engine/core-modules/baileys/types/baileys-types';

// import { getBaileysSocket } from 'src/engine/core-modules/baileys/socket-gateway/socket.gateway';

// import { initApp } from 'src/engine/core-modules/baileys/baileys';


// @Controller('baileyswhatsapp')
// export class WhatsappBaileysController {
//   constructor(private socketGateway: SocketGateway) {}

//   // @Post('send')
//   // async sendMessage(@Body() body) {

//   //   initApp ( arxSocket : SocketGateway )
    
    
//   // }
//   @Post('upload-file')
//   async uploadFile(@Body() message: MessageDto) {
//     try {
//       await this.socketGateway.fileUpload(message);
//       return { status: 'success', message: 'File upload initiated' };
//     } catch (error) {
//       throw new HttpException({
//         status: HttpStatus.BAD_REQUEST,
//         error: 'Could not upload file',
//         message: error.message,
//       }, HttpStatus.BAD_REQUEST);
//     }
//   }
// }


@Controller('agent')
export class RecruitmentAgentController {
  @Post()
  async create(@Req() request: Request): Promise<string> {
      console.log("These are the request body", request.body);
      let chatResponseMessage: string = "";
      const userMessageBody: allDataObjects.chatMessageType | null = request?.body as allDataObjects.chatMessageType | null; // Type assertion
      console.log("This is the user message", userMessageBody);

      if (userMessageBody !== null) {
          const { phoneNumberFrom, messages } = userMessageBody;
          const userMessage: allDataObjects.chatMessageType = {
            phoneNumberFrom:phoneNumberFrom,
            phoneNumberTo:"918411937769",
            messages:messages,
            messageType:"string"
          };
          console.log("This is the user message", JSON.stringify(userMessage));
          let chatResponseMessagesResult = await new LLMChatAgent().runChatAgent(userMessage);
          chatResponseMessage = chatResponseMessagesResult.output;
          console.log("This is the chat response message", chatResponseMessage);
      }
      return chatResponseMessage;
  }
}

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
          const updateStatus = await new CandidateEngagement().updateAndSendWhatsappMessageAndCandidateEngagementStatusInTable(userMessage);
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

@Controller('whatsapp-test')
export class WhatsappTestAPI {
  @Post('template')
  async create(@Req() request: Request): Promise<object> {
    const defaultSendMessageObj = {
      "template_name":"recruitment",
      "recipient":"918411937769",
      "recruiterName":"John",
      "candidateFirstName":"Jane",
      "recruiterJobTitle":"Recruiter",
      "recruiterCompanyName": "Arxena",
      "recruiterCompanyDescription":"US Based Recruitment Company",
      "jobPositionName": "Sales Head",
      "jobLocation":"Surat"
    }
    const sendMessageObj: allDataObjects.sendWhatsappTemplateMessageObjectType = request.body as unknown as allDataObjects.sendWhatsappTemplateMessageObjectType;
    new FacebookWhatsappChatApi().sendWhatsappTemplateMessage(sendMessageObj);
    return {"status":"success"};
  }

  @Post('message')
  async createTextMessage(@Req() request: Request): Promise<object> {
    const sendTextMessageObj: allDataObjects.ChatRequestBody = {
      "phoneNumberTo": "918411937769",
      "phoneNumberFrom": "918411937769",
      "messages": "This is the panda talking",
    };
    new FacebookWhatsappChatApi().sendWhatsappTextMessage(sendTextMessageObj);
    return {"status":"success"};
  }
  @Post('uploadFile')
  async uploadFileToFBWAAPI(@Req() request: any): Promise<object> {
    console.log("upload file to whatsapp api");
    const requestBody = request.body;
    const filePath = requestBody?.filePath;
    const response = await new FacebookWhatsappChatApi().uploadFileToWhatsApp(filePath);
    return response || {}; // Return an empty object if the response is undefined
  }

  @Post('sendAttachment')
  async sendFileToFBWAAPIUser(@Req() request: Request): Promise<object> {
    console.log("Send file")
    console.log("Request bod::y::", request.body)
    const sendTextMessageObj = {
      "phoneNumberFrom": "918411937769",
      "attachmentMessage": "string",
      "phoneNumberTo": "918411937769",
      "mediaFileName" :"AttachmentFile",
      "mediaID" : "377908408596785"
    }
    new FacebookWhatsappChatApi().sendWhatsappAttachmentMessage(sendTextMessageObj)
    return {"status":"success"}
  }

  @Post('sendFile')
  async uploadAndSendFileToFBWAAPIUser(@Req() request: any): Promise<object> {
    const sendFileObj = request.body
    new FacebookWhatsappChatApi().uploadAndSendFileToWhatsApp(sendFileObj)
    return {"status":"success"}
  }

  @Post('downloadAttachment')
  async downloadFileToFBWAAPIUser(@Req() request: Request): Promise<object> {
    const downloadAttachmentMessageObj = { "media-id": "918411937769" }
    new FacebookWhatsappChatApi().downloadWhatsappAttachmentMessage(downloadAttachmentMessageObj)
    return {"status":"success"}
    }
  }

