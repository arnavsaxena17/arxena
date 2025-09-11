import { Injectable } from '@nestjs/common';
import { ProcessEnrichmentsJobData } from 'twenty-shared';

import { EnrichmentService } from 'src/engine/core-modules/candidate-sourcing/services/enrichment.service';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';

@Processor(MessageQueue.enrichmentQueue)
@Injectable()
export class EnrichmentQueueProcessor {
  constructor(
    private readonly enrichmentService: EnrichmentService,
  ) { 
    console.log('EnrichmentQueueProcessor initialized'); 
  }
  
  @Process(EnrichmentQueueProcessor.name)
  async handle(jobData: ProcessEnrichmentsJobData): Promise<void> {
    console.log(`Processing enrichment job: ${jobData.batchName || 'Unknown'}`);

    try {
      const enrichmentRequest = {
        enrichments: jobData.enrichments,
        objectNameSingular: jobData.objectNameSingular,
        availableSortDefinitions: jobData.availableSortDefinitions,
        availableFilterDefinitions: jobData.availableFilterDefinitions,
        objectRecordId: jobData.objectRecordId,
        selectedRecordIds: jobData.selectedRecordIds,
        jobId: jobData.jobId,
      };

      const result = await this.enrichmentService.processEnrichments(
        enrichmentRequest,
        jobData.apiToken,
        jobData.origin,
        jobData.jobObject,
      );

      if (result.status === 'Success') {
        console.log(`Successfully processed enrichment job: ${jobData.batchName || 'Unknown'}`);
      } else {
        console.error(`Enrichment job failed: ${jobData.batchName || 'Unknown'}`, result.error);
        throw new Error(result.error || 'Enrichment processing failed');
      }
    } catch (error) {
      console.error(
        `Enrichment job processing failed: ${jobData.batchName || 'Unknown'}`,
        error,
      );
      throw error;
    }
  }
}
