import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
// import { runChatAgent } from './services/llm-agents/llm-chat-agent';
import { LLMChatAgent } from 'src/engine/core-modules/recruitment-agent/services/llm-agents/llm-chat-agent';
import { JwtAuthGuard } from 'src/engine/guards/jwt.auth.guard';
import { candidateChatMessageType, chatMessageType, userMessageType, emptyCandidateProfileObj, sendWhatsappTemplateMessageObjectType, sendingAndIncomingwhatsappTextMessageType } from 'src/engine/core-modules/recruitment-agent/services/data-model-objects';

import { FacebookWhatsappChatApi } from './services/whatsapp-api/facebook-whatsapp-api';
import { UpdateChat } from './services/candidateEngagement/updateChat';
import CandidateEngagement from './services/candidateEngagement/checkCandidateEngagement';


interface UserRequestBody {
    phoneNumber: string;
    messages: any[]; // Adjust the type according to the structure of 'messages'
}


interface ChatRequestBody {
  phoneNumberFrom: string;
  phoneNumberTo: string;
  messages: any[]; // Adjust the type according to the structure of 'messages'
}


@Controller('agent')
export class RecruitmentAgentController {
  @Post()
  async create(@Req() request: Request): Promise<string> {
      console.log("These are the request body", request.body);
      let chatResponseMessage: string = "";
      const userMessageBody: UserRequestBody | null = request?.body as UserRequestBody | null; // Type assertion
      console.log("This is the user message", userMessageBody);

      if (userMessageBody !== null) {
          const { phoneNumber, messages } = userMessageBody;
          const userMessage: userMessageType = {
              phoneNumber,
              messages
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
      const userMessageBody: ChatRequestBody | null = request?.body as ChatRequestBody | null; // Type assertion
      console.log("This is the user message", userMessageBody);

      if (userMessageBody !== null) {
          const { phoneNumberFrom, phoneNumberTo, messages } = userMessageBody;

          const userMessage: candidateChatMessageType = {

              phoneNumberFrom,
              phoneNumberTo,
              messages,
              candidateFirstName: '',
              messageType: "candidateMessage",
              candidateProfile : emptyCandidateProfileObj

          };
          const updateStatus = await new UpdateChat().updateWhatsappMessageAndCandidateStatusInTable(userMessage);
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
      if (!requestBody?.entry[0]?.changes[0]?.value?.statuses) {
        console.log("There is a request body for sure", requestBody?.entry[0]?.changes[0]?.value?.messages[0])
        const userMessageBody = requestBody?.entry[0]?.changes[0]?.value?.messages[0];
        
        if (userMessageBody) {
          console.log("There is a usermessage body in the request", userMessageBody)
          if (requestBody?.entry[0]?.changes[0]?.value?.messages[0].type !== "utility") {
            console.log("We have a whatsapp incoming message which is a text one we have to do set of things with which is not a utility message")
            const phoneNumberTo = requestBody?.entry[0]?.changes[0]?.value?.metadata?.display_phone_number
            const whatsappIncomingMessage: chatMessageType = {
              phoneNumberFrom: userMessageBody.from,
              phoneNumberTo: phoneNumberTo,
              messages: [{"role":"user","content":userMessageBody.text.body}],
              messageType : "string"
            };
            const chatReply = userMessageBody.text.body
            console.log("We will first go and get the candiate who sent us the message")
            const candidateProfileData = await new UpdateChat().getCandidateInformation(whatsappIncomingMessage);
            console.log("This is the candiate who has sent us the message., we have to update the database that this message has been recemivged::", chatReply)
            console.log("This is the candiate who has sent us candidateProfileData::", candidateProfileData)
            const whatappUpdateMessageObj = await new CandidateEngagement().createAndUpdateCandidateChatMessage(chatReply, candidateProfileData)
          }
        }
      } else {
        console.log("Message of type:", requestBody?.entry[0]?.changes[0]?.value?.statuses[0]?.status, ", ignoring it");
      }
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
    const sendMessageObj: sendWhatsappTemplateMessageObjectType = request.body as unknown as sendWhatsappTemplateMessageObjectType;
    new FacebookWhatsappChatApi().sendWhatsappTemplateMessage(sendMessageObj);
    return {"status":"success"};
  }

  @Post('message')
  async createTextMessage(@Req() request: Request): Promise<object> {
    const sendTextMessageObj: sendingAndIncomingwhatsappTextMessageType = {
      "phoneNumberTo": "918411937769",
      "phoneNumberFrom": "918411937769",
      "text": "This is the panda talking",
    };
    new FacebookWhatsappChatApi().sendWhatsappTextMessage(sendTextMessageObj);
    return {"status":"success"};
  }


  @Post('uploadfile')
  async uploadFileToFBWAAPI(@Req() request: Request): Promise<object> {
    new FacebookWhatsappChatApi().uploadFileToWhatsApp()
    return {"status":"success"}
  }

  @Post('sendAttachment')
  async sendFileToFBWAAPIUser(@Req() request: Request): Promise<object> {
    const sendTextMessageObj:sendingAndIncomingwhatsappTextMessageType = {
      "phoneNumberTo": "918411937769",
      "phoneNumberFrom": "918411937769",
      "text": "This is the panda talking",
    }
    new FacebookWhatsappChatApi().sendWhatsappAttachmentMessage(sendTextMessageObj)
    return {"status":"success"}
    }



  @Post('downloadAttachment')
  async downloadFileToFBWAAPIUser(@Req() request: Request): Promise<object> {
    const downloadAttachmentMessageObj = {
      "media-id": "918411937769",
    }
    new FacebookWhatsappChatApi().downloadWhatsappAttachmentMessage(downloadAttachmentMessageObj)
    return {"status":"success"}
    }


  }

