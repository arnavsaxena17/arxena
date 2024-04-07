import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { runChatAgent } from './services/llm-agents/llm-chat-agent';
import { userMessageType } from 'src/engine/core-modules/recruitment-agent/services/data-model-objects';
import { JwtAuthGuard } from 'src/engine/guards/jwt.auth.guard';


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
}




// @UseGuards(JwtAuthGuard)
// @Controller('dogs')
// export class DogsController {
//   @Get()
//   findAll(@Req() request: Request): string {
//     const timenow = 'This action returns all dogs at time ::' + new Date().toLocaleString();
//     return timenow;
//   }
// }
