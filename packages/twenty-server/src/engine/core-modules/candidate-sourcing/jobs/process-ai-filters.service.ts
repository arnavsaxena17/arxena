import { Injectable } from '@nestjs/common';
import { ProcessAiFiltersJobData } from 'twenty-shared';

import { AiFiltersQueueProcessor } from 'src/engine/core-modules/candidate-sourcing/jobs/process-ai-filters.job';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { QueueCronJobOptions } from 'src/engine/core-modules/message-queue/drivers/interfaces/job-options.interface';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';

export interface ProcessAiFiltersRequest {
  aiFilters: any[];
  objectNameSingular: string;
  availableSortDefinitions: any[];
  availableFilterDefinitions: any[];
  objectRecordId: string;
  selectedRecordIds: string[];
  projectId: string;
}

@Injectable()
export class ProcessAiFiltersService {
  constructor(
    @InjectMessageQueue(MessageQueue.aiFilteringQueue)
    private readonly messageQueueService: MessageQueueService,
  ) {}

  async send(
    request: ProcessAiFiltersRequest,
    apiToken: string,
    origin: string,
  ): Promise<void> {
    try {
      console.log(`Queueing AI filter processing for ${request.aiFilters.length} AI filters`);

      const timestamp = new Date().toISOString();
      const batchName = `AI Filter Processing - ${timestamp}`;

      const jobData: ProcessAiFiltersJobData = {
        aiFilters: request.aiFilters,
        objectNameSingular: request.objectNameSingular,
        availableSortDefinitions: request.availableSortDefinitions,
        availableFilterDefinitions: request.availableFilterDefinitions,
        objectRecordId: request.objectRecordId,
        selectedRecordIds: request.selectedRecordIds,
        projectId: request.projectId,
        batchName,
        timestamp,
        apiToken,
        origin,
      };

      const queueJobOptions: QueueCronJobOptions = {
        retryLimit: 3,
        priority: 1,
        repeat: { every: 1000 },
      };

      const uniqueProjectId = `ai-filtering-${request.projectId}-${request.objectRecordId}`;

      await this.messageQueueService.add<ProcessAiFiltersJobData>(
        AiFiltersQueueProcessor.name,
        jobData,
        {
          ...queueJobOptions,
          id: uniqueProjectId,
        },
      );

      console.log('Successfully queued AI filter processing job');
    } catch (error) {
      console.log('Failed to queue AI filter processing:', error);
      throw error;
    }
  }
}
