import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { TestArxChat } from '../services/test-arx-chat';

@Controller('test-arx-chat')
export class TestArxChatController {
  constructor(private readonly testArxChat: TestArxChat) {}

  @Post('test-chat-flow')
  @UseGuards(JwtAuthGuard)
  async testChatFlow(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1];
      return await this.testArxChat.testChatFlow(apiToken);
    } catch (error) {
      console.error('Error in test chat flow controller:', error);
      return {
        status: 'Failed',
        error: error.message
      };
    }
  }
} 