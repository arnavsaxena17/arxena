// import { CandidateNode, ChatControlsObjType, Job } from 'twenty-shared';

// import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
// import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
// import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
// import { CandidateEngagementArx } from '../services/candidate-engagement/candidate-engagement';

// export interface ProcessEngagementJobData {
//   candidate: CandidateNode;
//   candidateJob: Job;
//   chatControl: ChatControlsObjType;
//   apiToken: string;
// }

// @Processor(MessageQueue.chatEngagementQueue)
// export class ChatEngagementQueueProcessor {
//   constructor(
//     private readonly candidateEngagementService: CandidateEngagementArx,
//   ) {
//     console.log('EngagementQueueProcessor initialized');
//   }

//   @Process(ChatEngagementQueueProcessor.name)
//   async handle(jobData: ProcessEngagementJobData): Promise<void> {
//     const { candidate, candidateJob, chatControl, apiToken } = jobData;

//     try {
//       console.log(
//         `Processing engagement for candidate ${candidate.name} with chat control ${chatControl.chatControlType}`,
//       );

//       await this.candidateEngagementService.processCandidate(
//         candidate,
//         candidateJob,
//         chatControl,
//         apiToken,
//       );

//       console.log(
//         `Successfully processed engagement for candidate ${candidate.name}`,
//       );
//     } catch (error) {
//       console.error(
//         `Engagement processing failed for candidate ${candidate.name}:`,
//         error,
//       );
//       throw error;
//     }
//   }
// } 