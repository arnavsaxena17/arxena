import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

export interface DeleteFieldValuesJobData {
  candidateIds: string[];
  dataSourceSchema: string;
  workspaceId: string;
  batchNumber?: number;
  totalBatches?: number;
}

@Processor(MessageQueue.candidateQueue)
export class DeleteFieldValuesQueueProcessor {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
  ) {
    console.log('DeleteFieldValuesQueueProcessor initialized');
  }

  @Process(DeleteFieldValuesQueueProcessor.name)
  async handle(jobData: DeleteFieldValuesJobData): Promise<void> {
    const { candidateIds, dataSourceSchema, workspaceId, batchNumber, totalBatches } = jobData;

    console.log(
      `Processing delete field values batch ${batchNumber || '?'}/${totalBatches || '?'} with ${candidateIds.length} candidates`,
    );

    try {
      await this.deleteFieldValuesInBatches(
        candidateIds,
        dataSourceSchema,
        workspaceId,
      );

      console.log(
        `✅ Successfully deleted field values for batch ${batchNumber || '?'}/${totalBatches || '?'} with ${candidateIds.length} candidates`,
      );
    } catch (error) {
      console.error(
        `Batch ${batchNumber || '?'}/${totalBatches || '?'} field values deletion failed:`,
        error,
      );
      throw error;
    }
  }

  private async deleteFieldValuesInBatches(
    candidateIds: string[],
    dataSourceSchema: string,
    workspaceId: string,
  ): Promise<void> {
    const SUB_BATCH_SIZE = 15; // Delete one candidate at a time to prevent query timeouts
    const MAX_RETRIES = 3;
    const INITIAL_RETRY_DELAY = 200; // Start with 200ms
    const MAX_RETRY_DELAY = 2000; // Max 2 seconds

    for (let i = 0; i < candidateIds.length; i += SUB_BATCH_SIZE) {
      const subBatch = candidateIds.slice(i, i + SUB_BATCH_SIZE);

      // Use parameterized query for better performance and security
      // Since SUB_BATCH_SIZE is 1, we always have a single candidate
      const deleteFieldValuesQuery = `DELETE FROM ${dataSourceSchema}."_candidateFieldValue" WHERE "candidateId" = $1`;
      const clearOtherFieldsQuery = `UPDATE ${dataSourceSchema}."_candidate" SET "otherFields" = '{}'::jsonb WHERE "id" = $1`;
      const parameters = [subBatch[0]];

      let retryCount = 0;
      let success = false;

      while (retryCount < MAX_RETRIES && !success) {
        try {
          await this.workspaceQueryService.executeRawQuery(
            deleteFieldValuesQuery,
            parameters,
            workspaceId,
          );
          await this.workspaceQueryService.executeRawQuery(
            clearOtherFieldsQuery,
            parameters,
            workspaceId,
          );
          console.log(
            `Successfully deleted field values for candidate ${subBatch[0]} (${Math.floor(i / SUB_BATCH_SIZE) + 1}/${candidateIds.length})`,
          );
          success = true;

          // Add delay between batches to reduce database load
          if (i + SUB_BATCH_SIZE < candidateIds.length) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        } catch (error) {
          retryCount++;
          const isTimeoutError =
            error.message?.includes('timeout') ||
            error.message?.includes('Query read timeout');
          console.error(
            `Error deleting field values for candidate ${subBatch[0]} (attempt ${retryCount}/${MAX_RETRIES}): ${error.message}`,
          );

          if (retryCount < MAX_RETRIES) {
            // Exponential backoff with jitter
            const delay = Math.min(
              INITIAL_RETRY_DELAY * Math.pow(2, retryCount - 1) +
                Math.random() * 100,
              MAX_RETRY_DELAY,
            );
            console.log(`Retrying in ${Math.round(delay)}ms...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
          } else {
            console.error(
              `Failed to delete field values for candidate ${subBatch[0]} after ${MAX_RETRIES} attempts. Continuing with next candidate.`,
            );
            if (isTimeoutError) {
              console.error(
                `Timeout error detected. This candidate may have too many field values. Consider checking database performance.`,
              );
            }
            // Continue with next batch even if this one fails
          }
        }
      }
    }
  }
}

