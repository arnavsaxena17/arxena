import { Injectable, BadRequestException } from '@nestjs/common';
import { Configuration, OpenAIApi } from 'openai';
import * as fs from 'fs';
import { Multer } from 'multer';

@Injectable()
export class TranscriptionService {
  async transcribeVideo(file: Express.Multer.File, question: string, model: string): Promise<string> {
    // Logic to transcribe the video file using the specified question and model
    // You can use any transcription library or service here
    const transcription = `Transcription of "${question}" from file ${file.originalname} using model ${model}`;
    return transcription;
  }
}
