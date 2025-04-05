import { Body, Controller, Post } from '@nestjs/common';

import { InterviewsService } from './interviews.service';

@Controller('interviews')
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Post('start')
  async startInterview() {
    // Create a new Interview session
    return await this.interviewsService.createInterviewSession();
  }

  @Post('speech')
  async processSpeech(@Body() body: { sessionId: string; text: string }) {
    const { sessionId, text } = body;

    return await this.interviewsService.handleIntervieweeSpeech(
      sessionId,
      text,
    );
  }
}
