import { Controller, Get, Post, Req } from '@nestjs/common';
import { runChatAgent } from './services/llmAgents/llmChatAgent';
import { request } from 'express';
import { userMessageType } from 'src/engine/core-modules/recruitment-agent/services/dataModelObjects';


interface UserRequestBody {
    phoneNumber: string;
    messages: any[]; // Adjust the type according to the structure of 'messages'
  }
  
  

@Controller('agent')
export class RecruitmentAgentController {
  @Post()
async create(@Req() request: Request): Promise<string> {
    console.log("These are the request body", request.body);
    let chatResponseMessage: string = "";

    console.log("These are the request body", request.body);
    // console.log("These are the request headers", req.headers);
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

  @Get()
  findAll(@Req() request: Request): string {
    console.log("These are the request body", request.body);    
    return 'This action returns all agents';
  }
}
