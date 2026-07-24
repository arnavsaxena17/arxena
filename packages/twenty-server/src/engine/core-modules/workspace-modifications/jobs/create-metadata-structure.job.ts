import { Logger, Scope } from '@nestjs/common';

import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

const MAX_RETRIES = 4;
const INITIAL_DELAY_MS = 2000;
const isConnectionError = (error: unknown): boolean => {
  const code = error && typeof error === 'object' && 'code' in error ? (error as { code?: string }).code : undefined;
  const message = error instanceof Error ? error.message : String(error);
  return code === 'ECONNREFUSED' || code === 'ECONNRESET' || message.includes('ECONNREFUSED') || message.includes('ECONNRESET');
};

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export type CreateMetadataStructureJobData = {
  token: string;
  origin: string;
};

@Processor({
  queueName: MessageQueue.metadataStructureQueue,
  scope: Scope.DEFAULT,
})
export class CreateMetadataStructureJob {
  protected readonly logger = new Logger(CreateMetadataStructureJob.name);

  constructor(private readonly workspaceQueryService: WorkspaceQueryService) {}

  @Process(CreateMetadataStructureJob.name)
  async handle(data: CreateMetadataStructureJobData): Promise<void> {
    this.logger.log('CreateMetadataStructure job started');
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.workspaceQueryService.createMetadataStructure(
          data.token,
          data.origin,
        );
        this.logger.log('CreateMetadataStructure job completed');
        return;
      } catch (error) {
        lastError = error;
        const retryable = isConnectionError(error);
        this.logger.warn(
          `CreateMetadataStructure attempt ${attempt}/${MAX_RETRIES} failed: ${error instanceof Error ? error.message : String(error)}${retryable ? ' (will retry)' : ''}`,
        );
        if (!retryable || attempt === MAX_RETRIES) {
          this.logger.error(
            `CreateMetadataStructure job failed: ${error instanceof Error ? error.message : String(error)}`,
          );
          throw error;
        }
        const delayMs = INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
        this.logger.log(`Retrying in ${delayMs}ms...`);
        await sleep(delayMs);
      }
    }
    throw lastError;
  }
}
