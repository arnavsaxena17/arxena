import { Logger, Scope } from '@nestjs/common';

import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';

import { MetadataStructureSeedService } from '../metadata-structure-seed/metadata-structure-seed.service';

export const SEED_METADATA_STRUCTURE_JOB_NAME = 'SeedMetadataStructureJob';

export type SeedMetadataStructureJobData = {
  workspaceId: string;
};

@Processor({
  queueName: MessageQueue.metadataStructureQueue,
  scope: Scope.DEFAULT,
})
export class SeedMetadataStructureJob {
  protected readonly logger = new Logger(SeedMetadataStructureJob.name);

  constructor(
    private readonly metadataStructureSeedService: MetadataStructureSeedService,
  ) {}

  @Process(SEED_METADATA_STRUCTURE_JOB_NAME)
  async handle(data: SeedMetadataStructureJobData): Promise<void> {
    this.logger.log(`SeedMetadataStructure job started for workspace ${data.workspaceId}`);
    await this.metadataStructureSeedService.seedForWorkspace(data.workspaceId);
    this.logger.log(`SeedMetadataStructure job completed for workspace ${data.workspaceId}`);
  }
}
