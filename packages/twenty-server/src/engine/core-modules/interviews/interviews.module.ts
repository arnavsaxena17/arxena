// // avatar.module.ts
// import { HttpService } from '@nestjs/axios';
// import { Module } from '@nestjs/common';

// import { ConfigModule } from '@nestjs/config';
// import { InterviewController } from './interviews.controller';
// import { InterviewService } from './interviews.service';

// @Module({
//   imports: [
//     HttpService,
//     ConfigModule.forRoot(), // To load environment variables
//   ],
//   controllers: [InterviewController],
//   providers: [InterviewService],
// })
// export class InterviewModule {}