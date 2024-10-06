import { Controller, Post, UseInterceptors, UploadedFiles, Body, BadRequestException, Injectable } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import Configuration, { OpenAIApi } from 'openai';
import * as fs from 'fs';

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

@Controller('video-interview')
export class VideoInterviewController {
  constructor(private transcriptionService: TranscriptionService) {}

  @Post('upload')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'video', maxCount: 1 },
        { name: 'audio', maxCount: 1 },
      ],
      {
        storage: multer.diskStorage({
          destination: './uploads',
          filename: (req, file, callback) => {
            callback(null, file.originalname);
          },
        }),
        limits: { fileSize: 100 * 1024 * 1024 }, // 100MB file size limit
        fileFilter: (req, file, callback) => {
          if (file.fieldname === 'video' && file.mimetype !== 'video/webm') {
            return callback(new BadRequestException('Only webm files are allowed'), false);
          }
          if (file.fieldname === 'audio' && file.mimetype !== 'audio/wav') {
            return callback(new BadRequestException('Only WAV files are allowed'), false);
          }
          callback(null, true);
        },
      },
    ),
  )
  async handleMultipartData(@UploadedFiles() files: { video?: Express.Multer.File[]; audio?: Express.Multer.File[] }, @Body() body: any) {
    console.log('Uploaded Files:', files);
    console.log('Form Data:', body);

    // Check if files are present
    if (!files.audio || !files.video) {
      throw new BadRequestException('Both audio and video files are required');
    }

    const audioFile = files.audio[0];
    const videoFile = files.video[0];

    try {
      const transcript = await this.transcriptionService.transcribeAudio(audioFile.path);

      return {
        message: 'Files uploaded and audio transcribed successfully',
        transcript: transcript,
        videoFile: videoFile.filename,
        audioFile: audioFile.filename,
        formData: body,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error processing the upload');
    }
  }
}
