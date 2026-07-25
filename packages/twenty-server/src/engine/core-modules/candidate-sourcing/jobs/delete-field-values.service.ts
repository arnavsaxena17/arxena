import { v4 } from 'uuid';

import { QueueCronJobOptions } from 'src/engine/core-modules/message-queue/drivers/interfaces/job-options.interface';

import { DeleteFieldValuesJobData, DeleteFieldValuesQueueProcessor } from 'src/engine/core-modules/candidate-sourcing/jobs/delete-field-values.job';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';

export class DeleteFieldValuesService {
  constructor(
    @InjectMessageQueue(MessageQueue.candidateQueue)
    private readonly messageQueueService: MessageQueueService,
  ) {}

  /**
   * Queue candidate field values deletion for processing
   */
  async queueDeleteFieldValues(
    candidateIds: string[],
    dataSourceSchema: string,
    workspaceId: string,
    sessionId?: string,
  ): Promise<void> {
    try {
      console.log(
        `Queueing deletion of field values for ${candidateIds.length} candidates`,
      );

      const batchSize = 100; // Process in batches of 100 candidates
      const totalBatches = Math.ceil(candidateIds.length / batchSize);

      console.log(
        `Breaking up ${candidateIds.length} candidates into ${totalBatches} batches of ~${batchSize} each`,
      );

      for (let i = 0; i < candidateIds.length; i += batchSize) {
        const batch = candidateIds.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;

        console.log(
          `Queueing field values deletion batch ${batchNumber}/${totalBatches} with ${batch.length} candidates`,
        );

        const queueJobOptions: QueueCronJobOptions = {
          retryLimit: 3,
          priority: 1,
          repeat: { every: 1000 },
        };

        const jobData: DeleteFieldValuesJobData = {
          candidateIds: batch,
          dataSourceSchema,
          workspaceId,
          batchNumber,
          totalBatches,
        };

        // Create unique job ID to prevent duplicate processing
        const uniqueSessionId = sessionId || v4();
        const uniqueProjectId = `delete-field-values-${workspaceId}-batch-${batchNumber}-${uniqueSessionId}`;

        try {
          await this.messageQueueService.add<DeleteFieldValuesJobData>(
            DeleteFieldValuesQueueProcessor.name,
            jobData,
            {
              ...queueJobOptions,
              id: uniqueProjectId, // Add unique ID to prevent duplicates
            },
          );
          console.log(
            `✅ Successfully queued field values deletion batch ${batchNumber}/${totalBatches} with job ID: ${uniqueProjectId}`,
          );
        } catch (queueError) {
          // Check if error is due to duplicate job ID
          if (
            queueError.message?.includes('already') ||
            queueError.message?.includes('duplicate')
          ) {
            console.log(
              `Project with ID ${uniqueProjectId} is already queued or running, skipping duplicate`,
            );
            // Don't throw - just skip this batch as it's already being processed
            continue;
          }
          console.error(
            `❌ Failed to queue field values deletion batch ${batchNumber}/${totalBatches} with job ID: ${uniqueProjectId}`,
            queueError,
          );
          throw queueError; // Re-throw to stop processing if queueing fails
        }
      }

      console.log(
        `✅ Successfully queued all ${totalBatches} batches for field values deletion`,
      );
    } catch (error) {
      console.log('Failed to queue field values deletion:', error);
      throw error;
    }
  }
}

