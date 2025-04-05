import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { HeygenService } from './heygen.service';

@ApiTags('HeyGen')
@Controller('heygen')
export class HeygenController {
  constructor(private readonly heygenService: HeygenService) {}

  @Post('token')
  @ApiOperation({ summary: 'Get HeyGen API token' })
  @ApiResponse({ status: 200, description: 'Returns the API token' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - API key not configured',
  })
  async getToken() {
    return await this.heygenService.getToken();
  }

  @Post('start')
  @ApiOperation({ summary: 'Start streaming avatar' })
  @ApiResponse({ status: 200, description: 'Returns the stream ID' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async startAvatar() {
    // For example usage from the frontend:
    // fetch('http://localhost:3001/heygen/start', { method: 'POST' })
    return await this.heygenService.startStreamingAvatar();
  }

  @Post('speak')
  @ApiOperation({ summary: 'Send dialogue to avatar' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async speak(@Body() body: { streamId: string; text: string }) {
    const { streamId, text } = body;

    await this.heygenService.sendDialogueToAvatar(streamId, text);

    return { success: true };
  }

  @Post('stop')
  @ApiOperation({ summary: 'Stop streaming avatar' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async stop(@Body() body: { streamId: string }) {
    await this.heygenService.stopStreamingAvatar(body.streamId);

    return { success: true };
  }
}
