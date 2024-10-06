import { Module } from '@nestjs/common';

// import { NestjsFormDataModule } from 'nestjs-form-data';
import { VideoInterviewController } from 'src/engine/core-modules/video-interview/video-interview.controller';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { TranscriptionService } from 'src/engine/core-modules/video-interview/transcription.service';
import { MulterModule } from '@nestjs/platform-express';

@Module({
  imports: [
    AuthModule,
    MulterModule.register({
      dest: './uploads',
    }),
  ],
  controllers: [VideoInterviewController],
  providers: [TranscriptionService],
  exports: [],
})
export class VideoInterviewModule {}
