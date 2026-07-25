import { Injectable } from '@nestjs/common';
import { GmailDraftShortlistJobData } from 'twenty-shared';

import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { QueueCronJobOptions } from 'src/engine/core-modules/message-queue/drivers/interfaces/job-options.interface';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';

@Injectable()
export class GmailDraftShortlistQueueService {
  constructor(
    @InjectMessageQueue(MessageQueue.gmailDraftShortlistQueue)
    private readonly messageQueueService: MessageQueueService,
  ) {}

  async send(
    candidateIds: string[],
    origin: string,
    apiToken: string,
    projectId?: string,
    jobName?: string,
    batchName?: string,
    timestamp?: string,
  ): Promise<void> {
    try {
      console.log(`Queueing Gmail draft shortlist creation for ${candidateIds.length} candidates`);

      const jobData: GmailDraftShortlistJobData = {
        candidateIds,
        origin,
        apiToken,
        projectId,
        jobName,
        batchName,
        timestamp,
      };

      const queueJobOptions: QueueCronJobOptions = {
        retryLimit: 3,
        priority: 1,
        repeat: { every: 1000 },
      };

      // Create unique job ID to prevent duplicate processing
      const uniqueProjectId = `gmail-draft-shortlist-${projectId || 'default'}-${candidateIds.length}`;
      
      await this.messageQueueService.add<GmailDraftShortlistJobData>(
        'GmailDraftShortlistQueueProcessor',
        jobData,
        {
          ...queueJobOptions,
          id: uniqueProjectId, // Add unique ID to prevent duplicates
        },
      );

      console.log(`Successfully queued Gmail draft shortlist creation for candidates: ${candidateIds.join(', ')}`);
    } catch (error) {
      console.log('Failed to queue Gmail draft shortlist creation:', error);
      throw error;
    }
  }
}
