import { Controller, Post, Body, UploadedFile, Req, UseInterceptors, InternalServerErrorException, Logger, HttpException, HttpStatus, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from 'src/engine/guards/jwt.auth.guard';
import { Express } from 'express';

// import { FileInterceptor } from '@nestjs/platform-express';
import OpenAI from 'openai';
import { createReadStream } from 'fs';
// import { FileInterceptor } from '@nestjs/platform-express';
import { TranscriptionService } from 'src/engine/core-modules/video-interview/transcription.service';
import { Multer } from 'multer';
import { de } from 'date-fns/locale';
import { extname } from 'path';
import * as multer from 'multer';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';

// @Controller('video-interview')
// export class VideoInterviewController {
//     constructor(private readonly transcriptionService: TranscriptionService) {}

//     @Post('transcribe')
//     // @UseGuards(JwtAuthGuard)
//     @UseInterceptors(FileInterceptor('file'))

//     async transcribeVideo(
//       @Req() request: Request,
//       @Body() body: any,
//       @Query('question') question: string,
//       @Query('question2') question2: string,
//       @Query('model') model: string,
//       @UploadedFile() file: Express.Multer.File,

//     ): Promise<string>  {
//       console.log("These are the /request body", request.body);
//       // console.log("These are the /request ", request);
//       console.log("These are the /body", body);
//       console.log("These are the /request body question", question);
//       console.log("These are the /request body question2", question2);
//       console.log("These are the /request model", model);
//       //@ts-ignore
//       console.log("These are the /request body model", request?.body?.model);
//       console.log(file);
//       console.log("transcribeVideo");
//       const defaultModel = 'whisper-1'; // default model, can be replaced with @Query('model') model: string
//       const transcription = await this.transcriptionService.transcribeVideo(file, question, model || defaultModel);
//       return  defaultModel;
//     }
// }

@Controller('video-interview')
export class VideoInterviewController {
  @Post('upload')
  @UseInterceptors(
    FileInterceptor(
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
        limits: { fileSize: 100 * 1024 * 1024 }, // 10MB file size limit
        fileFilter: (req, file, callback) => {
          if (file.mimetype !== 'audio/wav') {
            return callback(new BadRequestException('Only WAV files are allowed'), false);
          }
          callback(null, true);
        },
      },
    ),
  )
  handleMultipartData(@UploadedFile() file: any, @Body() body: any) {
    console.log('Uploaded File:', file);
    console.log('Form Data:', body);

    // Check if file is present
    if (!file) {
      throw new BadRequestException('File is required');
    }

    return {
      message: 'File and form data received successfully',
      formData: body,
    };
  }
}

// @Controller('video-interview')
// export class VideoInterviewController {
//   private openai: OpenAIApi;

//   constructor() {
//     const configuration = new Configuration({
//       apiKey: process.env.OPENAI_API_KEY,
//     });
//     this.openai = new OpenAIApi(configuration);
//   }

//   @Post()
//   @UseInterceptors(FileInterceptor('file'))
//   async transcribe(@UploadedFile() videoFile: Express.Multer.File) {
//       const file = createReadStream(videoFile.path) as unknown as File;

//       const resp = await this.openai.createTranscription(
//         file,
//         videoFile.path, // Fix: Pass the path of the video file as a string
//         'whisper-1',
//         // Uncomment the line below if you would also like to capture filler words:
//         // "Please include any filler words such as 'um', 'uh', 'er', or other disfluencies in the transcription. Make sure to also capitalize and punctuate properly."
//       );

//       const transcript = resp?.data?.text;

//       // Content moderation check
//       const moderationResponse = await this.openai.createModeration({
//         input: transcript,
//       });

//       if (moderationResponse?.data?.results[0]?.flagged) {
//         throw new HttpException('Inappropriate content detected. Please try again.', HttpStatus.BAD_REQUEST);
//       }

//       return { transcript };
//     } catch (error) {
//       console.error('server error', error);
//       throw new HttpException('Error', HttpStatus.INTERNAL_SERVER_ERROR);
//     }
//   }
