import { Injectable } from '@nestjs/common';
import { ProcessResumeUploadsJobData } from 'twenty-shared';

import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { QueueCronJobOptions } from 'src/engine/core-modules/message-queue/drivers/interfaces/job-options.interface';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { ResumeUploadQueueProcessor } from './process-resume-uploads.job';

@Injectable()
export class ProcessResumeUploadsService {
  constructor(
    @InjectMessageQueue(MessageQueue.resumeUploadQueue)
    private readonly messageQueueService: MessageQueueService,
  ) {}

  /**
   * Queue resume files for processing
   */
  async queueResumeUpload(
    filePaths: string[],
    projectId: string,
    jobName: string,
    userId: string,
    origin: string,
    apiToken: string,
  ): Promise<void> {
    try {
      console.log(`Queueing ${filePaths.length} resume files for processing`);

      const queueJobOptions: QueueCronJobOptions = {
        retryLimit: 3,
        priority: 1,
        repeat: { every: 1000 },
      };

      const jobData: ProcessResumeUploadsJobData = {
        filePaths,
        projectId,
        jobName,
        userId,
        apiToken,
        timestamp: new Date().toISOString(),
        origin,
      };

      // Create unique job ID to prevent duplicate processing
      const uniqueProjectId = `resume-upload-${projectId}-${userId}`;
      
      await this.messageQueueService.add<ProcessResumeUploadsJobData>(
        ResumeUploadQueueProcessor.name,
        jobData,
        {
          ...queueJobOptions,
          id: uniqueProjectId, // Add unique ID to prevent duplicates
        },
      );

      console.log(`Successfully queued resume upload job for ${filePaths.length} files`);
    } catch (error) {
      console.error('Failed to queue resume upload processing:', error);
      throw error;
    }
  }
}
