import { randomUUID } from 'crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';

import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import type { TheOrgAsyncJobProgress } from 'src/engine/core-modules/theorg/types/theorg.types';

import type { TheOrgCompanyEnrichmentJobData } from '../jobs/process-theorg-company-enrichment.job';
import { TheOrgCompanyEnrichmentJob } from '../jobs/process-theorg-company-enrichment.job';

@Injectable()
export class TheOrgJobService {
  private readonly logger = new Logger(TheOrgJobService.name);

  private get jobTtlMs(): number {
    return Number(process.env.THEORG_JOB_TTL_MS ?? 24 * 60 * 60 * 1000);
  }

  constructor(
    @InjectMessageQueue(MessageQueue.theOrgQueue)
    private readonly messageQueueService: MessageQueueService,
    @Inject(CacheStorageNamespace.EngineTheOrg)
    private readonly cacheStorage: CacheStorageService,
  ) {}

  async getJobProgress(jobId: string): Promise<TheOrgAsyncJobProgress | null> {
    try {
      const progress = await this.cacheStorage.get<TheOrgAsyncJobProgress>(
        `job:${jobId}`,
      );

      return progress ?? null;
    } catch (error) {
      this.logger.error(`Failed to read TheOrg job progress for ${jobId}`, error as Error);
      return null;
    }
  }

  async queueCompanyProfileEnrichment(
    slug: string,
    workspaceId?: string,
  ): Promise<string> {
    const jobId = randomUUID();
    const jobData: TheOrgCompanyEnrichmentJobData = {
      jobId,
      slug,
      workspaceId,
    };

    const progress: TheOrgAsyncJobProgress = {
      jobId,
      slug,
      workspaceId,
      status: 'queued',
      total: 1,
      completed: 0,
      failed: 0,
    };

    await this.cacheStorage.set(`job:${jobId}`, progress, this.jobTtlMs);
    await this.messageQueueService.add(
      TheOrgCompanyEnrichmentJob.name,
      jobData,
      { id: jobId },
    );

    this.logger.log(`Queued TheOrg enrichment job ${jobId} for ${slug}`);

    return jobId;
  }
}
