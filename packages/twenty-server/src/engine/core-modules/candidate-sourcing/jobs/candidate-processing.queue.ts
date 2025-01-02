import { Injectable, Logger } from '@nestjs/common';
import { MessageQueue } from 'src/engine/integrations/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/integrations/message-queue/services/message-queue.service';
import { InjectMessageQueue } from 'src/engine/integrations/message-queue/decorators/message-queue.decorator';
import { CandidateProcessingJob } from './candidate-processing.job';
import * as CandidateSourcingTypes from '../types/candidate-sourcing-types';

@Injectable()
export class CandidateQueueService {
  private readonly logger = new Logger(CandidateQueueService.name);

  constructor(
    @InjectMessageQueue(MessageQueue.candidateProcessingQueue)
    private readonly messageQueueService: MessageQueueService,
  ) {}

  async queueCandidateProcessing(
    data: CandidateSourcingTypes.UserProfile[],
    jobId: string,
    jobName: string,
    timestamp: string,
    apiToken: string
): Promise<void> {
    try {
      console.log('Queueing candidate processing:', {
        candidatesCount: data.length,
        jobId,
        timestamp
      });

      const jobData = {
        data,
        jobId,
        jobName,
        timestamp,
        apiToken
      };

      const job = await this.messageQueueService.add(
        CandidateProcessingJob.name,
        jobData,
        {
            retryLimit: 3,

        }
      );

    } catch (error) {
      this.logger.error('Failed to queue candidate processing:', error);
      throw error;
    }
  }
}