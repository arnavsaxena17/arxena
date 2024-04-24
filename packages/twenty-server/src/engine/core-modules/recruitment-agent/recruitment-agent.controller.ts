import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { runChatAgent } from './services/llm-agents/llm-chat-agent';
import { JwtAuthGuard } from 'src/engine/guards/jwt.auth.guard';
import { candidateChatMessageType, chatMessageType, userMessageType, sendWhatsappTemplateMessageObjectType, sendwhatsappTextMessageType } from 'src/engine/core-modules/recruitment-agent/services/data-model-objects';
import  updateWhatsappMessage  from './services/candidateEngagement/updateChat';
import { sendWhatsappTextMessage, sendWhatsappTemplateMessage, downloadWhatsappAttachmentMessage, uploadFileToWhatsApp, sendWhatsappAttachmentMessage } from './services/whatsapp-api/facebook-whatsapp-api';


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

          let chatResponseMessagesResult = await runChatAgent(userMessage);
          chatResponseMessage = chatResponseMessagesResult.output;
          console.log("This is the chat response message", chatResponseMessage);
      }
      return chatResponseMessage;
  }
}


@Controller('updateChat')
export class UpdateChat {
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
              candidateProfile : {
                first_name: '',
                id: '',
                jobsId: '',
                job: {
                  name: '',
                  company : {
                    name: '',
                    descriptionOneliner: ''
                  },
                  jobLocation: '',
                },
                status: '',
                phoneNumber: '',
                email: '',
                responsibleWorkspaceMemberId: '',
                input: 'string', // Add the 'input' property
              }

          };
          const updateStatus = await updateWhatsappMessage(userMessage);
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
        const userMessageBody = requestBody?.entry[0]?.changes[0]?.value?.messages[0];
        if (userMessageBody) {
          if (requestBody?.entry[0]?.changes[0]?.statuses[0]?.origin?.type !== "utility") {
            const { from, id, text } = userMessageBody;
            const userMessage: candidateChatMessageType = {
              phoneNumberFrom: from,
              candidateFirstName: '',
              phoneNumberTo: requestBody?.entry[0]?.changes[0]?.value?.metadata?.display_phone_number, 
              messages: [{"role":"user","content":text}],
              messageType: "candidateMessage",
              candidateProfile: {
                first_name: '',
                id: '',
                jobsId: '',
                job: {
                  name: '',
                  company: {
                    name: '',
                    descriptionOneliner: ''
                  },
                  jobLocation: '',
                
                },
                status: '',
                phoneNumber: from,
                email: '',
                responsibleWorkspaceMemberId: '',
                input: 'string',
              }
            };
            const updateStatus = await updateWhatsappMessage(userMessage);
            console.log("This is the update status", updateStatus);
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
    sendWhatsappTemplateMessage(sendMessageObj);
    return {"status":"success"};
  }

  @Post('message')
  async createTextMessage(@Req() request: Request): Promise<object> {
    const sendTextMessageObj: sendwhatsappTextMessageType = {
      "recipient": "918411937769",
      "text": "This is the panda talking",
    };
    sendWhatsappTextMessage(sendTextMessageObj);
    return {"status":"success"};
  }


  @Post('uploadfile')
  async uploadFileToFBWAAPI(@Req() request: Request): Promise<object> {
    uploadFileToWhatsApp()
    return {"status":"success"}
  }

  @Post('sendAttachment')
  async sendFileToFBWAAPIUser(@Req() request: Request): Promise<object> {
    const sendTextMessageObj:sendwhatsappTextMessageType = {
      "recipient": "918411937769",
      "text": "This is the panda talking",
    }
    sendWhatsappAttachmentMessage(sendTextMessageObj)
    return {"status":"success"}
    }



  @Post('downloadAttachment')
  async downloadFileToFBWAAPIUser(@Req() request: Request): Promise<object> {
    const downloadAttachmentMessageObj = {
      "media-id": "918411937769",
    }
    downloadWhatsappAttachmentMessage(downloadAttachmentMessageObj)
    return {"status":"success"}
    }
  




  }

