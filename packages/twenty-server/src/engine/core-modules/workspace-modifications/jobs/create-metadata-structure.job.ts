// import { Logger, Scope } from '@nestjs/common';

// import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
// import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
// import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
// import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

// export type CreateMetadataStructureJobData = {
//   token: string;
//   origin: string;
// };

// @Processor({
//   queueName: MessageQueue.onboardingQueue,
//   scope: Scope.REQUEST,
// })
// export class CreateMetadataStructureJob {
//   protected readonly logger = new Logger(CreateMetadataStructureJob.name);

//   constructor(private readonly workspaceQueryService: WorkspaceQueryService) {}

//   @Process(CreateMetadataStructureJob.name)
//   async handle(data: CreateMetadataStructureJobData): Promise<void> {
//     this.logger.log('CreateMetadataStructure job started');
//     try {
//       await this.workspaceQueryService.createMetadataStructure(
//         data.token,
//         data.origin,
//       );
//       this.logger.log('CreateMetadataStructure job completed');
//     } catch (error) {
//       this.logger.error(
//         `CreateMetadataStructure job failed: ${error instanceof Error ? error.message : String(error)}`,
//       );
//       throw error;
//     }
//   }
// }
