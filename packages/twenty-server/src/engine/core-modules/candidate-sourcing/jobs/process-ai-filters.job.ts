import { Injectable } from '@nestjs/common';
import { ProcessAiFiltersJobData } from 'twenty-shared';

import { AiFilteringService } from 'src/engine/core-modules/candidate-sourcing/services/ai-filtering.service';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';

@Processor(MessageQueue.aiFilteringQueue)
@Injectable()
export class AiFiltersQueueProcessor {
  constructor(
    private readonly aiFilteringService: AiFilteringService,
  ) {}

  @Process(AiFiltersQueueProcessor.name)
  async handle(jobData: ProcessAiFiltersJobData): Promise<void> {
    console.log(`Processing AI filters job: ${jobData.batchName || 'Unknown'}`);

    try {
      const request = {
        aiFilters: jobData.aiFilters,
        objectNameSingular: jobData.objectNameSingular,
        availableSortDefinitions: jobData.availableSortDefinitions,
        availableFilterDefinitions: jobData.availableFilterDefinitions,
        objectRecordId: jobData.objectRecordId,
        selectedRecordIds: jobData.selectedRecordIds,
        jobId: jobData.jobId,
      };

      const result = await this.aiFilteringService.processAiFilters(
        request,
        jobData.apiToken,
        jobData.origin,
      );

      if (result.status === 'Success') {
        console.log(`Successfully processed AI filters job: ${jobData.batchName || 'Unknown'}`);
      } else {
        console.error(`AI filters job failed: ${jobData.batchName || 'Unknown'}`, result.error);
        throw new Error(result.error || 'AI filter processing failed');
      }
    } catch (error) {
      console.error(
        `AI filters job processing failed: ${jobData.batchName || 'Unknown'}`,
        error,
      );
      throw error;
    }
  }
}
