import { Module } from '@nestjs/common';

// import { NestjsFormDataModule } from 'nestjs-form-data';  
import { VideoInterviewController } from 'src/engine/core-modules/video-interview/video-interview.controller';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
// import { TranscriptionService } from 'src/engine/core-modules/video-interview/transcription.service';


@Module({
  imports: [AuthModule],
  controllers: [VideoInterviewController],
  providers: [],
  exports: [],
})
export class VideoInterviewModule {}
