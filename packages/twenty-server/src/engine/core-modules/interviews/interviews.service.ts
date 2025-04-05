import { Injectable } from '@nestjs/common';

import { HeygenService } from 'src/engine/core-modules/heygen/heygen.service';

@Injectable()
export class InterviewsService {
  constructor(private readonly heygenService: HeygenService) {}

  async createInterviewSession() {
    // Possibly store session in DB, etc.
    return { sessionId: 'some-unique-id' };
  }

  async handleIntervieweeSpeech(sessionId: string, audioTranscription: string) {
    // 1. Parse STT text
    // 2. Send the question or statement to your LLM
    // 3. Get the LLM's answer
    // 4. Send the LLM’s answer to the avatar

    const llmResponse =
      `Responding to: ${audioTranscription} ...` +
      `\n(Here is the AI's answer)`;

    // Suppose we have stored a "streamId" for this session
    const streamId = 'abc123';

    await this.heygenService.sendDialogueToAvatar(streamId, llmResponse);

    return llmResponse;
  }
}
