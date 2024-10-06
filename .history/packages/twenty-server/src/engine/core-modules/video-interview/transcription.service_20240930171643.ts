import { Injectable, BadRequestException } from '@nestjs/common';
import OpenAI from 'openai';
import * as fs from 'fs';
import { Multer } from 'multer';

@Injectable()
export class TranscriptionService {
  private openai: OpenAIApi;

  constructor() {
    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.openai = new OpenAIApi(configuration);
  }

  async transcribeAudio(audioFilePath: string): Promise<string> {
    try {
      const resp = await this.openai.createTranscription(fs.createReadStream(audioFilePath), 'whisper-1');

      const transcript = resp?.data?.text;

      // Content moderation check
      const response = await this.openai.createModeration({
        input: transcript,
      });

      if (response?.data?.results[0]?.flagged) {
        throw new BadRequestException('Inappropriate content detected. Please try again.');
      }

      return transcript;
    } catch (error) {
      console.error('Transcription error', error);
      throw new BadRequestException('Error during transcription');
    }
  }
}
