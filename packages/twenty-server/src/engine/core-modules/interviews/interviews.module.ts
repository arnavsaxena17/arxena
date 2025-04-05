import { Module } from '@nestjs/common';

import { HeygenModule } from 'src/engine/core-modules/heygen/heygen.module';

import { InterviewsController } from './interviews.controller';
import { InterviewsService } from './interviews.service';

@Module({
  imports: [HeygenModule],
  controllers: [InterviewsController],
  providers: [InterviewsService],
})
export class InterviewsModule {}
