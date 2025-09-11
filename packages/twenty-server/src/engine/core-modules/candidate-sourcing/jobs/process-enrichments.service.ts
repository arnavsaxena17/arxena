import { Injectable } from '@nestjs/common';
import { ProcessEnrichmentsJobData } from 'twenty-shared';

import { EnrichmentQueueProcessor } from 'src/engine/core-modules/candidate-sourcing/jobs/process-enrichments.job';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { QueueCronJobOptions } from 'src/engine/core-modules/message-queue/drivers/interfaces/job-options.interface';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';

export interface ProcessEnrichmentsRequest {
  enrichments: any[];
  objectNameSingular: string;
  availableSortDefinitions: any[];
  availableFilterDefinitions: any[];
  objectRecordId: string;
  selectedRecordIds: string[];
  jobId: string;
}

@Injectable()
export class ProcessEnrichmentsService {
  constructor(
    @InjectMessageQueue(MessageQueue.enrichmentQueue)
    private readonly messageQueueService: MessageQueueService,
  ) {}

  async send(
    request: ProcessEnrichmentsRequest,
    apiToken: string,
    origin: string,
    jobObject: any,
  ): Promise<void> {
    try {
      console.log(`Queueing enrichment processing for ${request.enrichments.length} enrichments`);

      const timestamp = new Date().toISOString();
      const batchName = `Enrichment Processing - ${timestamp}`;

      const jobData: ProcessEnrichmentsJobData = {
        enrichments: request.enrichments,
        objectNameSingular: request.objectNameSingular,
        availableSortDefinitions: request.availableSortDefinitions,
        availableFilterDefinitions: request.availableFilterDefinitions,
        objectRecordId: request.objectRecordId,
        selectedRecordIds: request.selectedRecordIds,
        jobId: request.jobId,
        batchName,
        timestamp,
        apiToken,
        origin,
        jobObject,
      };

      const queueJobOptions: QueueCronJobOptions = {
        retryLimit: 3,
        priority: 1,
        repeat: { every: 1000 },
      };

      console.log(`Queueing enrichment processing job: ${batchName}`);

      await this.messageQueueService.add<ProcessEnrichmentsJobData>(
        EnrichmentQueueProcessor.name,
        jobData,
        queueJobOptions,
      );

      console.log('Successfully queued enrichment processing job');
    } catch (error) {
      console.log('Failed to queue enrichment processing:', error);
      throw error;
    }
  }
}
