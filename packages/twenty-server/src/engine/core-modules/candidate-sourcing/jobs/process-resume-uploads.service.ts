import { Injectable } from '@nestjs/common';
import { ProcessResumeUploadsJobData } from 'twenty-shared';

import { QueueCronJobOptions } from 'src/engine/core-modules/message-queue/drivers/interfaces/job-options.interface';
import { ResumeUploadQueueProcessor } from './process-resume-uploads.job';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';

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
    jobId: string,
    jobName: string,
    userId: string,
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
        jobId,
        jobName,
        userId,
        apiToken,
        timestamp: new Date().toISOString(),
      };

      await this.messageQueueService.add<ProcessResumeUploadsJobData>(
        ResumeUploadQueueProcessor.name,
        jobData,
        queueJobOptions,
      );

      console.log(`Successfully queued resume upload job for ${filePaths.length} files`);
    } catch (error) {
      console.error('Failed to queue resume upload processing:', error);
      throw error;
    }
  }
}
