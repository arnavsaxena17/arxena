// import { CandidateSourcingController } from './controllers/candidate-sourcing.controller';
// import { JobService } from './services/job.service';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AvatarService } from './services/avatar.service';
import { LlmService } from './services/llm.service';
import { SpeechService } from './services/speech.service';
import { InterviewGateway } from './websocket/interview.gateway';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    HttpModule,
  ],
  controllers: [],
  providers: [
    // JobService,
    InterviewGateway,
    AvatarService,
    SpeechService,
    LlmService,
  ],
  exports: [AvatarService, SpeechService, LlmService],
})
export class ArxInterviewsModule {}
